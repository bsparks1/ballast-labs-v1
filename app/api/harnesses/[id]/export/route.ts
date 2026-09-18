import { jsonError, requireApiUser } from "@/lib/auth/api";
import { exportHarnessMarkdown } from "@/lib/harness/export";
import { loadTimeline } from "@/lib/harness/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const data = await loadTimeline(auth.user.id, id);
  if (!data) return jsonError("Harness not found", 404);

  const markdown = exportHarnessMarkdown(data.harness, data.points);
  const filename = `${data.harness.name.replace(/[^\w.-]+/g, "-").toLowerCase()}-history.md`;
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
