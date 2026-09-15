import { NextResponse } from "next/server";
import { analyzeHarness } from "@/lib/analysis/engine";

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

  const report = await analyzeHarness(prompt, config);
  return NextResponse.json(report);
}
