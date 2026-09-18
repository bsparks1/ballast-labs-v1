"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SAMPLES } from "@/lib/samples";
import { saveReport } from "@/lib/report-store";
import { ANALYSIS_STEPS } from "@/lib/analysis/steps";
import { INGEST_STEPS } from "@/lib/ingest/steps";
import { Header } from "@/components/Header";
import { AnalyzingPanel } from "@/components/AnalyzingPanel";
import { useAuth } from "@/components/auth/AuthProvider";
import { appendRepoFormData, RepoIngestFields, type RepoIngestValues } from "@/components/ingest/RepoIngestFields";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<"paste" | "repo">("paste");
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [repo, setRepo] = useState<RepoIngestValues>({ url: "", subdir: "", files: [] });
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ingestSteps = [...INGEST_STEPS, ...ANALYSIS_STEPS];
  const activeSteps = mode === "repo" ? ingestSteps : ANALYSIS_STEPS;

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  function startSteps(total: number) {
    setAnalyzing(true);
    setError(null);
    setStep(0);
    stepTimer.current = setInterval(() => {
      setStep((s) => Math.min(s + 1, total - 1));
    }, 1400);
  }

  function failAnalysis(e: unknown) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    setError(
      timeout
        ? "Analysis timed out. Try a shorter prompt, or point at the agent subdirectory instead of the whole repo."
        : e instanceof Error
          ? e.message
          : String(e)
    );
    setAnalyzing(false);
    if (stepTimer.current) clearInterval(stepTimer.current);
  }

  async function analyzePaste() {
    startSteps(ANALYSIS_STEPS.length);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, config: config || undefined }),
        signal: AbortSignal.timeout(310_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      saveReport(data, { prompt, config: config || undefined });
      router.push("/report");
    } catch (e) {
      failAnalysis(e);
    }
  }

  async function analyzeRepo() {
    startSteps(ingestSteps.length);
    try {
      let res: Response;
      if (repo.files.length > 0) {
        const form = new FormData();
        appendRepoFormData(form, repo);
        form.set("analyze", "true");
        res = await fetch("/api/ingest", { method: "POST", body: form, signal: AbortSignal.timeout(310_000) });
      } else {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: repo.url.trim(),
            subdir: repo.subdir.trim() || undefined,
            analyze: true,
          }),
          signal: AbortSignal.timeout(310_000),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (!data.report) throw new Error("Ingestion did not return an analysis.");
      saveReport(data.report, { prompt: data.prompt, config: data.config });
      router.push("/report");
    } catch (e) {
      failAnalysis(e);
    }
  }

  function loadSample(id: string) {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setMode("paste");
    setPrompt(sample.prompt);
    setConfig(sample.config ?? "");
    setShowConfig(Boolean(sample.config));
    setError(null);
  }

  const canAnalyze =
    mode === "paste" ? prompt.trim().length > 0 : repo.url.trim().length > 0 || repo.files.length > 0;

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
            Agent harness audit
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Your agent&apos;s config is a liability.
            <br className="hidden sm:block" /> Find out where.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Paste a system prompt, or point Ballast at the GitHub repo. It extracts what it can of the
            six-component harness — instructions, tools, knowledge, memory, guardrails, delegation —
            and audits it with evidence.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-xs text-faint">
            One-off audits stay in this session.{" "}
            <Link href={user ? "/harnesses" : "/login?next=/harnesses"} className="text-accent hover:text-foreground">
              Save a named harness
            </Link>{" "}
            to version it and diff every change.
          </p>
        </div>

        <div className="mt-8 rounded-md border border-edge bg-surface p-4 sm:p-5">
          <div className="flex gap-1 border-b border-edge pb-3">
            {(
              [
                ["paste", "Paste prompt"],
                ["repo", "From repo"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === id ? "bg-accent-dim text-foreground" : "text-muted hover:text-foreground"
                }`}
                onClick={() => {
                  setMode(id);
                  setError(null);
                }}
                disabled={analyzing}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "paste" ? (
            <>
              <div className="mt-4 flex items-center justify-between">
                <label
                  htmlFor="prompt"
                  className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint"
                >
                  System prompt
                </label>
                <div className="flex gap-2">
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
              </div>
              <textarea
                id="prompt"
                className="mt-2 h-72 w-full resize-y rounded-sm border border-edge bg-background p-3 font-mono text-xs leading-relaxed outline-none transition-colors placeholder:text-faint focus:border-accent"
                placeholder={`Paste your agent's system prompt…\n\ne.g. "You are a customer support agent. Always escalate refunds over $100. Never transfer customers to a human…"`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={analyzing}
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
                  className="mt-2 h-36 w-full resize-y rounded-sm border border-edge bg-background p-3 font-mono text-xs leading-relaxed outline-none transition-colors placeholder:text-faint focus:border-accent"
                  placeholder={`{ "tools": [ { "name": "database", "permissions": ["read", "write"], "usage_count": 120 } ] }`}
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                  disabled={analyzing}
                />
              )}
            </>
          ) : (
            <div className="mt-4">
              <RepoIngestFields values={repo} onChange={setRepo} disabled={analyzing} />
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[11px] text-faint">
              {mode === "repo"
                ? "Extraction is best-effort. Coverage is reported honestly after analysis."
                : "One-off analyses stay in this session. Named harnesses are stored and versioned."}
            </p>
            <button
              type="button"
              className="rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={analyzing || !canAnalyze}
              onClick={mode === "paste" ? analyzePaste : analyzeRepo}
            >
              {mode === "repo" ? "Ingest & analyze" : "Analyze harness"}
            </button>
          </div>
          {error && (
            <p className="mt-3 rounded-sm border border-critical/30 bg-critical-dim px-3 py-2 text-xs text-critical">
              {error}
            </p>
          )}
        </div>

        {analyzing && (
          <AnalyzingPanel
            step={step}
            steps={activeSteps}
            title={mode === "repo" ? "Ingesting repo and analyzing" : "Analyzing harness"}
          />
        )}

        {!analyzing && (
          <div className="mt-10 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
            {[
              ["Contradictions", "Rules that demand incompatible actions — verified by a two-pass model audit, with both rules quoted."],
              ["Dead weight", "Fossil scaffolding and vague directives that burn tokens and dilute the rules that matter."],
              ["Standing risk", "Write, delete, and deploy permissions the agent holds but has never used."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-md border border-edge bg-surface/50 p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
