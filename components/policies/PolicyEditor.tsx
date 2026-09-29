"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Severity } from "@/lib/types";

export function PolicyEditor({
  policyId,
  initialStatement,
  initialIntent,
  initialSeverity,
}: {
  policyId: string;
  initialStatement: string;
  initialIntent: string;
  initialSeverity: Severity;
}) {
  const router = useRouter();
  const [statement, setStatement] = useState(initialStatement);
  const [checkableIntent, setCheckableIntent] = useState(initialIntent);
  const [severity, setSeverity] = useState<Severity>(initialSeverity);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement, checkableIntent, severity, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">
        Saving writes a new version. The previous statement, intent, and severity stay in the history below — that
        record is who approved the change, and when.
      </p>
      <label className="block text-xs text-muted">
        Statement
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          required
          className="mt-1 h-24 w-full resize-y rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      <label className="block text-xs text-muted">
        Checkable intent
        <textarea
          value={checkableIntent}
          onChange={(e) => setCheckableIntent(e.target.value)}
          required
          className="mt-1 h-28 w-full resize-y rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      <label className="block text-xs text-muted">
        Severity
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          className="mt-1 w-full rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="critical">critical</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
      </label>
      <label className="block text-xs text-muted">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      {error && <p className="text-xs text-critical">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary"
      >
        {busy ? "Saving…" : "Save new version"}
      </button>
    </form>
  );
}
