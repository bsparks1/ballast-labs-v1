"use client";

/**
 * Phase 2 debug view: paste → structural analysis → raw HarnessReport JSON.
 * Not linked from the main UI; kept as a development tool.
 */

import { useState } from "react";
import type { HarnessReport } from "@/lib/types";
import { SAMPLES } from "@/lib/samples";

export default function DebugPage() {
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState("");
  const [report, setReport] = useState<HarnessReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, config: config || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
      <h1 className="text-lg font-semibold">Debug: raw analysis output</h1>
      <div className="flex gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            className="rounded border border-edge px-3 py-1 text-sm text-muted hover:text-foreground"
            onClick={() => {
              setPrompt(s.prompt);
              setConfig(s.config ?? "");
            }}
          >
            Load {s.name}
          </button>
        ))}
      </div>
      <textarea
        className="h-48 w-full rounded border border-edge bg-surface p-3 font-mono text-xs"
        placeholder="System prompt…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <textarea
        className="h-24 w-full rounded border border-edge bg-surface p-3 font-mono text-xs"
        placeholder="Optional config (JSON/YAML)…"
        value={config}
        onChange={(e) => setConfig(e.target.value)}
      />
      <button
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={loading || prompt.trim().length === 0}
        onClick={analyze}
      >
        {loading ? "Analyzing…" : "Analyze"}
      </button>
      {error && <p className="text-sm text-critical">{error}</p>}
      {report && (
        <pre className="overflow-x-auto rounded border border-edge bg-surface p-4 text-xs leading-relaxed">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}
