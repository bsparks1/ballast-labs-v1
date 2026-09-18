import { jsonError, requireApiUser } from "@/lib/auth/api";
import { MAX_PROMPT_CHARS } from "@/lib/analysis/limits";
import { isModelAvailable } from "@/lib/analysis/model";
import { HarnessNotFoundError, updateNamedHarness } from "@/lib/harness/service";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  if (!isModelAvailable()) {
    return jsonError(
      "ANTHROPIC_API_KEY is required to finish analysis. Add it to .env.local and restart the dev server.",
      503
    );
  }

  let body: { prompt?: unknown; config?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const config = typeof body.config === "string" ? body.config : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;
  if (!prompt) return jsonError("prompt is required", 400);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return jsonError(`prompt is too large (max ${MAX_PROMPT_CHARS.toLocaleString()} characters)`, 413);
  }

  try {
    const result = await updateNamedHarness({
      userId: auth.user.id,
      harnessId: id,
      prompt,
      config,
      note,
    });
    return Response.json({
      harnessId: result.harness.id,
      fromVersion: result.previous?.versionNumber ?? null,
      toVersion: result.version.versionNumber,
      score: result.analysis.overallScore,
      diff: result.diff,
    });
  } catch (err) {
    if (err instanceof HarnessNotFoundError) return jsonError(err.message, 404);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ballast:harness] update failed", err);
    return jsonError(`Failed to update harness: ${message}`, 502);
  }
}
