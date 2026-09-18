import "server-only";
import { analyzeHarness } from "@/lib/analysis/engine";
import { store } from "@/lib/db";
import type { AnalysisRecord, HarnessRecord, HarnessVersionRecord } from "@/lib/db";
import type { HarnessReport } from "@/lib/types";
import { attachIngestionMeta } from "@/lib/ingest/assemble";
import { diffAnalyses, diffVersions, type VersionDiff } from "./diff";
import { toHarnessReport } from "./report";
import { buildTimeline, type TimelinePoint } from "./timeline";

export class HarnessNotFoundError extends Error {
  constructor() {
    super("Harness not found");
    this.name = "HarnessNotFoundError";
  }
}

function persistReport(versionId: string, report: HarnessReport) {
  return store.createAnalysis({
    harnessVersionId: versionId,
    overallScore: report.overallHealthScore,
    componentReports: report.components,
    findings: report.components.flatMap((c) => c.findings),
    meta: { ...report.meta, passes: report.passes },
  });
}

export async function createNamedHarness(input: {
  userId: string;
  name: string;
  description?: string;
  prompt: string;
  config?: string;
  note?: string;
}): Promise<{
  harness: HarnessRecord;
  version: HarnessVersionRecord;
  analysis: AnalysisRecord;
  report: HarnessReport;
}> {
  const harness = await store.createHarness({
    userId: input.userId,
    name: input.name,
    description: input.description,
  });
  const version = await store.createVersion({
    harnessId: harness.id,
    rawPrompt: input.prompt,
    rawConfig: input.config,
    note: input.note ?? "Initial version",
  });
  const report = attachIngestionMeta(await analyzeHarness(input.prompt, input.config), input.config);
  const analysis = await persistReport(version.id, report);
  return { harness, version, analysis, report };
}

export async function updateNamedHarness(input: {
  userId: string;
  harnessId: string;
  prompt: string;
  config?: string;
  note?: string;
}): Promise<{
  harness: HarnessRecord;
  version: HarnessVersionRecord;
  analysis: AnalysisRecord;
  report: HarnessReport;
  previous: HarnessVersionRecord | null;
  diff: VersionDiff | null;
}> {
  const harness = await store.getHarness(input.userId, input.harnessId);
  if (!harness) throw new HarnessNotFoundError();
  const previous = await store.getLatestVersion(harness.id);
  const version = await store.createVersion({
    harnessId: harness.id,
    rawPrompt: input.prompt,
    rawConfig: input.config,
    note: input.note,
  });
  const report = attachIngestionMeta(await analyzeHarness(input.prompt, input.config), input.config);
  const analysis = await persistReport(version.id, report);
  const previousAnalysis = previous ? await store.getLatestAnalysis(previous.id) : null;
  const diff =
    previous && previousAnalysis
      ? diffVersions(previous, previousAnalysis, version, analysis)
      : null;
  return { harness, version, analysis, report, previous, diff };
}

export async function reanalyzeHarnessVersion(input: {
  userId: string;
  harnessId: string;
  versionId?: string;
}): Promise<{
  harness: HarnessRecord;
  version: HarnessVersionRecord;
  analysis: AnalysisRecord;
  report: HarnessReport;
  previousAnalysis: AnalysisRecord | null;
  whatsNew: VersionDiff["findings"] | null;
}> {
  const harness = await store.getHarness(input.userId, input.harnessId);
  if (!harness) throw new HarnessNotFoundError();
  const version = input.versionId
    ? await store.getVersion(input.versionId)
    : await store.getLatestVersion(harness.id);
  if (!version || version.harnessId !== harness.id) throw new HarnessNotFoundError();
  const previousAnalysis = await store.getLatestAnalysis(version.id);
  const report = attachIngestionMeta(
    await analyzeHarness(version.rawPrompt, version.rawConfig || undefined),
    version.rawConfig || undefined
  );
  const analysis = await persistReport(version.id, report);
  const whatsNew = previousAnalysis ? diffAnalyses(previousAnalysis, analysis) : null;
  return { harness, version, analysis, report, previousAnalysis, whatsNew };
}

export async function loadHarnessView(
  userId: string,
  harnessId: string,
  versionNumber?: number
): Promise<{
  harness: HarnessRecord;
  version: HarnessVersionRecord;
  analysis: AnalysisRecord | null;
  report: HarnessReport | null;
  versions: HarnessVersionRecord[];
} | null> {
  const harness = await store.getHarness(userId, harnessId);
  if (!harness) return null;
  const versions = await store.listVersions(harness.id);
  const version =
    versionNumber !== undefined
      ? (versions.find((v) => v.versionNumber === versionNumber) ?? null)
      : (versions[versions.length - 1] ?? null);
  if (!version) return { harness, version: versions[0], analysis: null, report: null, versions };
  const analysis = await store.getLatestAnalysis(version.id);
  return {
    harness,
    version,
    analysis,
    report: analysis ? toHarnessReport(analysis) : null,
    versions,
  };
}

export async function loadVersionPair(
  userId: string,
  harnessId: string,
  fromNumber?: number,
  toNumber?: number
): Promise<{
  harness: HarnessRecord;
  fromVersion: HarnessVersionRecord;
  toVersion: HarnessVersionRecord;
  fromAnalysis: AnalysisRecord | null;
  toAnalysis: AnalysisRecord | null;
  diff: VersionDiff | null;
  versions: HarnessVersionRecord[];
} | null> {
  const harness = await store.getHarness(userId, harnessId);
  if (!harness) return null;
  const versions = await store.listVersions(harness.id);
  if (versions.length === 0) return null;
  const latest = versions[versions.length - 1];
  const to = toNumber !== undefined
    ? (versions.find((v) => v.versionNumber === toNumber) ?? latest)
    : latest;
  const from =
    fromNumber !== undefined
      ? (versions.find((v) => v.versionNumber === fromNumber) ?? versions[0])
      : (versions.find((v) => v.versionNumber === to.versionNumber - 1) ?? versions[0]);
  const fromAnalysis = await store.getLatestAnalysis(from.id);
  const toAnalysis = await store.getLatestAnalysis(to.id);
  const diff =
    fromAnalysis && toAnalysis ? diffVersions(from, fromAnalysis, to, toAnalysis) : null;
  return { harness, fromVersion: from, toVersion: to, fromAnalysis, toAnalysis, diff, versions };
}

export async function loadTimeline(userId: string, harnessId: string): Promise<{
  harness: HarnessRecord;
  points: TimelinePoint[];
} | null> {
  const harness = await store.getHarness(userId, harnessId);
  if (!harness) return null;
  const versions = await store.listVersions(harness.id);
  const analysesByVersion = new Map<string, AnalysisRecord>();
  await Promise.all(
    versions.map(async (v) => {
      const analysis = await store.getLatestAnalysis(v.id);
      if (analysis) analysesByVersion.set(v.id, analysis);
    })
  );
  return { harness, points: buildTimeline(harness, versions, analysesByVersion) };
}
