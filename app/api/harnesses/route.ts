import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth/api";
import { store } from "@/lib/db";
import { createNamedHarness, HarnessNotFoundError } from "@/lib/harness/service";
import { MAX_PROMPT_CHARS } from "@/lib/analysis/limits";
import { isModelAvailable } from "@/lib/analysis/model";
import { notificationForHarness } from "@/lib/harness/notifications";

export const maxDuration = 300;

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const summaries = await store.listHarnessSummaries(auth.user.id);
  const notifications = await Promise.all(
    summaries.map(async (summary) => {
      if (!summary.currentVersionId) return null;
      const analyses = await store.listAnalyses(summary.currentVersionId);
      const latest = analyses[analyses.length - 1] ?? null;
      const previous = analyses.length >= 2 ? analyses[analyses.length - 2] : null;
      return notificationForHarness(summary, previous, latest);
    })
  );

  return NextResponse.json({
    harnesses: summaries,
    notifications: notifications.filter(Boolean),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  if (!isModelAvailable()) {
    return jsonError(
      "ANTHROPIC_API_KEY is required to finish analysis. Add it to .env.local and restart the dev server.",
      503
    );
  }

  let body: { name?: unknown; description?: unknown; prompt?: unknown; config?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const description = typeof body.description === "string" ? body.description : "";
  const config = typeof body.config === "string" ? body.config : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;

  if (!name) return jsonError("name is required", 400);
  if (!prompt) return jsonError("prompt is required", 400);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return jsonError(`prompt is too large (max ${MAX_PROMPT_CHARS.toLocaleString()} characters)`, 413);
  }

  try {
    const result = await createNamedHarness({
      userId: auth.user.id,
      name,
      description,
      prompt,
      config,
      note,
    });
    return NextResponse.json({
      harnessId: result.harness.id,
      versionNumber: result.version.versionNumber,
      score: result.analysis.overallScore,
    });
  } catch (err) {
    if (err instanceof HarnessNotFoundError) return jsonError(err.message, 404);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ballast:harness] create failed", err);
    return jsonError(`Failed to save harness: ${message}`, 502);
  }
}
