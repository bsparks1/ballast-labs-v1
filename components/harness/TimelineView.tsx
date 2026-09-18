import Link from "next/link";
import type { TimelinePoint } from "@/lib/harness/timeline";
import { BAND_TEXT_CLASS, scoreBand } from "@/lib/format";

export function TimelineView({
  harnessId,
  points,
}: {
  harnessId: string;
  points: TimelinePoint[];
}) {
  if (points.length === 0) {
    return (
      <section className="rounded-md border border-edge bg-surface p-8 text-center">
        <p className="text-sm text-muted">No versions yet.</p>
      </section>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-edge ml-3">
      {[...points].reverse().map((point, index) => {
        const score = point.score;
        const band = score !== null ? scoreBand(score) : null;
        const delta = point.delta;
        const deltaColor =
          delta === null || delta === 0 ? "text-faint" : delta > 0 ? "text-healthy" : "text-critical";
        const deltaLabel =
          delta === null ? "" : delta === 0 ? "unchanged" : delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`;
        return (
          <li key={point.version.id} className="relative pb-8 pl-6 last:pb-0">
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-edge-strong bg-accent" />
            <div className="rounded-md border border-edge bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
                    Version {point.version.versionNumber}
                    {index === 0 ? " · current" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {point.version.createdAt.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  {score !== null ? (
                    <p className={`text-2xl font-semibold tabular-nums ${band ? BAND_TEXT_CLASS[band] : ""}`}>
                      {score}
                    </p>
                  ) : (
                    <p className="text-sm text-faint">No analysis</p>
                  )}
                  {deltaLabel && <p className={`font-mono text-[11px] ${deltaColor}`}>{deltaLabel}</p>}
                </div>
              </div>
              {point.note && (
                <p className="mt-3 rounded-sm border border-edge bg-background px-3 py-2 text-sm">
                  “{point.note}”
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-muted">{point.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/harnesses/${harnessId}?version=${point.version.versionNumber}`}
                  className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground"
                >
                  View analysis
                </Link>
                {point.version.versionNumber > 1 && (
                  <Link
                    href={`/harnesses/${harnessId}/diff?from=${point.version.versionNumber - 1}&to=${point.version.versionNumber}`}
                    className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground"
                  >
                    Diff vs previous
                  </Link>
                )}
                {index !== 0 && (
                  <Link
                    href={`/harnesses/${harnessId}/diff?from=${point.version.versionNumber}&to=${points[points.length - 1].version.versionNumber}`}
                    className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground"
                  >
                    Diff vs current
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
