import type { Finding, HarnessReport, Instruction } from "@/lib/types";
import type { AnalysisRecord } from "@/lib/db";

export function toHarnessReport(analysis: AnalysisRecord): HarnessReport {
  return {
    overallHealthScore: analysis.overallScore,
    components: analysis.componentReports,
    passes: analysis.meta.passes ?? [],
    meta: {
      instructionCount: analysis.meta.instructionCount,
      absoluteRuleCount: analysis.meta.absoluteRuleCount,
      fossilCount: analysis.meta.fossilCount,
      verifiedConflictCount: analysis.meta.verifiedConflictCount,
      criticalFindingCount: analysis.meta.criticalFindingCount,
      createdAt: analysis.createdAt.toISOString(),
      ingestion: analysis.meta.ingestion,
    },
  };
}

export function instructionsFromAnalysis(analysis: AnalysisRecord): Instruction[] {
  return analysis.componentReports.find((c) => c.component === "instructions")?.instructions ?? [];
}

export function findingsFromAnalysis(analysis: AnalysisRecord): Finding[] {
  if (analysis.findings.length > 0) return analysis.findings;
  return analysis.componentReports.flatMap((c) => c.findings);
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Stable identity for a finding across analyses — IDs are sequential per run. */
export function findingFingerprint(finding: Finding): string {
  return [
    finding.category,
    finding.component,
    normalizeText(finding.title),
    normalizeText(finding.affectedElement),
  ].join("|");
}

export function instructionNumber(id: string): string {
  const match = id.match(/(\d+)/);
  return match ? `#${match[1]}` : id;
}
