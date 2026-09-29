import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth/api";
import { recordCompliance } from "@/lib/compliance/run";
import { selectPoliciesForAnalysis } from "@/lib/compliance/lifecycle";
import { store } from "@/lib/db";

export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const harness = await store.getHarness(auth.user.id, id);
  if (!harness) return jsonError("Harness not found", 404);
  const version = await store.getLatestVersion(harness.id);
  if (!version) return jsonError("Harness has no version", 404);
  const policies = await store.listUserPolicies(auth.user.id);
  const active = selectPoliciesForAnalysis(policies);
  if (active.length === 0) {
    return jsonError(
      policies.length === 0
        ? "Adopt at least one policy before running a compliance check."
        : "Activate at least one policy. Paused and draft policies are not evaluated.",
      400
    );
  }
  const report = await recordCompliance({ userId: auth.user.id, version });
  if (!report) return jsonError("Compliance check produced no report", 500);
  return NextResponse.json({
    id: report.id,
    overallStatus: report.overallStatus,
    summary: report.summary,
    headline: report.delta?.headline ?? null,
  });
}
