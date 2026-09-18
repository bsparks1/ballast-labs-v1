"use client";

import Link from "next/link";
import type { HarnessReport, Severity } from "@/lib/types";
import { COMPONENT_LABELS, COMPONENT_DESCRIPTIONS } from "@/lib/types";
import {
  BAND_LABEL,
  BAND_TEXT_CLASS,
  analysisIncomplete,
  headlineSummary,
  incompletePasses,
  reportBand,
  scoreBand,
  verdictLine,
  worstSeverity,
} from "@/lib/format";
import { ScoreRing } from "@/components/ScoreRing";
import { STAT_GROUPS, findingsForGroup, instructionsForGroup, type StatGroupId } from "@/lib/stat-groups";
import { useReportLinks } from "./ReportLinks";

const CARD_ACCENT: Record<Severity, string> = {
  critical: "border-l-critical",
  warning: "border-l-warning",
  info: "border-l-info",
};

export function ReportOverview({ report }: { report: HarnessReport }) {
  const links = useReportLinks();
  const band = reportBand(report);
  const instructionCount = instructionsForGroup(report, "instructions").length;
  const absoluteCount = instructionsForGroup(report, "absolute-rules").length;
  const fossilCount = instructionsForGroup(report, "fossils").length;
  const conflictCount = findingsForGroup(report, "verified-conflicts").length;
  const criticalCount = findingsForGroup(report, "critical-findings").length;
  const stats: { id: StatGroupId; value: number; alarm?: boolean }[] = [
    { id: "instructions", value: instructionCount },
    { id: "absolute-rules", value: absoluteCount },
    { id: "fossils", value: fossilCount, alarm: fossilCount > 0 },
    { id: "verified-conflicts", value: conflictCount, alarm: conflictCount > 0 },
    { id: "critical-findings", value: criticalCount, alarm: criticalCount > 0 },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-center gap-6 rounded-md border border-edge bg-surface p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8">
        <ScoreRing score={report.overallHealthScore} band={band} />
        <div className="max-w-2xl text-center sm:text-left">
          <p className={`font-mono text-[11px] font-semibold uppercase tracking-widest ${BAND_TEXT_CLASS[band]}`}>
            {BAND_LABEL[band]}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{verdictLine(report)}</h1>
          {analysisIncomplete(report) && (
            <p className="mt-2 rounded-sm border border-warning/40 bg-warning-dim px-3 py-2 text-sm text-warning">
              Analysis incomplete — some checks did not complete
              {incompletePasses(report).length > 0
                ? ` (${incompletePasses(report)
                    .map((p) => p.label)
                    .join(", ")}).`
                : "."}{" "}
              Findings from finished passes are shown; this is not a clean bill of health.
            </p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-muted">{headlineSummary(report)}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-faint">
            Analyzed {new Date(report.meta.createdAt).toLocaleString()}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => {
          const group = STAT_GROUPS[s.id];
          return (
            <Link
              key={s.id}
              href={links.group(s.id)}
              className="group rounded-md border border-edge bg-surface px-4 py-3 transition-colors hover:border-edge-strong hover:bg-surface-raised"
            >
              <p className={`text-2xl font-semibold tabular-nums ${s.alarm ? "text-critical" : "text-foreground"}`}>
                {s.value}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-faint">{group.label}</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-faint transition-colors group-hover:text-muted">
                View →
              </p>
            </Link>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
          Harness components
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.components.map((c) => {
            const notApplicable = c.status === "not_applicable";
            const worst = worstSeverity(c);
            const cardBand = scoreBand(c.healthScore);
            return (
              <Link
                key={c.component}
                href={links.component(c.component)}
                className={`group rounded-md border border-edge border-l-2 bg-surface p-4 transition-colors hover:border-edge-strong hover:bg-surface-raised ${
                  notApplicable ? "border-l-faint" : worst ? CARD_ACCENT[worst] : "border-l-healthy"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{COMPONENT_LABELS[c.component]}</h3>
                    <p className="mt-0.5 text-xs text-faint">{COMPONENT_DESCRIPTIONS[c.component]}</p>
                  </div>
                  {notApplicable ? (
                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-faint">N/A</span>
                  ) : (
                    <span className={`text-lg font-semibold tabular-nums ${BAND_TEXT_CLASS[cardBand]}`}>
                      {c.healthScore}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {notApplicable ? (
                    <span className="text-xs font-medium text-faint">N/A — not present in this harness</span>
                  ) : c.findings.length === 0 ? (
                    <span className="text-xs font-medium text-healthy">Healthy — no findings</span>
                  ) : (
                    <span className="text-xs text-muted">
                      {c.findings.length} finding{c.findings.length === 1 ? "" : "s"}
                      {worst === "critical" && <span className="text-critical"> · critical</span>}
                    </span>
                  )}
                  <span className="text-xs text-faint transition-colors group-hover:text-muted">View →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
