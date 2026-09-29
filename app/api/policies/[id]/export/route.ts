import { jsonError, requireApiUser } from "@/lib/auth/api";
import { exportPolicyHistoryMarkdown } from "@/lib/compliance/export";
import { store } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const policy = await store.getUserPolicy(auth.user.id, id, { includeDeleted: true });
  if (!policy) return jsonError("Policy not found", 404);
  const versions = await store.getPolicyVersionHistory(auth.user.id, id);
  const emails = new Map<string, string>();
  for (const version of versions) {
    if (!version.createdBy || emails.has(version.createdBy)) continue;
    const user = await store.getUserById(version.createdBy);
    if (user) emails.set(version.createdBy, user.email);
  }
  const markdown = exportPolicyHistoryMarkdown({
    policyName: policy.name,
    code: policy.code,
    versions,
    authorEmail: (userId) => (userId ? emails.get(userId) ?? userId : "starter pack"),
  });
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${policy.code}-history.md"`,
    },
  });
}
