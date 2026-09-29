import type { PolicyVerdict } from "@/lib/types";

const COPY: Record<
  PolicyVerdict,
  { title: string; evidence: string; action: string; empty: string; box: string; titleClass: string }
> = {
  violated: {
    title: "Why this is violated",
    evidence: "What in the harness did it",
    action: "What to change",
    empty: "Ballast marked this violated but did not record why.",
    box: "border-critical/40 bg-critical-dim",
    titleClass: "text-critical",
  },
  compliant: {
    title: "Why this is compliant",
    evidence: "What in the harness satisfies it",
    action: "What to keep",
    empty: "Ballast marked this compliant but did not record why.",
    box: "border-healthy/40 bg-healthy-dim",
    titleClass: "text-healthy",
  },
  cannot_determine: {
    title: "Why this cannot be determined",
    evidence: "What in the harness did it",
    action: "What to change",
    empty: "Ballast could not determine this but did not record why.",
    box: "border-warning/40 bg-warning-dim",
    titleClass: "text-warning",
  },
};

export function VerdictExplanation({
  verdict,
  reasoning,
  evidence,
  recommendation,
  harnessName,
}: {
  verdict: PolicyVerdict;
  reasoning: string;
  evidence: string[];
  recommendation: string;
  harnessName?: string | null;
}) {
  const copy = COPY[verdict];
  return (
    <div className={`rounded-sm border px-3 py-3 text-sm ${copy.box}`}>
      <p className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${copy.titleClass}`}>{copy.title}</p>
      <p className="mt-1 text-foreground">{reasoning.trim() || copy.empty}</p>
      {evidence.length > 0 ? (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-faint">{copy.evidence}</p>
          <ul className="mt-1 space-y-1">
            {evidence.map((quote) => (
              <li key={quote} className="rounded-sm border border-edge bg-background px-3 py-2 font-mono text-xs text-foreground">
                {quote}
              </li>
            ))}
          </ul>
        </div>
      ) : verdict === "cannot_determine" ? (
        <p className="mt-3 text-warning">
          No evidence in the harness. Silence is not compliance — if you believe this control exists, it is not in the
          config.
        </p>
      ) : null}
      {recommendation.trim() && (
        <p className="mt-3 text-muted">
          <span className="font-mono text-[10px] uppercase tracking-widest text-faint">{copy.action} · </span>
          {recommendation}
        </p>
      )}
      {harnessName && <p className="mt-2 text-xs text-faint">Checked against {harnessName}.</p>}
    </div>
  );
}
