/** Presentation helpers shared by the dashboard and drill-down views. */

import type { ComponentReport, HarnessReport, PassStatus, Severity } from "@/lib/types";

export type ScoreBand = "clean" | "minor" | "functional" | "gaps" | "serious";

export function scoreBand(score: number): ScoreBand {
  if (score >= 90) return "clean";
  if (score >= 79) return "minor";
  if (score >= 61) return "functional";
  if (score >= 41) return "gaps";
  return "serious";
}

/** Band for the report header: incomplete analysis is never labeled Clean. */
export function reportBand(report: HarnessReport): ScoreBand {
  const band = scoreBand(report.overallHealthScore);
  if (analysisIncomplete(report) && band === "clean") return "minor";
  return band;
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  clean: "Clean",
  minor: "Solid — minor hardening",
  functional: "Hardening needed",
  gaps: "Significant gaps",
  serious: "Serious issues",
};

export const BAND_TEXT_CLASS: Record<ScoreBand, string> = {
  clean: "text-healthy",
  minor: "text-info",
  functional: "text-warning",
  gaps: "text-warning",
  serious: "text-critical",
};

export const SEVERITY_TEXT_CLASS: Record<Severity, string> = {
  critical: "text-critical",
  warning: "text-warning",
  info: "text-info",
};

export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  critical: "bg-critical-dim text-critical border-critical/40",
  warning: "bg-warning-dim text-warning border-warning/40",
  info: "bg-info-dim text-info border-info/40",
};

export function worstSeverity(c: ComponentReport): Severity | null {
  if (c.status === "not_applicable") return null;
  if (c.findings.some((f) => f.severity === "critical")) return "critical";
  if (c.findings.some((f) => f.severity === "warning")) return "warning";
  if (c.findings.length > 0) return "info";
  return null;
}

export function analysisIncomplete(report: HarnessReport): boolean {
  return (report.passes ?? []).some((p) => p.status !== "ok");
}

export function incompletePasses(report: HarnessReport): PassStatus[] {
  return (report.passes ?? []).filter((p) => p.status !== "ok");
}

/** One-line verdict for the top of the dashboard. */
export function verdictLine(report: HarnessReport): string {
  const criticals = report.meta.criticalFindingCount ??
    report.components.reduce((n, c) => n + c.findings.filter((f) => f.severity === "critical").length, 0);
  const band = scoreBand(report.overallHealthScore);

  if (criticals > 0 || band === "serious") {
    return "Serious issues — do not ship as-is";
  }
  if (band === "clean") {
    return "Clean — rare, genuinely well-governed";
  }
  if (band === "minor") {
    return "Solid — minor hardening";
  }
  if (band === "functional") {
    return "Functional but with real hardening needed";
  }
  return "Significant gaps — needs work before production";
}

/**
 * The value-moment sentence: a plain-English summary of what the audit found.
 */
export function headlineSummary(report: HarnessReport): string {
  const { instructionCount, fossilCount, verifiedConflictCount, criticalFindingCount } = report.meta;
  const parts: string[] = [`Your agent has ${instructionCount} instruction${instructionCount === 1 ? "" : "s"}.`];

  if ((criticalFindingCount ?? 0) > 0) {
    parts.push(
      `${criticalFindingCount} critical finding${criticalFindingCount === 1 ? "" : "s"} — this configuration is not healthy.`
    );
  }
  if (verifiedConflictCount > 0) {
    parts.push(
      verifiedConflictCount === 1
        ? "2 of them directly contradict each other."
        : `${verifiedConflictCount} pairs directly contradict each other.`
    );
  }
  if (fossilCount > 0) {
    parts.push(`${fossilCount} do nothing.`);
  }

  const toolsComponent = report.components.find((c) => c.component === "tools");
  const riskyTools = (toolsComponent?.tools ?? []).filter(
    (t) =>
      t.exercised !== true &&
      t.permissions.some((p) => ["write", "delete", "execute", "deploy", "admin", "export"].includes(p))
  );
  if (riskyTools.length > 0) {
    parts.push(
      `It holds write-side access to ${riskyTools.length} tool${riskyTools.length === 1 ? "" : "s"} with no evidence of use.`
    );
  }
  return parts.join(" ");
}
