/**
 * Assembles a HarnessReport from analysis results.
 *
 * Layer A (structural) results are required; Layer B (model-graded conflict)
 * findings are optional — the report builds fine without them, so the app
 * never breaks if the model call fails.
 */

import type { ComponentReport, Finding, HarnessReport } from "@/lib/types";
import { HARNESS_COMPONENTS } from "@/lib/types";
import { runStructuralAnalysis, type StructuralResult } from "./structural";
import { scoreComponent, scoreOverall } from "./scoring";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function buildReport(
  structural: StructuralResult,
  conflictFindings: Finding[] = []
): HarnessReport {
  const allFindings = [...structural.findings, ...conflictFindings];

  const components: ComponentReport[] = HARNESS_COMPONENTS.map((component) => {
    const findings = allFindings
      .filter((f) => f.component === component)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    const report: ComponentReport = {
      component,
      healthScore: scoreComponent(findings),
      findings,
      rawSummary: structural.summaries[component],
    };
    if (component === "instructions") report.instructions = structural.instructions;
    if (component === "tools") report.tools = structural.tools;
    return report;
  });

  return {
    overallHealthScore: scoreOverall(components),
    components,
    meta: {
      instructionCount: structural.instructions.length,
      absoluteRuleCount: structural.instructions.filter((i) => i.type === "absolute").length,
      fossilCount: structural.instructions.filter((i) => i.isFossil).length,
      verifiedConflictCount: conflictFindings.length,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Layer A only — deterministic analysis into a full report. */
export function analyzeStructural(prompt: string, config?: string) {
  const structural = runStructuralAnalysis(prompt, config);
  return { structural, report: buildReport(structural) };
}
