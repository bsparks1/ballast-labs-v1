import { jsonError, requireApiUser } from "@/lib/auth/api";
import { exportComplianceMarkdown } from "@/lib/compliance/export";
import { store } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const harness = await store.getHarness(auth.user.id, id);
  if (!harness) return jsonError("Harness not found", 404);

  const url = new URL(request.url);
  const versionParam = url.searchParams.get("version");
  const versionNumber = versionParam ? Number(versionParam) : undefined;
  const version =
    versionNumber && Number.isFinite(versionNumber)
      ? await store.getVersionByNumber(harness.id, versionNumber)
      : await store.getLatestVersion(harness.id);
  if (!version || version.harnessId !== harness.id) return jsonError("Version not found", 404);

  const report = await store.getLatestComplianceReport(version.id);
  if (!report) return jsonError("No compliance report for this version", 404);

  const markdown = exportComplianceMarkdown({
    harness,
    versionNumber: version.versionNumber,
    report,
  });
  const date = report.generatedAt.toISOString().slice(0, 10);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${harness.name.replace(/[^\w.-]+/g, "-")}-compliance-v${version.versionNumber}-${date}.md"`,
    },
  });
}
