import { NextResponse } from "next/server";
import { runStructuralAnalysis } from "@/lib/analysis/structural";
import { buildReport } from "@/lib/analysis/report";
import { findVerifiedConflicts } from "@/lib/analysis/conflicts";

export async function POST(request: Request) {
  let body: { prompt?: unknown; config?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const config = typeof body.config === "string" ? body.config : undefined;

  if (prompt.length === 0) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > 200_000) {
    return NextResponse.json({ error: "prompt is too large (max 200k characters)" }, { status: 413 });
  }

  // Layer A — deterministic structural analysis. Never fails.
  const structural = runStructuralAnalysis(prompt, config);

  // Layer B — model-graded conflict analysis. Returns [] on any failure,
  // so the report always ships with at least the deterministic findings.
  const conflictFindings = await findVerifiedConflicts(structural.instructions);

  return NextResponse.json(buildReport(structural, conflictFindings));
}
