"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionInput } from "@/lib/report-store";
import { useAuth } from "@/components/auth/AuthProvider";

export function SaveHarnessButton() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="flex items-center justify-between rounded-md border border-edge bg-surface px-4 py-3">
        <p className="text-xs text-muted">
          This analysis lives in the session only. Sign in to save it as a versioned harness.
        </p>
        <button
          type="button"
          className="shrink-0 text-xs text-accent hover:text-foreground"
          onClick={() => router.push("/login?next=/report")}
        >
          Sign in to save
        </button>
      </div>
    );
  }

  async function save() {
    const input = getSessionInput();
    if (!input?.prompt) {
      setError("Original prompt is not in this session. Paste it again from My Harnesses → New harness.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/harnesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          prompt: input.prompt,
          config: input.config,
          note: "Saved from one-off audit",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/harnesses/${data.harnessId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-edge bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Keep this as a named harness to version it, diff changes, and re-analyze later.
        </p>
        {!open ? (
          <button
            type="button"
            className="rounded-sm bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
            onClick={() => setOpen(true)}
          >
            Save as harness
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="rounded-sm border border-edge bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              placeholder="Harness name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy || name.trim().length === 0}
              className="rounded-sm bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              onClick={save}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
    </div>
  );
}
