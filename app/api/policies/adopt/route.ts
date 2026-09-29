import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth/api";
import { adoptStarterPolicy, PolicyNotFoundError } from "@/lib/compliance/policies";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  let body: { starterId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const starterId = typeof body.starterId === "string" ? body.starterId : "";
  if (!starterId) return jsonError("starterId is required", 400);

  try {
    const policy = await adoptStarterPolicy(auth.user.id, starterId);
    return NextResponse.json({ id: policy.id, version: policy.version });
  } catch (err) {
    if (err instanceof PolicyNotFoundError) return jsonError(err.message, 404);
    console.error("[ballast:policies] adopt failed", err);
    return jsonError("Failed to adopt policy", 500);
  }
}
