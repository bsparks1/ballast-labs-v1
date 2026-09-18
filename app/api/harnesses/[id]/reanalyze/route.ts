import { jsonError, requireApiUser } from "@/lib/auth/api";
import { isModelAvailable } from "@/lib/analysis/model";
import { HarnessNotFoundError, reanalyzeHarnessVersion } from "@/lib/harness/service";

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

  let versionId: string | undefined;
  try {
    const body = (await request.json()) as { versionId?: unknown };
    if (typeof body.versionId === "string") versionId = body.versionId;
  } catch {
    // empty body is fine — re-analyze current version
  }

  try {
    const result = await reanalyzeHarnessVersion({
      userId: auth.user.id,
      harnessId: id,
      versionId,
    });
    return Response.json({
      harnessId: result.harness.id,
      versionNumber: result.version.versionNumber,
      score: result.analysis.overallScore,
      previousScore: result.previousAnalysis?.overallScore ?? null,
      whatsNew: result.whatsNew,
    });
  } catch (err) {
    if (err instanceof HarnessNotFoundError) return jsonError(err.message, 404);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ballast:harness] reanalyze failed", err);
    return jsonError(`Re-analysis failed: ${message}`, 502);
  }
}
