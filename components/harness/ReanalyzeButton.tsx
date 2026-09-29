"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReanalyzeButton({ harnessId, versionId }: { harnessId: string; versionId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/harnesses/${harnessId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(versionId ? { versionId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/harnesses/${harnessId}?reanalyzed=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="btn btn-secondary btn-xs"
      >
        {busy ? "Re-analyzing…" : "Re-analyze"}
      </button>
      {error && <p className="max-w-xs text-right text-[11px] text-critical">{error}</p>}
    </div>
  );
}
