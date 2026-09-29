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
import { FadeIn } from "@/components/ui/FadeIn";
import { Grain } from "@/components/ui/Grain";
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
    <div className="space-y-0">
      <Grain as="section" className="hero-cinematic panel-dark mb-0">
        <div className="relative z-[2] flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-10">
          <ScoreRing score={report.overallHealthScore} band={band} />
          <div className="max-w-2xl text-center sm:text-left">
            <p className={`eyebrow ${BAND_TEXT_CLASS[band]}`}>{BAND_LABEL[band]}</p>
            <h1 className="display-md mt-2 text-paper">{verdictLine(report)}</h1>
            {analysisIncomplete(report) && (
              <p className="mt-3 rounded-[2px] border border-warning/40 bg-warning-dim/40 px-3 py-2 text-sm text-warning">
                Analysis incomplete — some checks did not complete
                {incompletePasses(report).length > 0
                  ? ` (${incompletePasses(report)
                      .map((p) => p.label)
                      .join(", ")}).`
                  : "."}{" "}
                Findings from finished passes are shown; this is not a clean bill of health.
              </p>
            )}
            <p className="mt-3 text-[15px] leading-relaxed text-paper/65">{headlineSummary(report)}</p>
            <p className="eyebrow mt-5 text-paper/40">
              Analyzed {new Date(report.meta.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </Grain>

      <section className="grid grid-cols-2 border-x border-b border-edge sm:grid-cols-5">
        {stats.map((s, i) => {
          const group = STAT_GROUPS[s.id];
          return (
            <Link
              key={s.id}
              href={links.group(s.id)}
              className={`group border-edge px-4 py-5 no-underline transition-colors duration-300 hover:bg-surface-raised ${
                i < stats.length - 1 ? "border-r" : ""
              } ${i < 2 ? "border-b sm:border-b-0" : ""} ${i === 1 ? "sm:border-r" : ""}`}
            >
              <p className={`stat-num ${s.alarm ? "text-critical" : "text-foreground"}`}>{s.value}</p>
              <p className="eyebrow mt-2">{group.label}</p>
              <p className="eyebrow mt-3 text-faint transition-colors group-hover:text-muted">View →</p>
            </Link>
          );
        })}
      </section>

      <FadeIn as="section" className="border-b border-edge pt-10 pb-2">
        <p className="eyebrow mb-6">Harness components</p>
        <div className="grid grid-cols-1 border-t border-edge sm:grid-cols-2 lg:grid-cols-3">
          {report.components.map((c) => {
            const notApplicable = c.status === "not_applicable";
            const worst = worstSeverity(c);
            const cardBand = scoreBand(c.healthScore);
            return (
              <Link
                key={c.component}
                href={links.component(c.component)}
                className={`group border-b border-r border-edge border-l-2 bg-surface p-5 no-underline transition-colors duration-300 hover:bg-surface-raised ${
                  notApplicable ? "border-l-faint" : worst ? CARD_ACCENT[worst] : "border-l-healthy"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium tracking-tight">{COMPONENT_LABELS[c.component]}</h3>
                    <p className="mt-1 text-xs text-faint">{COMPONENT_DESCRIPTIONS[c.component]}</p>
                  </div>
                  {notApplicable ? (
                    <span className="eyebrow">N/A</span>
                  ) : (
                    <span className={`stat-num text-xl ${BAND_TEXT_CLASS[cardBand]}`}>{c.healthScore}</span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
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
      </FadeIn>
    </div>
  );
}
