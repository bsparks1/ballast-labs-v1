/**
 * Health scoring — deterministic and explainable.
 *
 * Each component starts at 100 and loses points per finding, weighted by
 * severity. The overall score is a weighted aggregate of component scores.
 */

import type { ComponentReport, Finding, HarnessComponent, Severity } from "@/lib/types";

/** Points deducted per finding, by severity. critical ≫ warning ≫ info. */
export const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 30,
  warning: 12,
  info: 4,
};

/**
 * How much each component contributes to the overall score.
 * Instructions and tools dominate because they are where harness failures
 * actually manifest; the others matter but carry less standing risk.
 */
export const COMPONENT_WEIGHTS: Record<HarnessComponent, number> = {
  instructions: 0.3,
  tools: 0.25,
  guardrails: 0.2,
  delegation: 0.1,
  memory: 0.075,
  knowledge: 0.075,
};

export function scoreComponent(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
  return Math.max(0, Math.round(100 - penalty));
}

export function scoreOverall(components: ComponentReport[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const c of components) {
    const w = COMPONENT_WEIGHTS[c.component];
    weighted += c.healthScore * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 100;
  return Math.round(weighted / totalWeight);
}
