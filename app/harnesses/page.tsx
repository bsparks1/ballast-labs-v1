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
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-8">
          <div>
            <p className="eyebrow">System of record</p>
            <h1 className="display-md mt-3">My Harnesses</h1>
            <p className="mt-3 max-w-xl text-sm text-muted">
              Named agent configs you track over time. The one-off audit still lives on the home page.
            </p>
          </div>
          <Link href="/harnesses/new" className="btn btn-primary">
            New harness
          </Link>
        </div>

        {notifications.length > 0 && (
          <div className="mt-6 space-y-0 border border-edge">
            {notifications.map((n, i) => (
              <Link
                key={n.harnessId}
                href={`/harnesses/${n.harnessId}?reanalyzed=1`}
                className={`block border-warning/30 bg-warning-dim/40 px-4 py-3 text-sm text-warning no-underline hover:bg-warning-dim/60 ${
                  i > 0 ? "border-t" : ""
                }`}
              >
                {n.message}
              </Link>
            ))}
          </div>
        )}

        {summaries.length === 0 ? (
          <div className="mt-10 border border-dashed border-edge px-6 py-14 text-center">
            <p className="text-sm text-muted">No saved harnesses yet.</p>
            <Link href="/harnesses/new" className="btn btn-primary mt-4 inline-flex">
              Save your first harness
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-0 border-t border-edge md:grid-cols-2">
            {summaries.map((h, i) => {
              const band = h.currentScore !== null ? scoreBand(h.currentScore) : null;
              return (
                <li
                  key={h.id}
                  className={`border-b border-edge ${i % 2 === 0 ? "md:border-r" : ""}`}
                >
                  <Link
                    href={`/harnesses/${h.id}`}
                    className="card-hover block bg-surface p-6 no-underline transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-medium tracking-tight">{h.name}</h2>
                        {h.description ? <p className="mt-1.5 text-xs text-muted">{h.description}</p> : null}
                      </div>
                      {h.currentScore !== null ? (
                        <span className={`stat-num text-2xl ${band ? BAND_TEXT_CLASS[band] : ""}`}>
                          {h.currentScore}
                        </span>
                      ) : (
                        <span className="eyebrow">No score</span>
                      )}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="eyebrow">
                        {h.findingCount} finding{h.findingCount === 1 ? "" : "s"}
                      </span>
                      {h.currentVersionNumber !== null && <span className="eyebrow">v{h.currentVersionNumber}</span>}
                      <span className="eyebrow">Updated {h.updatedAt.toLocaleString()}</span>
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
