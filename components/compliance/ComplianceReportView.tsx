import Link from "next/link";
import { CheckResultRow } from "@/components/compliance/CheckResultRow";
import type { ComplianceReportRecord } from "@/lib/db";
import type { PolicyVerdict } from "@/lib/types";

const ORDER: PolicyVerdict[] = ["violated", "cannot_determine", "compliant"];

function visibleHistory<T extends { headline: string | null }>(history: T[]): T[] {
  const newestFirst = [...history].reverse();
  const kept: T[] = [];
  let skippedUnchanged = false;
  for (const entry of newestFirst) {
    const unchanged = entry.headline === "No change in compliance verdicts since the last check.";
    if (unchanged && skippedUnchanged) continue;
    if (unchanged) skippedUnchanged = true;
    kept.push(entry);
    if (kept.length >= 6) break;
  }
  return kept;
}

const SECTION: Record<PolicyVerdict, { title: string; blurb: string }> = {
  violated: {
    title: "Violations",
    blurb: "The harness contains a rule or permission that breaks the policy.",
  },
  cannot_determine: {
    title: "Gaps — harness is silent",
    blurb:
      "Cannot determine means the harness never addresses this policy. You may believe you have the control, but it is not in the config. That is a gap, not a pass.",
  },
  compliant: {
    title: "Compliant",
    blurb: "The harness quotes a specific rule or setting that satisfies the policy.",
  },
};

export function ComplianceReportView({
  harnessId,
  versionNumber,
  report,
  history,
}: {
  harnessId: string;
  versionNumber: number;
  report: ComplianceReportRecord;
  history: { id: string; versionNumber: number; generatedAt: string; overallStatus: string; headline: string | null }[];
}) {
  const { summary } = report;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p suppressHydrationWarning className="eyebrow">
            Version {versionNumber} · {report.generatedAt.toLocaleString()}
          </p>
          <h2 className="mt-1 text-lg font-medium tracking-tight">
            {summary.violated} violated · {summary.cannotDetermine} gaps · {summary.compliant} compliant
          </h2>
        </div>
        <Link
          href={`/api/harnesses/${harnessId}/compliance/export?version=${versionNumber}`}
          className="btn btn-secondary btn-xs"
        >
          Export report
        </Link>
      </div>

      {report.delta?.previousGeneratedAt && (
        <section className="panel px-4 py-3">
          <p className="text-sm text-foreground">{report.delta.headline}</p>
          {report.delta.notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {report.delta.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {ORDER.map((verdict) => {
        const rows = report.results.filter((r) => r.verdict === verdict);
        const section = SECTION[verdict];
        return (
          <section key={verdict} className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">{section.title}</h3>
              <p className="mt-1 text-sm text-muted">{section.blurb}</p>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-faint">None.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.policyId}>
                    <CheckResultRow row={row} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {history.length > 1 && (
        <section>
          <h3 className="text-sm font-medium">Compliance history</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {visibleHistory(history).map((entry) => (
              <li key={entry.id} suppressHydrationWarning>
                v{entry.versionNumber} · {new Date(entry.generatedAt).toLocaleString()} ·{" "}
                {entry.overallStatus.replaceAll("_", " ")}
                {entry.headline ? ` · ${entry.headline}` : ""}
              </li>
            ))}
          </ul>
          {history.length > 6 && (
            <p className="mt-2 text-xs text-faint">
              {history.length} checks stored. Unchanged re-checks are collapsed; the full set is in the database.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

