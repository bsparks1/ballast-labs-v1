/**
 * Assembles a HarnessReport from analysis results.
 *
 * Every pass contributes a PassStatus. Incomplete passes are visible on the
 * report so the UI can say "analysis incomplete" instead of scoring silence
 * as health.
 */

import type { ComponentReport, Finding, HarnessReport, PassStatus } from "@/lib/types";
import { HARNESS_COMPONENTS } from "@/lib/types";
import { runStructuralAnalysis, type StructuralResult } from "./structural";
import { scoreComponent, scoreOverall } from "./scoring";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function buildReport(
  structural: StructuralResult,
  extraFindings: Finding[] = [],
  passes: PassStatus[] = []
): HarnessReport {
  const allFindings = [...structural.findings, ...extraFindings];

  const components: ComponentReport[] = HARNESS_COMPONENTS.map((component) => {
    const findings = allFindings
      .filter((f) => f.component === component)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    const applicable = structural.present[component] || findings.length > 0;
    const report: ComponentReport = {
      component,
      status: applicable ? "scored" : "not_applicable",
      healthScore: applicable ? scoreComponent(findings) : 0,
      findings,
      rawSummary: structural.summaries[component],
    };
    if (component === "instructions") report.instructions = structural.instructions;
    if (component === "tools") report.tools = structural.tools;
    return report;
  });

  const criticalFindingCount = allFindings.filter((f) => f.severity === "critical").length;
  const analysisIncomplete = passes.some((p) => p.status !== "ok");

  return {
    overallHealthScore: scoreOverall(components, {
      criticalCount: criticalFindingCount,
      analysisIncomplete,
    }),
    components,
    passes,
    meta: {
      instructionCount: structural.instructions.length,
      absoluteRuleCount: structural.instructions.filter((i) => i.type === "absolute").length,
      fossilCount: structural.instructions.filter((i) => i.isFossil).length,
      verifiedConflictCount: allFindings.filter((f) => f.category === "contradiction").length,
      criticalFindingCount,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Layer A only — deterministic analysis into a full report. */
export function analyzeStructural(prompt: string, config?: string) {
  const structural = runStructuralAnalysis(prompt, config);
  const passes: PassStatus[] = [
    {
      pass: "structural",
      label: "Fossils + structural",
      status: "ok",
      findingCount: structural.findings.length,
    },
  ];
  return { structural, report: buildReport(structural, [], passes) };
}
