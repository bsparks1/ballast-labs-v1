import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth/api";
import { GeneratePolicyError, generatePolicyDraft } from "@/lib/compliance/generate";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  let body: { intent?: unknown; principle?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const intent = typeof body.intent === "string" ? body.intent : "";
  const principle = typeof body.principle === "string" ? body.principle : null;

  try {
    const draft = await generatePolicyDraft({ intent, categoryHint: principle });
    return NextResponse.json(draft);
  } catch (err) {
    if (err instanceof GeneratePolicyError) return jsonError(err.message, 400);
    console.error("[ballast:policy-generate] failed", err);
    return jsonError("Failed to draft a policy", 500);
  }
}
