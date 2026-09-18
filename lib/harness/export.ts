import type { HarnessRecord } from "@/lib/db";
import { findingsFromAnalysis } from "./report";
import type { TimelinePoint } from "./timeline";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function deltaLabel(delta: number | null): string {
  if (delta === null) return "";
  if (delta === 0) return " (unchanged)";
  return delta > 0 ? ` (↑${delta})` : ` (↓${Math.abs(delta)})`;
}

export function exportHarnessMarkdown(
  harness: HarnessRecord,
  points: TimelinePoint[]
): string {
  const latest = [...points].reverse().find((p) => p.analysis) ?? points[points.length - 1];
  const generated = new Date().toISOString();
  const lines: string[] = [
    `# Harness history: ${harness.name}`,
    "",
    `Generated: ${generated}`,
    harness.description ? `Description: ${harness.description}` : "",
    `Current version: ${latest?.version.versionNumber ?? "—"}`,
    `Current score: ${latest?.score ?? "—"} / 100`,
    "",
    "## Timeline",
    "",
  ].filter((line, i, arr) => line !== "" || arr[i - 1] !== "");

  for (const point of points) {
    const when = isoDate(point.version.createdAt);
    lines.push(
      `### v${point.version.versionNumber} — ${when} — score ${point.score ?? "—"}${deltaLabel(point.delta)}`
    );
    if (point.note) lines.push(`Note: ${point.note}`);
    lines.push(`Summary: ${point.summary}`);
    if (point.analysis) {
      const findings = findingsFromAnalysis(point.analysis);
      const critical = findings.filter((f) => f.severity === "critical").length;
      lines.push(
        `Findings: ${findings.length} total${critical ? `, ${critical} critical` : ""}.`
      );
      if (point.diff) {
        if (point.diff.findings.new.length) {
          lines.push("New findings:");
          for (const c of point.diff.findings.new) {
            lines.push(`- [${c.finding.severity}] ${c.finding.title} — ${c.finding.affectedElement}`);
          }
        }
        if (point.diff.findings.resolved.length) {
          lines.push("Resolved findings:");
          for (const c of point.diff.findings.resolved) {
            lines.push(`- [${c.finding.severity}] ${c.finding.title}`);
          }
        }
      }
    } else {
      lines.push("No analysis stored for this version.");
    }
    lines.push("");
  }

  if (latest?.analysis) {
    lines.push("## Current findings");
    lines.push("");
    const findings = findingsFromAnalysis(latest.analysis);
    if (findings.length === 0) {
      lines.push("No findings on the current version.");
    } else {
      for (const f of findings) {
        lines.push(`### ${f.title} (${f.severity})`);
        lines.push(f.description);
        lines.push(`Reference: ${f.affectedElement}`);
        lines.push(`Recommended fix: ${f.recommendation}`);
        lines.push("");
      }
    }
  }

  return lines.join("\n").trim() + "\n";
}
