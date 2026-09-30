import Link from "next/link";
import { Header } from "@/components/Header";
import { SnapshotCard } from "@/components/runtime/SnapshotCard";
import { store } from "@/lib/db";
import { snapshotCoverage } from "@/lib/snapshot/types";

export default async function RuntimeAgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: raw } = await params;
  const agentId = decodeURIComponent(raw);
  const rows = await store.listHarnessSnapshots(agentId, { limit: 50 });

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 sm:py-10">
        <div className="border-b border-edge pb-8">
          <p className="eyebrow">Runtime capture</p>
          <h1 className="display-md mt-3">{agentId}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Per-invocation harness snapshots.{" "}
            <span className="text-faint">
              Not observed means this capture path could not see the component — never scored as
              clean.
            </span>
          </p>
          <p className="mt-2 text-xs text-faint">
            Dogfood:{" "}
            <Link
              href="/runtime/dogfood-procurement-agent"
              className="text-accent no-underline hover:text-foreground"
            >
              dogfood-procurement-agent
            </Link>
          </p>
        </div>

        {rows.length === 0 ? (
          <section className="panel mt-8 p-8 text-center">
            <p className="text-sm text-muted">No snapshots for this agent yet.</p>
            <p className="mt-2 text-xs text-faint">
              Run <code className="font-mono">python examples/dogfood_agent.py</code> with the
              collector at <code className="font-mono">/api/v1/snapshots</code>.
            </p>
          </section>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((row) => (
              <SnapshotCard
                key={row.id}
                snapshot={{
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
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
