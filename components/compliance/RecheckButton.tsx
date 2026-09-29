"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecheckButton({ harnessId }: { harnessId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/harnesses/${harnessId}/compliance`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:border-edge-strong hover:text-foreground disabled:opacity-40"
      >
        {busy ? "Checking…" : "Re-check policies"}
      </button>
      {error && <p className="max-w-xs text-right text-[11px] text-critical">{error}</p>}
    </div>
  );
}
