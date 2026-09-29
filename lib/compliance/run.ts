import "server-only";
import { store } from "@/lib/db";
import type { ComplianceReportRecord, HarnessVersionRecord } from "@/lib/db";
import { checkPolicy } from "./check";
import { decomposeHarness } from "./decompose";
import { selectPoliciesForAnalysis } from "./lifecycle";
import { toPolicy } from "./map";
import { buildComplianceReport } from "./report";
import { ensureStarterPolicies } from "./seed";

export async function recordCompliance(input: {
  userId: string;
  version: HarnessVersionRecord;
}): Promise<ComplianceReportRecord | null> {
  await ensureStarterPolicies();
  // Paused and draft policies are visible in the library and are never checked.
  const records = selectPoliciesForAnalysis(await store.listUserPolicies(input.userId));
  if (records.length === 0) return null;

  const policies = records.map(toPolicy);
  const harness = decomposeHarness(input.version.id, input.version.rawPrompt, input.version.rawConfig);
  const results = await Promise.all(policies.map((policy) => checkPolicy(policy, harness)));

  const history = await store.listComplianceReports(input.version.id);
  let previous = history.length > 0 ? history[history.length - 1] : null;
  if (!previous) {
    const versions = await store.listVersions(input.version.harnessId);
    const prior = [...versions].reverse().find((v) => v.versionNumber < input.version.versionNumber);
    if (prior) previous = await store.getLatestComplianceReport(prior.id);
  }

  const report = buildComplianceReport({
    harnessVersionId: input.version.id,
    policies,
    results,
    previous: previous
      ? { generatedAt: previous.generatedAt.toISOString(), results: previous.results }
      : null,
  });

  return store.createComplianceReport({
    harnessVersionId: report.harnessVersionId,
    policyPackVersion: report.policyPackVersion,
    results: report.results,
    summary: report.summary,
    overallStatus: report.overallStatus,
    delta: report.delta,
  });
}

export async function recheckUserHarnesses(userId: string): Promise<void> {
  const harnesses = await store.listHarnesses(userId);
  for (const harness of harnesses) {
    const version = await store.getLatestVersion(harness.id);
    if (!version) continue;
    try {
      await recordCompliance({ userId, version });
    } catch (err) {
      console.error(`[ballast:compliance] recheck failed for harness ${harness.id}`, err);
    }
  }
}
