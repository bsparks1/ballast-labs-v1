"use client";

import { useState } from "react";
import { getSessionInput, saveReport } from "@/lib/report-store";
import { AnalyzingPanel } from "@/components/AnalyzingPanel";
import { ANALYSIS_STEPS } from "@/lib/analysis/steps";

export function FillGapsForm() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const input = getSessionInput();
    if (!input?.prompt) {
      setError("Original extracted prompt is not in this session.");
      return;
    }
    setBusy(true);
    setError(null);
    setStep(0);
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 1400);
    try {
      const prompt = `${input.prompt}\n\n## Manual additions\n${text.trim()}`;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, config: input.config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      saveReport(data, { prompt, config: input.config });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-edge bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
            Fill gaps
          </p>
          <p className="mt-1 text-xs text-muted">
            Paste prompts, tool config, or memory settings that extraction missed. Ballast re-runs the same analysis on the combined harness.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            className="shrink-0 rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground"
            onClick={() => setOpen(true)}
          >
            Add missing pieces
          </button>
        )}
      </div>
      {open && (
        <>
          <textarea
            className="mt-3 h-36 w-full resize-y rounded-sm border border-edge bg-background p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-faint focus:border-accent"
            placeholder="Paste the missing system prompt, guardrails, or config…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="rounded-sm bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              disabled={busy || text.trim().length === 0}
              onClick={submit}
            >
              Re-analyze with additions
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-critical">{error}</p>}
          {busy && <AnalyzingPanel step={step} title="Re-analyzing with your additions" />}
        </>
      )}
    </section>
  );
}
