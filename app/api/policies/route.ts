import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/auth/api";
import { UnconfirmedPolicyError } from "@/lib/compliance/confirm";
import { asPrinciple } from "@/lib/compliance/principles";
import {
  asComponents,
  asSeverity,
  confirmGeneratedPolicy,
  createCustomPolicy,
  loadPolicyLibrary,
} from "@/lib/compliance/policies";

export const maxDuration = 300;

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const library = await loadPolicyLibrary(auth.user.id);
  return NextResponse.json(library);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  let body: {
    name?: unknown;
    statement?: unknown;
    checkableIntent?: unknown;
    severity?: unknown;
    principle?: unknown;
    components?: unknown;
    frameworks?: unknown;
    source?: unknown;
    confidence?: unknown;
    generationNote?: unknown;
    uncertaintyAccepted?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const statement = typeof body.statement === "string" ? body.statement.trim() : "";
  const checkableIntent = typeof body.checkableIntent === "string" ? body.checkableIntent.trim() : "";
  const severity = asSeverity(body.severity);
  const principle = asPrinciple(body.principle);
  const components = asComponents(body.components);
  const frameworks = Array.isArray(body.frameworks)
    ? body.frameworks.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : typeof body.frameworks === "string"
      ? body.frameworks.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  if (!name) return jsonError("name is required", 400);
  if (!statement) return jsonError("statement is required", 400);
  if (!checkableIntent) return jsonError("checkableIntent is required", 400);
  if (!severity) return jsonError("severity must be critical, warning, or info", 400);
  if (!principle) return jsonError("category is required", 400);

  if (body.source === "generated") {
    const confidence = body.confidence === "high" || body.confidence === "low" ? body.confidence : null;
    if (!confidence) return jsonError("confidence must be high or low", 400);
    try {
      const policy = await confirmGeneratedPolicy({
        userId: auth.user.id,
        name,
        statement,
        checkableIntent,
        severity,
        principle,
        components,
        frameworks,
        confidence,
        generationNote: typeof body.generationNote === "string" ? body.generationNote : "",
        uncertaintyAccepted: body.uncertaintyAccepted === true,
      });
      return NextResponse.json({ id: policy.id, version: policy.version, status: policy.status, source: policy.source });
    } catch (err) {
      if (err instanceof UnconfirmedPolicyError) return jsonError(err.message, 400);
      console.error("[ballast:policies] confirm generated failed", err);
      return jsonError("Failed to save policy", 500);
    }
  }

  try {
    const policy = await createCustomPolicy({
      userId: auth.user.id,
      name,
      statement,
      checkableIntent,
      severity,
      principle,
      components,
      frameworks,
    });
    return NextResponse.json({ id: policy.id, version: policy.version });
  } catch (err) {
    console.error("[ballast:policies] create failed", err);
    return jsonError("Failed to save policy", 500);
  }
}
