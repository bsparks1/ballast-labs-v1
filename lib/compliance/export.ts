import type { ComplianceReportRecord, HarnessRecord, PolicyVersionRecord } from "@/lib/db";
import type { PolicyCheckResult, PolicyVerdict } from "@/lib/types";

function verdictLabel(verdict: PolicyVerdict): string {
  if (verdict === "cannot_determine") return "Cannot determine";
  if (verdict === "violated") return "Violated";
  return "Compliant";
}

const SECTION_ORDER: PolicyVerdict[] = ["violated", "cannot_determine", "compliant"];

export function exportComplianceMarkdown(input: {
  harness: HarnessRecord;
  versionNumber: number;
  report: ComplianceReportRecord;
}): string {
  const { harness, versionNumber, report } = input;
  const generated = report.generatedAt.toISOString();
  const lines: string[] = [
    `# Compliance report: ${harness.name}`,
    "",
    `Generated: ${generated}`,
    `Harness version: ${versionNumber}`,
    `Policy pack: ${report.policyPackVersion}`,
    `Overall: ${report.overallStatus.replaceAll("_", " ")}`,
    "",
    `${report.summary.violated} violated, ${report.summary.cannotDetermine} cannot determine, ${report.summary.compliant} compliant.`,
    "",
    "Cannot determine means the harness is silent on that policy. A control you believe you have, but that is not in the config, is a gap — not a pass.",
    "",
  ];

  if (report.delta?.previousGeneratedAt) {
    lines.push(`## Change since last check`, "", report.delta.headline, "");
    for (const note of report.delta.notes) lines.push(`- ${note}`);
    if (report.delta.notes.length > 0) lines.push("");
  }

  for (const verdict of SECTION_ORDER) {
    const rows = report.results.filter((r) => r.verdict === verdict);
    lines.push(`## ${verdictLabel(verdict)} (${rows.length})`, "");
    if (rows.length === 0) {
      lines.push("None.", "");
      continue;
    }
    for (const row of rows) lines.push(...formatResult(row));
  }

  return lines.join("\n");
}

function formatResult(row: PolicyCheckResult): string[] {
  const lines = [
    `### ${row.policyCode} — ${row.policyName}`,
    "",
    `Verdict: ${verdictLabel(row.verdict)} (${row.confidence} confidence)`,
    `Severity: ${row.severity}`,
    `Principle: ${row.principle}`,
    `Policy version: ${row.policyVersion}`,
    "",
    row.reasoning,
    "",
  ];
  if (row.evidence.length > 0) {
    lines.push("Evidence:");
    for (const quote of row.evidence) lines.push(`- ${quote}`);
    lines.push("");
  } else if (row.verdict === "cannot_determine") {
    lines.push("Evidence: none. The harness does not address this policy.", "");
  }
  lines.push(`Recommendation: ${row.recommendation}`, "");
  return lines;
}

export function exportPolicyHistoryMarkdown(input: {
  policyName: string;
  code: string;
  versions: PolicyVersionRecord[];
  authorEmail: (userId: string | null) => string;
}): string {
  const lines: string[] = [
    `# Policy history: ${input.policyName}`,
    "",
    `Code: ${input.code}`,
    `Exported: ${new Date().toISOString()}`,
    "",
    "Each version records who changed the policy and when. This history is compliance evidence.",
    "",
  ];
  for (const version of input.versions) {
    lines.push(
      `## Version ${version.versionNumber} — ${version.createdAt.toISOString()}`,
      "",
      `Author: ${input.authorEmail(version.createdBy)}`,
      `Source: ${version.source}`,
      `Severity: ${version.severity}`,
      version.confidence ? `Generator confidence: ${version.confidence}` : "",
      version.note ? `Note: ${version.note}` : "",
      version.generationNote ? `Generator note: ${version.generationNote}` : "",
      "",
      "### Statement",
      "",
      version.statement,
      "",
      "### Checkable intent",
      "",
      version.checkableIntent,
      ""
    );
  }
  return lines.filter((line, i, arr) => line !== "" || arr[i - 1] !== "").join("\n");
}
