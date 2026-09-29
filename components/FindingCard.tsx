"use client";

import Link from "next/link";
import type { Finding } from "@/lib/types";
import { CATEGORY_LABELS, COMPONENT_LABELS } from "@/lib/types";
import { SeverityBadge } from "./SeverityBadge";
import { useReportLinks } from "@/components/report/ReportLinks";

/**
 * A single finding: severity, title, description, affected element,
 * recommendation — and for two-sided evidence (verified conflicts),
 * the two contradicting rules rendered side by side.
 */
export function FindingCard({
  finding,
  showComponent = false,
}: {
  finding: Finding;
  showComponent?: boolean;
}) {
  const links = useReportLinks();
  const isConflictPair = finding.evidence?.length === 2 && finding.title.toLowerCase().includes("contradict");

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <SeverityBadge severity={finding.severity} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug tracking-tight">{finding.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {showComponent && (
              <Link href={links.component(finding.component)} className="eyebrow text-accent hover:text-foreground">
                {COMPONENT_LABELS[finding.component]}
              </Link>
            )}
            <span className="eyebrow">Audit · {CATEGORY_LABELS[finding.category] ?? "Structural audit"}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{finding.description}</p>

          {finding.evidence && finding.evidence.length > 0 ? (
            <div className="mt-4">
              <p className="eyebrow mb-2">Reference</p>
              {isConflictPair ? (
                <div className="grid grid-cols-1 gap-0 border border-edge sm:grid-cols-2">
                  {finding.evidence.map((rule, i) => (
                    <blockquote
                      key={i}
                      className={`border-critical/25 bg-critical-dim/50 p-3 ${i === 0 ? "border-b sm:border-b-0 sm:border-r" : ""} border-edge`}
                    >
                      <p className="eyebrow text-critical">Rule {i === 0 ? "A" : "B"}</p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground">&ldquo;{rule}&rdquo;</p>
                    </blockquote>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {finding.evidence.map((item, i) => (
                    <blockquote
                      key={i}
                      className="border-l-2 border-edge-strong bg-surface-raised px-3 py-1.5 text-xs leading-relaxed text-muted"
                    >
                      &ldquo;{item}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <p className="eyebrow mb-1">Reference</p>
              <p className="break-words font-mono text-xs text-muted">{finding.affectedElement}</p>
            </div>
          )}

          <div className="mt-4 border border-edge bg-surface-raised px-3 py-2.5">
            <p className="eyebrow text-accent">Recommended fix</p>
            <p className="mt-1.5 text-sm leading-relaxed">{finding.recommendation}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
