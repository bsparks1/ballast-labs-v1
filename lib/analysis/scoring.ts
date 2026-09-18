/**
 * Health scoring — rebuilt so critical findings cannot look healthy, and so
 * ordinary warnings actually move the needle instead of clustering in the 80s.
 *
 * Each present component starts at 100. Warnings and info subtract. Criticals
 * CAP the component (and a single critical anywhere caps the overall score).
 * Not-applicable components are excluded. Overall is pulled toward the worst
 * present component, not a flat mean of all six.
 */

import type { ComponentReport, Finding, Severity } from "@/lib/types";

export const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 0, // criticals cap the score; they do not stack as ordinary subtraction
  warning: 15,
  info: 5,
};

/** 1 critical → component cannot exceed this. */
export const SINGLE_CRITICAL_CAP = 40;
/** 2+ criticals → component cannot exceed this. */
export const MULTI_CRITICAL_CAP = 25;
/** Any critical finding anywhere → overall cannot exceed this. */
export const OVERALL_CRITICAL_CAP = 50;
/**
 * 90+ is reserved for genuinely clean prompts (zero warnings, ≤2 infos).
 * This is a ceiling for ineligible prompts, not a magnet — it must not
 * collapse every unfinished analysis onto the same number.
 */
export const CLEAN_BAND_MIN = 90;
export const CLEAN_MAX_INFO_FINDINGS = 2;
export const WORST_WEIGHT = 0.5;
export const AVERAGE_WEIGHT = 0.25;
export const AGGREGATE_WEIGHT = 0.25;
/** Incomplete analysis must never land in the clean/solid band. */
export const INCOMPLETE_ANALYSIS_CAP = 79;

export function isScoredComponent(c: ComponentReport): boolean {
  return c.status !== "not_applicable";
}

export function scoreComponent(findings: Finding[]): number {
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const penalty = findings.reduce((sum, f) => {
    if (f.severity === "critical") return sum;
    return sum + SEVERITY_PENALTY[f.severity];
  }, 0);
  let score = Math.max(0, 100 - penalty);
  if (criticals >= 2) score = Math.min(score, MULTI_CRITICAL_CAP);
  else if (criticals === 1) score = Math.min(score, SINGLE_CRITICAL_CAP);
  return Math.round(score);
}

export function scoreOverall(
  components: ComponentReport[],
  options: { criticalCount: number; analysisIncomplete?: boolean } = {
    criticalCount: 0,
  }
): number {
  const scored = components.filter(isScoredComponent);
  if (scored.length === 0) return 0;

  const scores = scored.map((c) => c.healthScore);
  const worst = Math.min(...scores);
  const average = scores.reduce((sum, n) => sum + n, 0) / scores.length;
  const aggregate = scoreComponent(scored.flatMap((c) => c.findings));
  // 50% worst component, 25% present-component average, 25% aggregate
  // findings. The extra findings term is what keeps split warnings from
  // being averaged back into the 80s by clean components.
  let overall = WORST_WEIGHT * worst + AVERAGE_WEIGHT * average + AGGREGATE_WEIGHT * aggregate;

  if (options.criticalCount > 0) {
    overall = Math.min(overall, OVERALL_CRITICAL_CAP);
  }
  if (options.analysisIncomplete) {
    overall = Math.min(overall, INCOMPLETE_ANALYSIS_CAP);
  }

  const findings = scored.flatMap((c) => c.findings);
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  const eligibleForClean = warnings === 0 && infos <= CLEAN_MAX_INFO_FINDINGS;
  if (!eligibleForClean) {
    overall = Math.min(overall, CLEAN_BAND_MIN - 1);
  }

  return Math.max(0, Math.round(overall));
}
