"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import type { Severity } from "@/lib/types";
import { COMPONENT_LABELS, COMPONENT_DESCRIPTIONS } from "@/lib/types";
import {
  getReportSnapshot,
  getServerReportSnapshot,
  subscribeReport,
} from "@/lib/report-store";
import {
  BAND_TEXT_CLASS,
  headlineSummary,
  scoreBand,
  verdictLine,
  worstSeverity,
} from "@/lib/format";
import { Header } from "@/components/Header";
import { ScoreRing } from "@/components/ScoreRing";

const CARD_ACCENT: Record<Severity, string> = {
  critical: "border-l-critical",
  warning: "border-l-warning",
  info: "border-l-info",
};

export default function ReportPage() {
  const report = useSyncExternalStore(subscribeReport, getReportSnapshot, getServerReportSnapshot);

  // undefined = still hydrating; render nothing for one frame.
  if (report === undefined) return null;

  if (!report) {
    return (
      <>
        <Header />
        <div className="mx-auto w-full max-w-6xl p-6">
          <div className="rounded-md border border-edge bg-surface p-8 text-center">
            <p className="text-sm text-muted">No analysis in this session.</p>
            <Link
              href="/"
              className="mt-3 inline-block rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Analyze a harness
            </Link>
          </div>
        </div>
      </>
    );
  }

  const band = scoreBand(report.overallHealthScore);
  const stats: { label: string; value: number; alarm?: boolean }[] = [
    { label: "Instructions", value: report.meta.instructionCount },
    { label: "Absolute rules", value: report.meta.absoluteRuleCount },
    { label: "Fossils", value: report.meta.fossilCount, alarm: report.meta.fossilCount > 0 },
    {
      label: "Verified conflicts",
      value: report.meta.verifiedConflictCount,
      alarm: report.meta.verifiedConflictCount > 0,
    },
  ];

  return (
    <>
      <Header
        right={
          <Link href="/" className="text-xs text-muted hover:text-foreground">
            New analysis
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
        {/* Overall score + verdict */}
        <section className="flex flex-col items-center gap-6 rounded-md border border-edge bg-surface p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8">
          <ScoreRing score={report.overallHealthScore} />
          <div className="max-w-2xl text-center sm:text-left">
            <p className={`font-mono text-[11px] font-semibold uppercase tracking-widest ${BAND_TEXT_CLASS[band]}`}>
              {band === "healthy" ? "Healthy" : band === "degraded" ? "Degraded" : "At risk"}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {verdictLine(report)}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{headlineSummary(report)}</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-faint">
              Analyzed {new Date(report.meta.createdAt).toLocaleString()}
            </p>
          </div>
        </section>

        {/* Headline stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md border border-edge bg-surface px-4 py-3">
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  s.alarm ? "text-critical" : "text-foreground"
                }`}
              >
                {s.value}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-faint">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* Six component cards */}
        <section>
          <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
            Harness components
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.components.map((c) => {
              const worst = worstSeverity(c);
              const cardBand = scoreBand(c.healthScore);
              return (
                <Link
                  key={c.component}
                  href={`/report/${c.component}`}
                  className={`group rounded-md border border-edge border-l-2 bg-surface p-4 transition-colors hover:border-edge-strong hover:bg-surface-raised ${
                    worst ? CARD_ACCENT[worst] : "border-l-healthy"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{COMPONENT_LABELS[c.component]}</h3>
                      <p className="mt-0.5 text-xs text-faint">
                        {COMPONENT_DESCRIPTIONS[c.component]}
                      </p>
                    </div>
                    <span
                      className={`text-lg font-semibold tabular-nums ${BAND_TEXT_CLASS[cardBand]}`}
                    >
                      {c.healthScore}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {c.findings.length === 0 ? (
                      <span className="text-xs font-medium text-healthy">Healthy — no findings</span>
                    ) : (
                      <span className="text-xs text-muted">
                        {c.findings.length} finding{c.findings.length === 1 ? "" : "s"}
                        {worst === "critical" && (
                          <span className="text-critical"> · critical</span>
                        )}
                      </span>
                    )}
                    <span className="text-xs text-faint transition-colors group-hover:text-muted">
                      View →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
