/**
 * Analysis engine — runs the structural layer plus the specialized pass panel,
 * aggregates findings, and builds a HarnessReport.
 *
 * If the model path throws, the pass is re-run with the deterministic layer
 * only and marked `partial` when those findings exist — never `ok`. If that
 * fallback is empty or also throws, the pass is `error` with zero findings.
 * Silence is never scored as health.
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
import type { AnalysisPass, PassContext } from "@/lib/analysis/passes/types";

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

function passResult(
  id: PassId,
  label: string,
  findings: Finding[],
  status: PassStatus["status"] = "ok",
  note?: string
): { status: PassStatus; findings: Finding[] } {
  return {
    status: {
      pass: id,
      label,
      status,
      findingCount: findings.length,
      note,
    },
    findings,
  };
}

async function runWrappedPass(
  id: PassId,
  label: string,
  run: AnalysisPass,
  ctx: PassContext
): Promise<{ status: PassStatus; findings: Finding[] }> {
  try {
    const output = await run(ctx);
    return passResult(id, label, output.findings, output.incomplete?.status ?? "ok", output.incomplete?.note);
  } catch (err) {
    console.error(`[ballast:pass] ${id} model path failed; completing with deterministic fallback`, err);
    try {
      const fallback = await run({ ...ctx, modelAvailable: false });
      if (fallback.findings.length > 0) {
        return passResult(
          id,
          label,
          fallback.findings,
          "partial",
          "Model call failed; completed with deterministic checks only. Not a clean bill of health."
        );
      }
      return passResult(
        id,
        label,
        [],
        "error",
        "This pass failed and was not scored as clean."
      );
    } catch (fallbackErr) {
      console.error(`[ballast:pass] ${id} deterministic fallback failed`, fallbackErr);
      return passResult(
        id,
        label,
        [],
        "error",
        "This pass failed and was not scored as clean."
      );
    }
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
