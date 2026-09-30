import type { ObservationStatus, SnapshotComponent, SnapshotIngestionSource } from "@/lib/snapshot/types";
import { SNAPSHOT_COMPONENTS } from "@/lib/snapshot/types";
import { ObservationBadge } from "./ObservationBadge";

const COMPONENT_LABELS: Record<SnapshotComponent, string> = {
  instructions: "Instructions",
  tools: "Tools",
  knowledge: "Knowledge",
  memory: "Memory",
  guardrails: "Guardrails",
  delegation: "Delegation",
};

const SOURCE_LABELS: Record<SnapshotIngestionSource, string> = {
  sdk: "SDK",
  otel: "OTel",
  static_repo: "Static repo",
};

export function CoverageBadges({
  coverage,
  source,
}: {
  coverage: Record<SnapshotComponent, ObservationStatus>;
  source: SnapshotIngestionSource;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Source</span>
        <span className="rounded-sm border border-edge px-2 py-0.5 text-[11px] text-muted">
          {SOURCE_LABELS[source]}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SNAPSHOT_COMPONENTS.map((component) => (
          <div key={component} className="space-y-1 border border-edge bg-surface/40 p-3">
            <p className="eyebrow">{COMPONENT_LABELS[component]}</p>
            <ObservationBadge status={coverage[component]} />
          </div>
        ))}
      </div>
    </div>
  );
}
