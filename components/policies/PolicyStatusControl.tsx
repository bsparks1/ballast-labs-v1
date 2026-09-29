"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { PolicyLifecycle } from "@/lib/types";
import { STATUS_LABEL } from "./StatusDot";

const OPTIONS: PolicyLifecycle[] = ["active", "paused", "draft"];

const SELECTED: Record<PolicyLifecycle, string> = {
  active: "bg-healthy-dim text-healthy",
  paused: "bg-warning-dim text-warning",
  draft: "bg-surface-raised text-foreground",
};

export function PolicyStatusControl({
  policyId,
  policyName,
  status,
  onChanged,
}: {
  policyId: string;
  policyName: string;
  status: PolicyLifecycle;
  onChanged?: (status: PolicyLifecycle) => void;
}) {
  const router = useRouter();
  const buttonRefs = useRef<Partial<Record<PolicyLifecycle, HTMLButtonElement | null>>>({});
  const noRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState<PolicyLifecycle | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? status;
  const affectsChecks = shown === "active" || status === "active";

  useEffect(() => {
    if (confirming) noRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!confirming) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirming(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  function request(next: PolicyLifecycle) {
    if (next === shown || pending) return;
    if (next === "active" && (status === "draft" || status === "paused")) {
      setError(null);
      setConfirming(true);
      return;
    }
    void commit(next);
  }

  async function commit(next: PolicyLifecycle) {
    setConfirming(false);
    setPending(next);
    setError(null);
    onChanged?.(next);
    try {
      const res = await fetch(`/api/policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      onChanged?.(status);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length];
    buttonRefs.current[next]?.focus();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Policy status"
          className="inline-flex rounded-sm border border-edge p-0.5"
          onKeyDown={(event) => {
            const index = OPTIONS.indexOf(shown);
            onKeyDown(event, index);
          }}
        >
          {OPTIONS.map((option) => {
            const selected = shown === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending !== null}
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  buttonRefs.current[option] = node;
                }}
                onClick={() => request(option)}
                className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  selected ? SELECTED[option] : "text-muted hover:text-foreground"
                }`}
              >
                {STATUS_LABEL[option]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          {shown === "active"
            ? "Evaluated on the next analysis."
            : "Not evaluated. Only Active policies are checked."}
        </p>
      </div>
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="mt-3 rounded-sm border border-warning/40 bg-warning-dim px-3 py-3"
        >
          <p id={titleId} className="text-sm font-medium text-foreground">
            Activate “{policyName}”?
          </p>
          <p className="mt-1 text-sm text-foreground">
            Active policies are enforced against your harnesses. Ballast will check this rule on the next analysis. If
            the harness does not satisfy it, the check comes back violated, and that violation is what this agent is
            held to. Draft and paused policies are not checked, so they do not change those results. Activating does
            not edit the harness. It changes which rules are enforced.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void commit("active")}
              className="btn btn-primary btn-xs"
            >
              Yes, activate
            </button>
            <button
              ref={noRef}
              type="button"
              onClick={() => setConfirming(false)}
              className="btn btn-secondary btn-xs"
            >
              No
            </button>
          </div>
        </div>
      )}
      {pending && affectsChecks && (
        <p className="mt-2 text-xs text-faint">Updating harness checks…</p>
      )}
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
    </div>
  );
}
