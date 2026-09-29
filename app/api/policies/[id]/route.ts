import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth/api";
import { asLifecycle } from "@/lib/compliance/lifecycle";
import {
  asSeverity,
  editPolicy,
  PolicyActionError,
  PolicyNotFoundError,
  removePolicy,
  revertPolicyToLibrary,
  setPolicyLifecycle,
} from "@/lib/compliance/policies";

export const maxDuration = 300;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  let body: {
    statement?: unknown;
    checkableIntent?: unknown;
    severity?: unknown;
    note?: unknown;
    status?: unknown;
    revert?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (body.revert === true) {
    try {
      const policy = await revertPolicyToLibrary(auth.user.id, id);
      return NextResponse.json({ id: policy.id, version: policy.version, status: policy.status });
    } catch (err) {
      if (err instanceof PolicyNotFoundError) return jsonError(err.message, 404);
      if (err instanceof PolicyActionError) return jsonError(err.message, 400);
      console.error("[ballast:policies] revert failed", err);
      return jsonError("Failed to revert policy", 500);
    }
  }

  const statusOnly = body.status !== undefined && body.statement === undefined && body.checkableIntent === undefined;
  if (statusOnly) {
    const status = asLifecycle(body.status);
    if (!status) return jsonError("status must be active, paused, or draft", 400);
    try {
      const policy = await setPolicyLifecycle(auth.user.id, id, status);
      return NextResponse.json({ id: policy.id, status: policy.status, version: policy.version });
    } catch (err) {
      if (err instanceof PolicyNotFoundError) return jsonError(err.message, 404);
      console.error("[ballast:policies] status failed", err);
      return jsonError("Failed to update policy status", 500);
    }
  }

  const statement = typeof body.statement === "string" ? body.statement.trim() : "";
  const checkableIntent = typeof body.checkableIntent === "string" ? body.checkableIntent.trim() : "";
  const severity = asSeverity(body.severity);
  const note = typeof body.note === "string" ? body.note : undefined;
  if (!statement) return jsonError("statement is required", 400);
  if (!checkableIntent) return jsonError("checkableIntent is required", 400);
  if (!severity) return jsonError("severity must be critical, warning, or info", 400);

  try {
    const policy = await editPolicy({
      userId: auth.user.id,
      policyId: id,
      statement,
      checkableIntent,
      severity,
      note,
    });
    return NextResponse.json({ id: policy.id, version: policy.version });
  } catch (err) {
    if (err instanceof PolicyNotFoundError) return jsonError(err.message, 404);
    console.error("[ballast:policies] edit failed", err);
    return jsonError("Failed to save policy version", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    await removePolicy(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PolicyNotFoundError) return jsonError(err.message, 404);
    console.error("[ballast:policies] delete failed", err);
    return jsonError("Failed to remove policy", 500);
  }
}
