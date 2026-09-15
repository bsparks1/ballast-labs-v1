/**
 * Analysis engine — runs the structural layer plus the specialized pass panel,
 * aggregates findings, and builds a HarnessReport.
 *
 * A pass that errors is recorded as passStatus: "error" and never scored as
 * a clean empty result.
 */

import type { Finding, HarnessReport, PassId, PassStatus } from "@/lib/types";
import { callModel, isModelAvailable, type ModelCaller } from "@/lib/analysis/model";
import { runStructuralAnalysis } from "@/lib/analysis/structural";
import { resetFindingIds } from "@/lib/analysis/findings";
import { buildReport } from "@/lib/analysis/report";
import { findContradictions } from "@/lib/analysis/passes/contradictions";
import { findMissingConstraints } from "@/lib/analysis/passes/missing-constraints";
import { findInjectionSurface } from "@/lib/analysis/passes/injection";
import { findToolMismatch } from "@/lib/analysis/passes/tool-mismatch";
import { findAmbiguity } from "@/lib/analysis/passes/ambiguity";
import type { AnalysisPass, PassContext, PassOutput } from "@/lib/analysis/passes/types";

const PANEL: { id: PassId; label: string; run: AnalysisPass }[] = [
  { id: "contradictions", label: "Contradiction detection", run: findContradictions },
  { id: "missing-constraints", label: "Missing constraints", run: findMissingConstraints },
  { id: "injection-surface", label: "Prompt-injection surface", run: findInjectionSurface },
  { id: "tool-mismatch", label: "Instruction–tool mismatch", run: findToolMismatch },
  { id: "ambiguity", label: "Ambiguity / unenforceability", run: findAmbiguity },
];

export type AnalyzeOptions = {
  callModel?: ModelCaller;
  /** Override model availability (tests use this to stay offline). */
  modelAvailable?: boolean;
};

function normalizeElement(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Same affected element + same category → keep the first (highest-severity is pre-sorted per pass). */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const severityRank = { critical: 0, warning: 1, info: 2 };
  const sorted = [...findings].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of sorted) {
    const key = `${f.category}|${normalizeElement(f.affectedElement)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

async function runWrappedPass(
  id: PassId,
  label: string,
  run: AnalysisPass,
  ctx: PassContext
): Promise<{ status: PassStatus; findings: Finding[] }> {
  try {
    const output: PassOutput = await run(ctx);
    const status: PassStatus = {
      pass: id,
      label,
      status: output.incomplete?.status ?? "ok",
      findingCount: output.findings.length,
      note: output.incomplete?.note,
    };
    return { status, findings: output.findings };
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    console.error(`[ballast:pass] ${id} threw`, err);
    return {
      status: {
        pass: id,
        label,
        status: /API_KEY is not set/i.test(note) ? "skipped" : "error",
        findingCount: 0,
        note,
      },
      findings: [],
    };
  }
}

export async function analyzeHarness(
  prompt: string,
  config?: string,
  options: AnalyzeOptions = {}
): Promise<HarnessReport> {
  resetFindingIds();
  const structural = runStructuralAnalysis(prompt, config);

  const structuralStatus: PassStatus = {
    pass: "structural",
    label: "Fossils + structural",
    status: "ok",
    findingCount: structural.findings.length,
  };

  const ctx: PassContext = {
    instructions: structural.instructions,
    tools: structural.tools,
    rawPrompt: prompt,
    callModel: options.callModel ?? callModel,
    modelAvailable: options.modelAvailable ?? (options.callModel ? true : isModelAvailable()),
  };

  const panelResults = await Promise.all(PANEL.map((p) => runWrappedPass(p.id, p.label, p.run, ctx)));

  const extraFindings = dedupeFindings(panelResults.flatMap((r) => r.findings));
  const passes = [structuralStatus, ...panelResults.map((r) => r.status)];

  return buildReport(structural, extraFindings, passes);
}
