import type { Finding } from "@/lib/types";
import { SeverityBadge } from "./SeverityBadge";

/**
 * A single finding: severity, title, description, affected element,
 * recommendation — and for two-sided evidence (verified conflicts),
 * the two contradicting rules rendered side by side.
 */
export function FindingCard({ finding }: { finding: Finding }) {
  const isConflictPair = finding.evidence?.length === 2 && finding.title.toLowerCase().includes("contradict");

  return (
    <article className="rounded-md border border-edge bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <SeverityBadge severity={finding.severity} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{finding.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{finding.description}</p>

          {/* Evidence */}
          {finding.evidence && finding.evidence.length > 0 && (
            isConflictPair ? (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {finding.evidence.map((rule, i) => (
                  <blockquote
                    key={i}
                    className="rounded-sm border border-critical/30 bg-critical-dim/60 p-3"
                  >
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-critical">
                      Rule {i === 0 ? "A" : "B"}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                      &ldquo;{rule}&rdquo;
                    </p>
                  </blockquote>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                {finding.evidence.map((item, i) => (
                  <blockquote
                    key={i}
                    className="border-l-2 border-edge-strong bg-surface-raised px-3 py-1.5 text-xs leading-relaxed text-muted"
                  >
                    &ldquo;{item}&rdquo;
                  </blockquote>
                ))}
              </div>
            )
          )}

          {/* Affected element (skip when evidence already shows it verbatim) */}
          {!finding.evidence?.length && (
            <p className="mt-3 break-words font-mono text-xs text-faint">
              {finding.affectedElement}
            </p>
          )}

          {/* Recommendation */}
          <div className="mt-3 rounded-sm border border-edge bg-surface-raised px-3 py-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
              Recommended fix
            </p>
            <p className="mt-1 text-sm leading-relaxed">{finding.recommendation}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
