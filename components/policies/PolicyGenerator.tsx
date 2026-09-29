"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isUsableCheckableIntent } from "@/lib/compliance/draft-guard";
import { POLICY_PRINCIPLES } from "@/lib/compliance/principles";
import {
  COMPONENT_LABELS,
  HARNESS_COMPONENTS,
  type HarnessComponent,
  type Severity,
} from "@/lib/types";
import { fieldClass, type GeneratedDraft } from "./types";

export function PolicyGenerator({
  onClose,
  onCreated,
  onManual,
}: {
  onClose: () => void;
  onCreated: (policyId: string) => void;
  onManual: () => void;
}) {
  const intentRef = useRef<HTMLTextAreaElement>(null);
  const [intent, setIntent] = useState("");
  const [hint, setHint] = useState("");
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [generation, setGeneration] = useState(0);
  const [name, setName] = useState("");
  const [statement, setStatement] = useState("");
  const [checkableIntent, setCheckableIntent] = useState("");
  const [severity, setSeverity] = useState<Severity>("warning");
  const [principle, setPrinciple] = useState<(typeof POLICY_PRINCIPLES)[number]>(POLICY_PRINCIPLES[0]);
  const [components, setComponents] = useState<HarnessComponent[]>([]);
  const [busy, setBusy] = useState<"draft" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    intentRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyDraft(next: GeneratedDraft) {
    setDraft(next);
    setGeneration((current) => current + 1);
    setName(next.name);
    setStatement(next.statement);
    setCheckableIntent(next.checkableIntent);
    setSeverity(next.severity);
    setPrinciple(next.principle);
    setComponents(next.components);
    setAccepted(false);
  }

  async function draftPolicy() {
    setBusy("draft");
    setError(null);
    try {
      const res = await fetch("/api/policies/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, principle: hint || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (!data || data.persisted !== false || typeof data.checkableIntent !== "string" || typeof data.summary !== "string") {
        throw new Error("The draft came back incomplete. Try again.");
      }
      applyDraft(data as GeneratedDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  function toggle(component: HarnessComponent) {
    setComponents((current) =>
      current.includes(component) ? current.filter((item) => item !== component) : [...current, component]
    );
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy("save");
    setError(null);
    try {
      // TODO(next): run conflict-check against active policies and offer dry-run preview before activation
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          statement,
          checkableIntent,
          severity,
          principle,
          components,
          frameworks: draft.frameworks,
          source: "generated",
          confidence: draft.confidence,
          generationNote: draft.generationNote,
          uncertaintyAccepted: accepted,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.status !== "draft") throw new Error("The policy was not saved as a draft.");
      onCreated(data.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const low = draft?.confidence === "low";
  const summary =
    draft && statement.trim() === draft.statement.trim()
      ? draft.summary
      : statement.trim()
        ? `Ballast will verify: ${statement.trim()}`
        : draft?.summary;
  const intentEdited = draft ? checkableIntent.trim() !== draft.checkableIntent.trim() : false;
  const canSave =
    draft !== null &&
    isUsableCheckableIntent(checkableIntent) &&
    name.trim().length > 0 &&
    statement.trim().length > 0 &&
    components.length > 0 &&
    (!low || accepted) &&
    busy === null;

  return (
    <form onSubmit={confirm} className="space-y-4 panel p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-medium">Describe the policy</h2>
        <p className="mt-1 text-sm text-muted">
          Write what you want to ensure, in plain English. Ballast drafts a checkable policy and shows you exactly
          what it would verify. Nothing is saved until you confirm, and a confirmed policy starts as a draft.
        </p>
      </div>

      <label className="block text-xs text-muted">
        What should be true
        <textarea
          ref={intentRef}
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          required
          maxLength={4000}
          placeholder="Our agents shouldn't be able to spend money or issue refunds without a human approving it."
          className={`${fieldClass} h-28 resize-y`}
        />
      </label>

      <label className="block text-xs text-muted">
        Category
        <span className="text-faint"> (optional — Ballast can infer it)</span>
        <select value={hint} onChange={(event) => setHint(event.target.value)} className={fieldClass}>
          <option value="">Infer from what I wrote</option>
          {POLICY_PRINCIPLES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={draftPolicy}
          disabled={busy !== null || intent.trim().length === 0}
          className="btn btn-primary"
        >
          {busy === "draft" ? "Drafting…" : draft ? "Draft again" : "Draft a policy"}
        </button>
        <button type="button" onClick={onManual} className="rounded-sm px-3 py-2 text-sm text-muted hover:text-foreground">
          Write the checkable condition yourself
        </button>
      </div>

      {draft && summary && (
        <Review
          key={generation}
          draft={draft}
          summary={summary}
          name={name}
          statement={statement}
          checkableIntent={checkableIntent}
          severity={severity}
          principle={principle}
          components={components}
          low={low}
          accepted={accepted}
          intentEdited={intentEdited}
          onName={setName}
          onStatement={setStatement}
          onCheckableIntent={setCheckableIntent}
          onSeverity={setSeverity}
          onPrinciple={setPrinciple}
          onToggle={toggle}
          onAccepted={setAccepted}
        />
      )}

      {error && <p className="text-xs text-critical">{error}</p>}

      {draft && (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!canSave}
            className="btn btn-primary"
          >
            {busy === "save" ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-edge px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}

function Review({
  draft,
  summary,
  name,
  statement,
  checkableIntent,
  severity,
  principle,
  components,
  low,
  accepted,
  intentEdited,
  onName,
  onStatement,
  onCheckableIntent,
  onSeverity,
  onPrinciple,
  onToggle,
  onAccepted,
}: {
  draft: GeneratedDraft;
  summary: string;
  name: string;
  statement: string;
  checkableIntent: string;
  severity: Severity;
  principle: (typeof POLICY_PRINCIPLES)[number];
  components: HarnessComponent[];
  low: boolean;
  accepted: boolean;
  intentEdited: boolean;
  onName: (value: string) => void;
  onStatement: (value: string) => void;
  onCheckableIntent: (value: string) => void;
  onSeverity: (value: Severity) => void;
  onPrinciple: (value: (typeof POLICY_PRINCIPLES)[number]) => void;
  onToggle: (component: HarnessComponent) => void;
  onAccepted: (value: boolean) => void;
}) {
  const detailId = useId();
  const [detailOpen, setDetailOpen] = useState(low);
  return (
    <div className="space-y-4 border-t border-edge pt-4">
      {low && draft.generationNote && (
        <div role="status" className="rounded-sm border border-warning/40 bg-warning-dim px-3 py-2 text-sm text-foreground">
          {draft.generationNote}
        </div>
      )}

      <div>
        <p className="eyebrow">What Ballast will check</p>
        <p className="mt-1 text-sm text-foreground">{summary}</p>
      </div>

      <label className="block text-xs text-muted">
        Name
        <input value={name} onChange={(event) => onName(event.target.value)} required className={fieldClass} />
      </label>
      <label className="block text-xs text-muted">
        Statement
        <textarea
          value={statement}
          onChange={(event) => onStatement(event.target.value)}
          required
          className={`${fieldClass} h-24 resize-y`}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          Category
          <select
            value={principle}
            onChange={(event) => onPrinciple(event.target.value as (typeof POLICY_PRINCIPLES)[number])}
            className={fieldClass}
          >
            {POLICY_PRINCIPLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Severity
          <select
            value={severity}
            onChange={(event) => onSeverity(event.target.value as Severity)}
            className={fieldClass}
          >
            <option value="critical">critical</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
          </select>
        </label>
      </div>

      <details
        id={detailId}
        open={detailOpen}
        onToggle={(event) => setDetailOpen(event.currentTarget.open)}
        className="rounded-sm border border-edge bg-background"
      >
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
          See exactly what this checks
        </summary>
        <div className="space-y-4 border-t border-edge px-3 py-3">
          <label className="block text-xs text-muted">
            Checkable condition
            <textarea
              value={checkableIntent}
              onChange={(event) => onCheckableIntent(event.target.value)}
              required
              className={`${fieldClass} h-32 resize-y`}
            />
            <span className="mt-1 block text-[11px] text-faint">
              This is the condition Ballast would verify. Edit it if it doesn’t match what you meant.
            </span>
          </label>

          <fieldset>
            <legend className="text-xs text-muted">Harness components it evaluates</legend>
            {draft.components.length === 0 && (
              <p className="mt-1 text-[11px] text-faint">
                No component was a reliable match. Choose one only if you still want to save this draft.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {HARNESS_COMPONENTS.map((component) => (
                <label key={component} className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={components.includes(component)} onChange={() => onToggle(component)} />
                  {COMPONENT_LABELS[component]}
                </label>
              ))}
            </div>
          </fieldset>

          {draft.frameworks.length > 0 && (
            <p className="text-xs text-muted">
              Frameworks: <span className="text-foreground">{draft.frameworks.join(", ")}</span>
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ScopeList title="What is checked" items={intentEdited ? ["The checkable condition you edited above."] : draft.checks} />
            <ScopeList
              title="What is not checked"
              items={
                intentEdited
                  ? ["Scope notes below describe the generated draft. The text you edited is what would be saved."]
                  : draft.doesNotCheck
              }
            />
          </div>

          <div>
            <h3 className="text-xs font-medium text-foreground">How a harness is judged</h3>
            <dl className="mt-2 space-y-2 text-xs text-muted">
              <div>
                <dt className="text-foreground">Compliant</dt>
                <dd>{draft.verdictLogic.compliant}</dd>
              </div>
              <div>
                <dt className="text-foreground">Violated</dt>
                <dd>{draft.verdictLogic.violated}</dd>
              </div>
              <div>
                <dt className="text-foreground">Cannot determine</dt>
                <dd>{draft.verdictLogic.cannotDetermine}</dd>
              </div>
            </dl>
          </div>
        </div>
      </details>

      {low && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={accepted}
            onChange={(event) => onAccepted(event.target.checked)}
          />
          <span>I understand this may often return “cannot determine,” and I still want to save it as a draft.</span>
        </label>
      )}
    </div>
  );
}

function ScopeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-faint">Nothing listed.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
