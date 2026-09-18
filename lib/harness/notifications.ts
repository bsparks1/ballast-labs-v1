import type { AnalysisRecord, HarnessSummary } from "@/lib/db";
import { diffAnalyses } from "./diff";

export type HarnessNotification = {
  harnessId: string;
  harnessName: string;
  message: string;
  newFindingCount: number;
  analysisId: string;
};

/**
 * Prototype notifications: if the current version was re-analyzed and the
 * latest run found issues the previous run did not, surface them until viewed.
 */
export function notificationForHarness(
  summary: HarnessSummary,
  previousAnalysis: AnalysisRecord | null,
  latestAnalysis: AnalysisRecord | null
): HarnessNotification | null {
  if (!latestAnalysis || !previousAnalysis) return null;
  if (summary.analysisCountOnCurrent < 2) return null;
  const churn = diffAnalyses(previousAnalysis, latestAnalysis);
  if (churn.new.length === 0) return null;
  const unseen =
    !summary.lastViewedAt || latestAnalysis.createdAt.getTime() > summary.lastViewedAt.getTime();
  if (!unseen) return null;
  const n = churn.new.length;
  return {
    harnessId: summary.id,
    harnessName: summary.name,
    message: `A new issue was identified in your saved harness ‘${summary.name}’ — review it.`,
    newFindingCount: n,
    analysisId: latestAnalysis.id,
  };
}
