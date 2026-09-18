"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SAMPLES } from "@/lib/samples";
import { AnalyzingPanel } from "@/components/AnalyzingPanel";
import { ANALYSIS_STEPS } from "@/lib/analysis/steps";
import { INGEST_STEPS } from "@/lib/ingest/steps";
import { CoveragePanel } from "@/components/ingest/CoveragePanel";
import { appendRepoFormData, RepoIngestFields, type RepoIngestValues } from "@/components/ingest/RepoIngestFields";
import { parseBallastMeta } from "@/lib/ingest/assemble";
import type { CoverageReport } from "@/lib/ingest/types";

export function HarnessEditor({
  mode,
  harnessId,
  initialName = "",
  initialDescription = "",
  initialPrompt = "",
  initialConfig = "",
}: {
  mode: "create" | "update";
  harnessId?: string;
  initialName?: string;
  initialDescription?: string;
  initialPrompt?: string;
  initialConfig?: string;
}) {
  const router = useRouter();
  const priorSource = useMemo(() => parseBallastMeta(initialConfig)?.source, [initialConfig]);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [config, setConfig] = useState(initialConfig);
  const [note, setNote] = useState("");
  const [showConfig, setShowConfig] = useState(Boolean(initialConfig));
  const [sourceMode, setSourceMode] = useState<"paste" | "repo">("paste");
  const [repo, setRepo] = useState<RepoIngestValues>({
    url: priorSource?.url ?? "",
    subdir: priorSource?.subdir ?? "",
    files: [],
  });
  const [coverage, setCoverage] = useState<CoverageReport | null>(
    parseBallastMeta(initialConfig)?.coverage ?? null
  );
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function loadSample(id: string) {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setSourceMode("paste");
    setPrompt(sample.prompt);
    setConfig(sample.config ?? "");
    setShowConfig(Boolean(sample.config));
    if (!name) setName(sample.name);
    if (!description) setDescription(sample.description);
    setError(null);
  }

  async function extractRepo() {
    setExtracting(true);
    setError(null);
    setStep(0);
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, INGEST_STEPS.length - 1));
    }, 900);
    try {
      let res: Response;
      if (repo.files.length > 0) {
        const form = new FormData();
        appendRepoFormData(form, repo);
        form.set("analyze", "false");
        res = await fetch("/api/ingest", { method: "POST", body: form });
      } else {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: repo.url.trim(),
            subdir: repo.subdir.trim() || undefined,
            analyze: false,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPrompt(data.prompt ?? "");
      setConfig(data.config ?? "");
      setShowConfig(true);
      setCoverage(data.coverage ?? null);
      setSourceMode("paste");
      if (!name && repo.url.trim()) {
        const parts = repo.url.trim().split("/").filter(Boolean);
        setName(parts[parts.length - 1]?.replace(/\.git$/, "") || name);
      }
      if (!note) {
        setNote(repo.url.trim() ? `Ingested from ${repo.url.trim()}` : "Ingested from uploaded files");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setExtracting(false);
    }
  }

  async function submit() {
    setAnalyzing(true);
    setError(null);
    setStep(0);
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 1400);

    try {
      const url = mode === "create" ? "/api/harnesses" : `/api/harnesses/${harnessId}/versions`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          prompt,
          config: config || undefined,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (mode === "create") {
        router.push(`/harnesses/${data.harnessId}`);
      } else {
        const from = data.fromVersion;
        const to = data.toVersion;
        router.push(
          from && to
            ? `/harnesses/${data.harnessId}/diff?from=${from}&to=${to}`
            : `/harnesses/${data.harnessId}`
        );
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAnalyzing(false);
      clearInterval(timer);
    }
  }

  const busy = analyzing || extracting;

  return (
    <div className="rounded-md border border-edge bg-surface p-4 sm:p-5">
      {mode === "create" && (
        <>
          <label className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint" htmlFor="name">
            Harness name
          </label>
          <input
            id="name"
            className="mt-2 w-full rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Customer Support Agent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <label
            className="mt-4 block font-mono text-[11px] font-semibold uppercase tracking-widest text-faint"
            htmlFor="description"
          >
            Description <span className="font-normal normal-case tracking-normal text-faint">(optional)</span>
          </label>
          <input
            id="description"
            className="mt-2 w-full rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="What this agent is for"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
        </>
      )}

      <div className={`flex gap-1 border-b border-edge pb-3 ${mode === "create" ? "mt-4" : ""}`}>
        {(
          [
            ["paste", "Paste prompt"],
            ["repo", mode === "update" ? "Re-ingest repo" : "From repo"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
              sourceMode === id ? "bg-accent-dim text-foreground" : "text-muted hover:text-foreground"
            }`}
            onClick={() => {
              setSourceMode(id);
              setError(null);
            }}
            disabled={busy}
          >
            {label}
          </button>
        ))}
      </div>

      {sourceMode === "repo" ? (
        <div className="mt-4">
          <RepoIngestFields values={repo} onChange={setRepo} disabled={busy} />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              disabled={busy || (repo.url.trim().length === 0 && repo.files.length === 0)}
              onClick={extractRepo}
            >
              Extract into editor
            </button>
          </div>
          {extracting && <AnalyzingPanel step={step} steps={INGEST_STEPS} title="Extracting harness from repo" />}
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <label htmlFor="prompt" className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
              System prompt
            </label>
            {mode === "create" && (
              <div className="flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="rounded-sm border border-edge px-2 py-1 text-[11px] text-muted transition-colors hover:border-edge-strong hover:text-foreground"
                    onClick={() => loadSample(s.id)}
                    title={s.description}
                  >
                    Try: {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            id="prompt"
            className="mt-2 h-72 w-full resize-y rounded-sm border border-edge bg-background p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-faint focus:border-accent"
            placeholder="Paste the agent's system prompt, or extract it from a repo first…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
          />

          <button
            type="button"
            className="mt-3 text-xs text-muted transition-colors hover:text-foreground"
            onClick={() => setShowConfig((v) => !v)}
          >
            {showConfig ? "− Hide" : "+ Add"} tool config (JSON / YAML) — optional
          </button>
          {showConfig && (
            <textarea
              className="mt-2 h-36 w-full resize-y rounded-sm border border-edge bg-background p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-faint focus:border-accent"
              placeholder={`{ "tools": [ { "name": "database", "permissions": ["read", "write"] } ] }`}
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              disabled={busy}
            />
          )}
        </>
      )}

      {coverage && sourceMode === "paste" && (
        <div className="mt-4">
          <CoveragePanel coverage={coverage} />
        </div>
      )}

      <label className="mt-4 block font-mono text-[11px] font-semibold uppercase tracking-widest text-faint" htmlFor="note">
        Version note <span className="font-normal normal-case tracking-normal text-faint">(optional)</span>
      </label>
      <input
        id="note"
        className="mt-2 w-full rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder={mode === "create" ? "Initial version" : "re-ingested from repo"}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={busy}
      />

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          className="rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={busy || prompt.trim().length === 0 || (mode === "create" && name.trim().length === 0)}
          onClick={submit}
        >
          {mode === "create" ? "Save & analyze" : "Save new version"}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-sm border border-critical/30 bg-critical-dim px-3 py-2 text-xs text-critical">{error}</p>
      )}
      {analyzing && (
        <AnalyzingPanel
          step={step}
          title={mode === "create" ? "Saving version 1 and analyzing" : "Saving new version and analyzing"}
        />
      )}
    </div>
  );
}
