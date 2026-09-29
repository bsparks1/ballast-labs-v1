/**
 * Pure report assembly: counts, overall status, and the delta against the
 * previous check. Persistence lives in run.ts.
 */

import type {
  ComplianceDelta,
  ComplianceReport,
  ComplianceSummary,
  Policy,
  PolicyCheckResult,
  PolicyVerdict,
} from "@/lib/types";

export function summarize(results: PolicyCheckResult[]): ComplianceSummary {
  return {
    compliant: results.filter((r) => r.verdict === "compliant").length,
    violated: results.filter((r) => r.verdict === "violated").length,
    cannotDetermine: results.filter((r) => r.verdict === "cannot_determine").length,
  };
}

export function overallStatus(summary: ComplianceSummary): ComplianceReport["overallStatus"] {
  if (summary.violated > 0) return "violations_present";
  if (summary.cannotDetermine > 0) return "gaps_present";
  return "compliant";
}

export function policyPackVersion(policies: Policy[]): string {
  return [...policies]
    .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id))
    .map((p) => `${p.code}@${p.version}`)
    .join("+");
}

function countPhrase(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function diffCompliance(
  previous: { generatedAt: string; results: PolicyCheckResult[] } | null,
  next: PolicyCheckResult[]
): ComplianceDelta {
  const prior = new Map((previous?.results ?? []).map((r) => [r.policyId, r]));
  const resolvedViolations: ComplianceDelta["resolvedViolations"] = [];
  const newViolations: ComplianceDelta["newViolations"] = [];
  const newGaps: ComplianceDelta["newGaps"] = [];
  const resolvedGaps: ComplianceDelta["resolvedGaps"] = [];
  const notes: string[] = [];

  if (previous) {
    for (const result of next) {
      const before = prior.get(result.policyId);
      if (!before || before.verdict === result.verdict) continue;
      const name = result.policyName;
      const item = { policyId: result.policyId, name };
      if (before.verdict === "violated" && result.verdict === "compliant") {
        resolvedViolations.push(item);
        notes.push(`Policy ${name} now passes where it failed last version.`);
      } else if (result.verdict === "violated" && before.verdict !== "violated") {
        newViolations.push(item);
        notes.push(`Policy ${name} now fails where it was ${label(before.verdict)} last version.`);
      } else if (result.verdict === "cannot_determine" && before.verdict !== "cannot_determine") {
        newGaps.push(item);
        notes.push(`Policy ${name} is a new gap — the harness is silent on it.`);
      } else if (before.verdict === "cannot_determine" && result.verdict === "compliant") {
        resolvedGaps.push(item);
        notes.push(`Policy ${name} is now demonstrated in the harness.`);
      }
    }
  }

  const bits: string[] = [];
  if (resolvedViolations.length) {
    bits.push(`resolved ${countPhrase(resolvedViolations.length, "violation", "violations")}`);
  }
  if (newViolations.length) {
    bits.push(`introduced ${countPhrase(newViolations.length, "new violation", "new violations")}`);
  }
  if (newGaps.length) bits.push(`introduced ${countPhrase(newGaps.length, "new gap", "new gaps")}`);
  if (resolvedGaps.length) bits.push(`closed ${countPhrase(resolvedGaps.length, "gap", "gaps")}`);

  let headline = "No prior compliance check to compare.";
  if (previous && bits.length === 0) headline = "No change in compliance verdicts since the last check.";
  else if (previous && bits.length === 1) headline = `This change ${bits[0]}.`;
  else if (previous) headline = `This change ${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}.`;

  return {
    previousGeneratedAt: previous?.generatedAt ?? null,
    resolvedViolations,
    newViolations,
    newGaps,
    resolvedGaps,
    headline,
    notes,
  };
}

function label(verdict: PolicyVerdict): string {
  if (verdict === "cannot_determine") return "a gap";
  if (verdict === "violated") return "a violation";
  return "passing";
}

export function buildComplianceReport(input: {
  harnessVersionId: string;
  policies: Policy[];
  results: PolicyCheckResult[];
  previous?: { generatedAt: string; results: PolicyCheckResult[] } | null;
  generatedAt?: string;
}): ComplianceReport {
  const summary = summarize(input.results);
  return {
    harnessVersionId: input.harnessVersionId,
    policyPackVersion: policyPackVersion(input.policies),
    results: input.results,
    summary,
    overallStatus: overallStatus(summary),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    delta: diffCompliance(input.previous ?? null, input.results),
  };
}
