"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { VerdictBadge } from "@/components/compliance/VerdictBadge";
import { VerdictExplanation } from "@/components/compliance/VerdictExplanation";
import { COMPONENT_LABELS, type PolicyLifecycle, type Severity } from "@/lib/types";
import { PolicyStatusControl } from "./PolicyStatusControl";
import { StatusDot } from "./StatusDot";
import { fieldClass, type PolicyListItem } from "./types";

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

function differsFromOrigin(policy: PolicyListItem): boolean {
  const origin = policy.origin;
  if (!origin) return false;
  return (
    origin.name !== policy.name ||
    origin.statement !== policy.statement ||
    origin.checkableIntent !== policy.checkableIntent ||
    origin.severity !== policy.severity
  );
}

export function PolicyCard({
  policy,
  initiallyOpen,
  harnessName,
  onStatusChanged,
}: {
  policy: PolicyListItem;
  initiallyOpen: boolean;
  harnessName: string | null;
  onStatusChanged: (status: PolicyLifecycle) => void;
}) {
  const router = useRouter();
  const panelId = useId();
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(initiallyOpen);
  const [statement, setStatement] = useState(policy.statement);
  const [checkableIntent, setCheckableIntent] = useState(policy.checkableIntent);
  const [severity, setSeverity] = useState<Severity>(policy.severity);
  const [busy, setBusy] = useState<"save" | "revert" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const reasonId = useId();
  const edited = differsFromOrigin(policy);
  const dirty =
    statement !== policy.statement || checkableIntent !== policy.checkableIntent || severity !== policy.severity;

  useEffect(() => {
    setStatement(policy.statement);
    setCheckableIntent(policy.checkableIntent);
    setSeverity(policy.severity);
  }, [policy.version, policy.statement, policy.checkableIntent, policy.severity]);

  useEffect(() => {
    if (!initiallyOpen) return;
    setOpen(true);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [initiallyOpen]);

  function toggle() {
    setConfirmingRemove(false);
    setOpen((current) => !current);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement, checkableIntent, severity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  function cancel() {
    setStatement(policy.statement);
    setCheckableIntent(policy.checkableIntent);
    setSeverity(policy.severity);
    setError(null);
    setConfirmingRemove(false);
    setOpen(false);
  }

  async function revert() {
    setBusy("revert");
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revert: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setShowDiff(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policy.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
      setConfirmingRemove(false);
    }
  }

  return (
    <article ref={ref} id={`policy-${policy.id}`} className="card scroll-mt-24">
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <span className="mt-0.5">
            <StatusDot status={policy.status} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-faint">{policy.code}</span>
              <span className="text-sm font-medium text-foreground">{policy.name}</span>
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
            {policy.confidence === "low" && policy.generationNote ? (
              <span className="mt-1 line-clamp-2 block text-xs text-warning">{policy.generationNote}</span>
            ) : null}
          </span>
          <Chevron open={open} />
        </button>
        {policy.verdict && (
          <span className="mt-0.5 shrink-0">
            <VerdictBadge
              verdict={policy.verdict}
              expanded={reasonOpen}
              controls={reasonId}
              onToggle={() => setReasonOpen((current) => !current)}
            />
          </span>
        )}
      </div>
      {reasonOpen && policy.verdict && (
        <div id={reasonId} className="border-t border-edge px-4 py-3">
          <VerdictExplanation
            verdict={policy.verdict}
            reasoning={policy.check?.reasoning ?? ""}
            evidence={policy.check?.evidence ?? []}
            recommendation={policy.check?.recommendation ?? ""}
            harnessName={harnessName}
          />
        </div>
      )}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div id={panelId} inert={open ? undefined : true} className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t border-edge px-4 py-4">
            <PolicyStatusControl
              policyId={policy.id}
              policyName={policy.name}
              status={policy.status}
              onChanged={onStatusChanged}
            />

            {edited && policy.origin && (
              <div className="rounded-sm border border-edge bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">Edited from the library default.</p>
                  <button
                    type="button"
                    onClick={() => setShowDiff((current) => !current)}
                    className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {showDiff ? "Hide changes" : "View changes"}
                  </button>
                </div>
                {showDiff && (
                  <div className="mt-3 space-y-3">
                    <DiffField label="Statement" from={policy.origin.statement} to={policy.statement} />
                    <DiffField label="Checkable intent" from={policy.origin.checkableIntent} to={policy.checkableIntent} />
                    <DiffField label="Severity" from={policy.origin.severity} to={policy.severity} />
                  </div>
                )}
              </div>
            )}

            <form onSubmit={save} className="space-y-3">
              <label className="block text-xs text-muted">
                Statement
                <textarea
                  value={statement}
                  onChange={(event) => setStatement(event.target.value)}
                  required
                  className={`${fieldClass} h-24 resize-y`}
                />
              </label>
              <label className="block text-xs text-muted">
                Checkable intent
                <textarea
                  value={checkableIntent}
                  onChange={(event) => setCheckableIntent(event.target.value)}
                  required
                  className={`${fieldClass} h-28 resize-y`}
                />
                <span className="mt-1 block text-[11px] text-faint">What Ballast verifies on the next analysis.</span>
              </label>
              <label className="block text-xs text-muted">
                Severity
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as Severity)}
                  className={fieldClass}
                >
                  <option value="critical">critical</option>
                  <option value="warning">warning</option>
                  <option value="info">info</option>
                </select>
              </label>
              <div>
                <p className="text-xs text-muted">Components</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {policy.components.map((component) => (
                    <span key={component} className="rounded-sm border border-edge px-1.5 py-0.5 text-[11px] text-muted">
                      {COMPONENT_LABELS[component]}
                    </span>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-critical">{error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={busy !== null || !dirty}
                  className="btn btn-primary btn-xs"
                >
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="btn btn-secondary btn-xs"
                >
                  Cancel
                </button>
                {policy.adoptedFromId && edited && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void revert()}
                    className="text-xs text-muted hover:text-foreground disabled:opacity-40"
                  >
                    {busy === "revert" ? "Reverting…" : "Revert to library original"}
                  </button>
                )}
              </div>
            </form>

            <div className="border-t border-edge pt-3">
              {confirmingRemove ? (
                <div role="group" aria-label="Confirm removal" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xl text-xs text-muted">
                    Remove “{policy.name}”? Ballast will stop checking this policy against your harnesses.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void remove()}
                      className="btn btn-danger btn-xs"
                    >
                      {busy === "remove" ? "Removing…" : "Yes"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setConfirmingRemove(false)}
                      className="btn btn-secondary btn-xs"
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/policies/${policy.id}`} className="text-xs text-muted hover:text-foreground">
                    Version history
                  </Link>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setConfirmingRemove(true)}
                    className="text-xs text-muted hover:text-critical disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function DiffField({ label, from, to }: { label: string; from: string; to: string }) {
  if (from === to) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-1 text-xs text-muted line-through decoration-faint">{from}</p>
      <p className="mt-1 text-xs text-foreground">{to}</p>
    </div>
  );
}
