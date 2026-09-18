import type { AnalysisRecord, HarnessRecord, HarnessVersionRecord } from "@/lib/db";
import { changeSummaryLine, diffVersions, type VersionDiff } from "./diff";

export type TimelinePoint = {
  version: HarnessVersionRecord;
  analysis: AnalysisRecord | null;
  score: number | null;
  previousScore: number | null;
  delta: number | null;
  summary: string;
  note: string;
  diff: VersionDiff | null;
};

export function buildTimeline(
  harness: HarnessRecord,
  versions: HarnessVersionRecord[],
  analysesByVersion: Map<string, AnalysisRecord>
): TimelinePoint[] {
  void harness;
  const points: TimelinePoint[] = [];
  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    const analysis = analysesByVersion.get(version.id) ?? null;
    const prevVersion = i > 0 ? versions[i - 1] : null;
    const prevAnalysis = prevVersion ? (analysesByVersion.get(prevVersion.id) ?? null) : null;
    const diff =
      prevVersion && prevAnalysis && analysis
        ? diffVersions(prevVersion, prevAnalysis, version, analysis)
        : null;
    const previousScore = prevAnalysis?.overallScore ?? null;
    const score = analysis?.overallScore ?? null;
    points.push({
      version,
      analysis,
      score,
      previousScore,
      delta: score !== null && previousScore !== null ? score - previousScore : null,
      summary:
        i === 0
          ? version.note || "Initial version."
          : diff
            ? changeSummaryLine(diff)
            : version.note || "Updated harness content.",
      note: version.note,
      diff,
    });
  }
  return points;
}
