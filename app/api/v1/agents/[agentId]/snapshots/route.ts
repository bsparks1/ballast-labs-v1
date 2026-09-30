import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { snapshotCoverage } from "@/lib/snapshot/types";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  if (!agentId?.trim()) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const rows = await store.listHarnessSnapshots(agentId.trim(), { limit: 50 });
  return NextResponse.json({
    agent_id: agentId.trim(),
    snapshots: rows.map((row) => ({
      id: row.id,
      snapshot_id: row.snapshotId,
      agent_id: row.agentId,
      session_id: row.sessionId,
      captured_at: row.capturedAt.toISOString(),
      source: row.source,
      instructions: row.instructions,
      tools: row.tools,
      knowledge: row.knowledge,
      memory: row.memory,
      guardrails: row.guardrails,
      delegation: row.delegation,
      coverage: snapshotCoverage(row),
    })),
  });
}
