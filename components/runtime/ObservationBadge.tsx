import type { ObservationStatus } from "@/lib/snapshot/types";

const LABELS: Record<ObservationStatus, string> = {
  observed: "Observed",
  not_observed: "Not observed — connect runtime to govern this component.",
  absent: "Absent",
};

const STYLES: Record<ObservationStatus, string> = {
  observed: "border-edge bg-surface text-foreground",
  not_observed: "border-dashed border-edge bg-transparent text-faint",
  absent: "border-edge bg-surface/50 text-muted",
};

export function ObservationBadge({ status }: { status: ObservationStatus }) {
  return (
    <span
      className={`inline-block max-w-full rounded-sm border px-2 py-1 text-[11px] leading-snug ${STYLES[status]}`}
      title={LABELS[status]}
    >
      {LABELS[status]}
    </span>
  );
}
