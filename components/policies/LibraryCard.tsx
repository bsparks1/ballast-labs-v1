"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { COMPONENT_LABELS } from "@/lib/types";
import type { LibraryListItem } from "./types";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-faint transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
    >
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LibraryCard({
  policy,
  onAdopted,
  onOpenMine,
}: {
  policy: LibraryListItem;
  onAdopted: (policyId: string) => void;
  onOpenMine: (policyId: string) => void;
}) {
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adopted = policy.adoptedPolicyId !== null;

  async function adopt() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/policies/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starterId: policy.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onAdopted(data.id as string);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-faint">{policy.code}</span>
              <span className="text-sm font-medium text-foreground">{policy.name}</span>
              {adopted && <span className="text-[11px] font-medium text-muted">Adopted</span>}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted">{policy.principle}</span>
              {policy.frameworks.map((tag) => (
                <span key={tag} className="rounded-sm bg-background px-1.5 py-0.5 font-mono text-[10px] text-faint">
                  {tag}
                </span>
              ))}
            </span>
            <span className="mt-1 block truncate text-sm text-muted">{policy.statement}</span>
          </span>
          <Chevron open={open} />
        </button>
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div id={panelId} inert={open ? undefined : true} className="min-h-0 overflow-hidden">
          <div className="space-y-3 border-t border-edge px-4 py-4">
            <div>
              <p className="text-xs text-muted">Statement</p>
              <p className="mt-1 text-sm text-foreground">{policy.statement}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Checkable intent</p>
              <p className="mt-1 text-sm text-muted">{policy.checkableIntent}</p>
            </div>
            <p className="text-xs text-muted">
              Severity <span className="text-foreground">{policy.severity}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {policy.components.map((component) => (
                <span key={component} className="rounded-sm border border-edge px-1.5 py-0.5 text-[11px] text-muted">
                  {COMPONENT_LABELS[component]}
                </span>
              ))}
            </div>
            {error && <p className="text-xs text-critical">{error}</p>}
            {adopted && policy.adoptedPolicyId ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-muted">This policy is already in My Policies.</p>
                <button
                  type="button"
                  onClick={() => onOpenMine(policy.adoptedPolicyId as string)}
                  className="rounded-sm border border-edge px-3 py-1.5 text-xs text-foreground hover:border-edge-strong"
                >
                  View in My Policies
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void adopt()}
                  className="btn btn-primary btn-xs"
                >
                  {busy ? "Adopting…" : "Adopt as draft"}
                </button>
                <p className="text-xs text-faint">Lands in My Policies as a draft. Activate it when you want it checked.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
