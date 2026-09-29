import type { PolicyVerdict } from "@/lib/types";

const STYLE: Record<PolicyVerdict, string> = {
  compliant: "border-healthy/40 bg-healthy-dim text-healthy",
  violated: "border-critical/40 bg-critical-dim text-critical",
  cannot_determine: "border-warning/40 bg-warning-dim text-warning",
};

const LABEL: Record<PolicyVerdict, string> = {
  compliant: "Compliant",
  violated: "Violated",
  cannot_determine: "Cannot determine",
};

export function VerdictBadge({
  verdict,
  expanded = false,
  controls,
  onToggle,
}: {
  verdict: PolicyVerdict;
  expanded?: boolean;
  controls?: string;
  onToggle?: () => void;
}) {
  const className = `inline-flex items-center rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${STYLE[verdict]}`;
  if (!onToggle) {
    return <span className={className}>{LABEL[verdict]}</span>;
  }
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={expanded ? `Hide why this is ${LABEL[verdict].toLowerCase()}` : `Show why this is ${LABEL[verdict].toLowerCase()}`}
      onClick={onToggle}
      className={`${className} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        expanded ? "ring-1 ring-current" : ""
      }`}
    >
      {LABEL[verdict]}
    </button>
  );
}
