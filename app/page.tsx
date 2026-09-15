"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SAMPLES } from "@/lib/samples";
import { saveReport } from "@/lib/report-store";
import { Header } from "@/components/Header";

const ANALYSIS_STEPS = [
  "Decomposing prompt into atomic instructions",
  "Classifying rules: absolute, conditional, vague",
  "Scanning for fossil scaffolding",
  "Mapping tool grants and permissions",
  "Checking guardrails, memory, and delegation",
  "Running model-graded conflict verification",
];

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setStep(0);
    stepTimer.current = setInterval(() => {
      setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 1400);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, config: config || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      saveReport(data);
      router.push("/report");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAnalyzing(false);
      if (stepTimer.current) clearInterval(stepTimer.current);
    }
  }

  function loadSample(id: string) {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setPrompt(sample.prompt);
    setConfig(sample.config ?? "");
    setShowConfig(Boolean(sample.config));
    setError(null);
  }

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <div className="text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
            Agent harness audit
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Your agent&apos;s config is a liability.
            <br className="hidden sm:block" /> Find out where.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Paste your agent&apos;s system prompt. Ballast decomposes the harness — instructions,
            tools, memory, guardrails, delegation — and audits it for contradictions, dead
            scaffolding, and standing risk. Evidence included.
          </p>
        </div>

        {/* Input card */}
        <div className="mt-8 rounded-md border border-edge bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
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

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[11px] text-faint">
              Analysis runs server-side. Nothing is stored beyond your session.
            </p>
            <button
              type="button"
              className="rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={analyzing || prompt.trim().length === 0}
              onClick={analyze}
            >
              Analyze harness
            </button>
          </div>
          {error && (
            <p className="mt-3 rounded-sm border border-critical/30 bg-critical-dim px-3 py-2 text-xs text-critical">
              {error}
            </p>
          )}
        </div>

        {/* Analyzing state */}
        {analyzing && (
          <div className="mt-6 rounded-md border border-edge bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
                Analyzing harness
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {ANALYSIS_STEPS.map((label, i) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 text-xs transition-colors duration-300 ${
                    i < step ? "text-healthy" : i === step ? "text-foreground" : "text-faint"
                  }`}
                >
                  <span className="w-4 font-mono">
                    {i < step ? "✓" : i === step ? "▸" : "·"}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What it checks */}
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
