import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { store } from "@/lib/db";
import { harnessSnapshotSchema } from "@/lib/snapshot/schema";

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status }
  );
}

/**
 * Runtime collector — unauthenticated by design for V1 local dogfood.
 * Single DB writer for HarnessSnapshot rows.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = harnessSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Snapshot failed validation", 422, parsed.error.flatten());
  }

  const data = parsed.data;
  const capturedAt = new Date(data.captured_at);
  if (Number.isNaN(capturedAt.getTime())) {
    return jsonError("captured_at must be a valid ISO datetime", 422);
  }

  try {
    const row = await store.createHarnessSnapshot({
      snapshotId: data.snapshot_id,
      agentId: data.agent_id,
      sessionId: data.session_id ?? null,
      capturedAt,
      source: data.source,
      instructions: data.instructions,
      tools: data.tools,
      knowledge: data.knowledge,
      memory: data.memory,
      guardrails: data.guardrails,
      delegation: data.delegation,
    });

    return NextResponse.json(
      {
        id: row.id,
        snapshot_id: row.snapshotId,
        agent_id: row.agentId,
        source: row.source,
        captured_at: row.capturedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError("snapshot_id already exists", 409);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ballast:snapshots] create failed", err);
    return jsonError(`Failed to store snapshot: ${message}`, 500);
  }
}
