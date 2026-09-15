/** Presentation helpers shared by the dashboard and drill-down views. */

import type { ComponentReport, HarnessReport, Severity } from "@/lib/types";

export type ScoreBand = "healthy" | "degraded" | "at-risk";

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "healthy";
  if (score >= 50) return "degraded";
  return "at-risk";
}

export const BAND_TEXT_CLASS: Record<ScoreBand, string> = {
  healthy: "text-healthy",
  degraded: "text-warning",
  "at-risk": "text-critical",
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
  if (c.findings.some((f) => f.severity === "critical")) return "critical";
  if (c.findings.some((f) => f.severity === "warning")) return "warning";
  if (c.findings.length > 0) return "info";
  return null;
}

/** One-line verdict for the top of the dashboard. */
export function verdictLine(report: HarnessReport): string {
  const band = scoreBand(report.overallHealthScore);
  const criticals = report.components.reduce(
    (n, c) => n + c.findings.filter((f) => f.severity === "critical").length,
    0
  );
  if (band === "healthy") {
    return criticals > 0
      ? "Mostly sound, but at least one critical issue needs attention."
      : "This harness is in good shape. Address the remaining findings to harden it.";
  }
  if (band === "degraded") {
    return "This harness has real problems that will surface in production behavior.";
  }
  return "This harness is working against the agent. Multiple critical failures need immediate attention.";
}

/**
 * The value-moment sentence: a plain-English summary of what the audit found,
 * composed from the report meta. E.g. "Your agent has 47 instructions.
 * 3 directly contradict each other. 6 do nothing. It holds write access to
 * 5 tools with no evidence of use."
 */
export function headlineSummary(report: HarnessReport): string {
  const { instructionCount, fossilCount, verifiedConflictCount } = report.meta;
  const parts: string[] = [`Your agent has ${instructionCount} instruction${instructionCount === 1 ? "" : "s"}.`];

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
      t.permissions.some((p) => ["write", "delete", "execute", "deploy", "admin"].includes(p))
  );
  if (riskyTools.length > 0) {
    parts.push(
      `It holds write-side access to ${riskyTools.length} tool${riskyTools.length === 1 ? "" : "s"} with no evidence of use.`
    );
  }
  return parts.join(" ");
}
