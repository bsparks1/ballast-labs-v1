"use client";

import { useEffect, useRef, useState } from "react";
import { POLICY_PRINCIPLES } from "@/lib/compliance/principles";
import { COMPONENT_LABELS, HARNESS_COMPONENTS, type HarnessComponent, type Severity } from "@/lib/types";
import { PolicyGenerator } from "./PolicyGenerator";
import { fieldClass } from "./types";

export function CustomPolicyPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (policyId: string) => void;
}) {
  const [mode, setMode] = useState<"guided" | "manual">("guided");
  if (mode === "guided") {
    return <PolicyGenerator onClose={onClose} onCreated={onCreated} onManual={() => setMode("manual")} />;
  }
  return <ManualPolicyForm onClose={onClose} onCreated={onCreated} onGuided={() => setMode("guided")} />;
}

function ManualPolicyForm({
  onClose,
  onCreated,
  onGuided,
}: {
  onClose: () => void;
  onCreated: (policyId: string) => void;
  onGuided: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [statement, setStatement] = useState("");
  const [checkableIntent, setCheckableIntent] = useState("");
  const [principle, setPrinciple] = useState<(typeof POLICY_PRINCIPLES)[number]>(POLICY_PRINCIPLES[0]);
  const [severity, setSeverity] = useState<Severity>("warning");
  const [components, setComponents] = useState<HarnessComponent[]>(["instructions"]);
  const [frameworks, setFrameworks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(component: HarnessComponent) {
    setComponents((current) =>
      current.includes(component) ? current.filter((item) => item !== component) : [...current, component]
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
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
          frameworks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onCreated(data.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 panel p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-medium">Write a policy yourself</h2>
        <p className="mt-1 text-sm text-muted">
          New policies start as drafts. Set one to Active when you want Ballast to check it. The statement is what
          people read. The checkable intent is the condition the engine verifies.
        </p>
        <button type="button" onClick={onGuided} className="mt-2 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">
          Describe it in plain English instead
        </button>
      </div>
      <label className="block text-xs text-muted">
        Name
        <input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} required className={fieldClass} />
      </label>
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
        <span className="mt-1 block text-[11px] text-faint">
          This is the condition the engine verifies. It is saved only when you submit, and it starts as a draft.
        </span>
      </label>
      <label className="block text-xs text-muted">
        Category
        <select
          value={principle}
          onChange={(event) => setPrinciple(event.target.value as (typeof POLICY_PRINCIPLES)[number])}
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
          onChange={(event) => setSeverity(event.target.value as Severity)}
          className={fieldClass}
        >
          <option value="critical">critical</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-xs text-muted">Components it maps to</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {HARNESS_COMPONENTS.map((component) => (
            <label key={component} className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={components.includes(component)} onChange={() => toggle(component)} />
              {COMPONENT_LABELS[component]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs text-muted">
        Frameworks
        <span className="text-faint"> (optional, comma separated)</span>
        <input
          value={frameworks}
          onChange={(event) => setFrameworks(event.target.value)}
          placeholder="OWASP LLM06, EU AI Act Art. 14"
          className={fieldClass}
        />
      </label>
      {error && <p className="text-xs text-critical">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
        >
          {busy ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-edge px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
