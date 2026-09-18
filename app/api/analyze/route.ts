import { NextResponse } from "next/server";
import { analyzeHarness } from "@/lib/analysis/engine";
import { isModelAvailable } from "@/lib/analysis/model";
import { MAX_PROMPT_CHARS } from "@/lib/analysis/limits";
import { attachIngestionMeta } from "@/lib/ingest/assemble";

export const maxDuration = 300;

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
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: `prompt is too large (max ${MAX_PROMPT_CHARS.toLocaleString()} characters)` },
      { status: 413 }
    );
  }

  if (!isModelAvailable()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is required to finish analysis. Add it to .env.local and restart the dev server — Ballast will not return a partial report.",
      },
      { status: 503 }
    );
  }

  try {
    const report = attachIngestionMeta(await analyzeHarness(prompt, config), config);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ballast:analyze] failed", err);
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 502 });
  }
}
