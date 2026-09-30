import type {
  HarnessSnapshotWire,
  ObservationStatus,
  SnapshotComponent,
} from "@/lib/snapshot/types";
import { snapshotCoverage } from "@/lib/snapshot/types";
import { CoverageBadges } from "./CoverageBadges";

type SnapshotView = HarnessSnapshotWire & {
  coverage?: Record<SnapshotComponent, ObservationStatus>;
};

export function SnapshotCard({ snapshot }: { snapshot: SnapshotView }) {
  const coverage = snapshot.coverage ?? snapshotCoverage(snapshot);
  const bound = snapshot.tools.bound_tools ?? [];
  const invoked = bound.filter((t) => t.invoked);
  const boundOnly = bound.filter((t) => !t.invoked);

  return (
    <article className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{new Date(snapshot.captured_at).toLocaleString()}</p>
          <h2 className="mt-1 font-mono text-sm text-foreground">{snapshot.snapshot_id}</h2>
          {snapshot.session_id ? (
            <p className="mt-1 text-xs text-faint">session {snapshot.session_id}</p>
          ) : null}
        </div>
      </div>

      <CoverageBadges coverage={coverage} source={snapshot.source} />

      {snapshot.instructions.status === "observed" && snapshot.instructions.resolved_prompt ? (
        <div>
          <p className="eyebrow">Resolved prompt</p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-sm border border-edge bg-background p-3 text-xs text-muted">
            {snapshot.instructions.resolved_prompt}
          </pre>
          <p className="mt-2 text-xs text-faint">
            {[snapshot.instructions.model, snapshot.instructions.prompt_source]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {snapshot.tools.status === "observed" ? (
        <div>
          <p className="eyebrow">Tools</p>
          <p className="mt-1 text-xs text-muted">
            {invoked.length} invoked · {boundOnly.length} bound but not invoked
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {bound.map((tool) => (
              <li key={tool.name} className="font-mono">
                {tool.name}
                {tool.type ? ` (${tool.type})` : ""} — {tool.invoked ? "invoked" : "bound only"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot.memory.status === "observed" ? (
        <div>
          <p className="eyebrow">Memory ({snapshot.memory.store ?? "unknown"})</p>
          <p className="mt-1 text-xs text-muted">
            read: {(snapshot.memory.keys_read ?? []).join(", ") || "—"}
          </p>
          <p className="text-xs text-muted">
            written: {(snapshot.memory.keys_written ?? []).join(", ") || "—"}
          </p>
        </div>
      ) : null}
    </article>
  );
}
