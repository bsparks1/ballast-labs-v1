import Link from "next/link";
import { Header } from "@/components/Header";
import { requireUser } from "@/lib/auth/current-user";
import { store } from "@/lib/db";
import { notificationForHarness } from "@/lib/harness/notifications";
import { BAND_TEXT_CLASS, scoreBand } from "@/lib/format";

export default async function HarnessesPage() {
  const user = await requireUser("/harnesses");
  const summaries = await store.listHarnessSummaries(user.id);
  const notifications = (
    await Promise.all(
      summaries.map(async (summary) => {
        if (!summary.currentVersionId) return null;
        const analyses = await store.listAnalyses(summary.currentVersionId);
        const latest = analyses[analyses.length - 1] ?? null;
        const previous = analyses.length >= 2 ? analyses[analyses.length - 2] : null;
        return notificationForHarness(summary, previous, latest);
      })
    )
  ).filter((n) => n !== null);

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
              System of record
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">My Harnesses</h1>
            <p className="mt-1 text-sm text-muted">
              Named agent configs you track over time. The one-off audit still lives on the home page.
            </p>
          </div>
          <Link
            href="/harnesses/new"
            className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            New harness
          </Link>
        </div>

        {notifications.length > 0 && (
          <div className="mt-6 space-y-2">
            {notifications.map((n) => (
              <Link
                key={n.harnessId}
                href={`/harnesses/${n.harnessId}?reanalyzed=1`}
                className="block rounded-md border border-warning/40 bg-warning-dim/50 px-4 py-3 text-sm text-warning hover:border-warning"
              >
                {n.message}
              </Link>
            ))}
          </div>
        )}

        {summaries.length === 0 ? (
          <div className="mt-8 rounded-md border border-edge bg-surface p-10 text-center">
            <p className="text-sm text-muted">No saved harnesses yet.</p>
            <Link
              href="/harnesses/new"
              className="mt-3 inline-block rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Save your first harness
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {summaries.map((h) => {
              const band = h.currentScore !== null ? scoreBand(h.currentScore) : null;
              return (
                <li key={h.id}>
                  <Link
                    href={`/harnesses/${h.id}`}
                    className="block rounded-md border border-edge bg-surface p-5 transition-colors hover:border-edge-strong hover:bg-surface-raised"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">{h.name}</h2>
                        {h.description ? (
                          <p className="mt-1 text-xs text-muted">{h.description}</p>
                        ) : null}
                      </div>
                      {h.currentScore !== null ? (
                        <span className={`text-2xl font-semibold tabular-nums ${band ? BAND_TEXT_CLASS[band] : ""}`}>
                          {h.currentScore}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-faint">No score</span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-faint">
                      <span>
                        {h.findingCount} finding{h.findingCount === 1 ? "" : "s"}
                      </span>
                      {h.currentVersionNumber !== null && <span>v{h.currentVersionNumber}</span>}
                      <span>Updated {h.updatedAt.toLocaleString()}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
