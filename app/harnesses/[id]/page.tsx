import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { store } from "@/lib/db";
import { diffAnalyses } from "@/lib/harness/diff";
import { loadHarnessView } from "@/lib/harness/service";
import { ReportLinksProvider } from "@/components/report/ReportLinks";
import { ReportOverview } from "@/components/report/ReportOverview";
import { ReanalyzeButton } from "@/components/harness/ReanalyzeButton";
import { WhatsNewBanner } from "@/components/harness/WhatsNewBanner";
import { CoveragePanel } from "@/components/ingest/CoveragePanel";

export default async function HarnessOverviewPage({
  params,
  searchParams,
}: PageProps<"/harnesses/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/harnesses/${id}`);
  const versionParam = typeof query.version === "string" ? Number(query.version) : undefined;
  const versionNumber = Number.isFinite(versionParam) ? versionParam : undefined;
  const data = await loadHarnessView(user.id, id, versionNumber);
  if (!data) notFound();

  await store.markHarnessViewed(user.id, id);

  const analyses = await store.listAnalyses(data.version.id);
  const previousOnVersion = analyses.length >= 2 ? analyses[analyses.length - 2] : null;
  const whatsNew =
    previousOnVersion && data.analysis ? diffAnalyses(previousOnVersion, data.analysis) : null;
  const showWhatsNew = query.reanalyzed === "1" || (whatsNew && whatsNew.new.length > 0);

  const latestVersion = data.versions[data.versions.length - 1];
  const viewingLatest = latestVersion && data.version.id === latestVersion.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
          Version {data.version.versionNumber}
          {viewingLatest ? " · current" : " · historical"}
          {data.version.note ? ` · ${data.version.note}` : ""}
          {data.version.createdAt ? ` · ${data.version.createdAt.toLocaleString()}` : ""}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.versions.length > 1 && viewingLatest && (
            <Link
              href={`/harnesses/${id}/diff?from=${data.version.versionNumber - 1}&to=${data.version.versionNumber}`}
              className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground"
            >
              Diff vs previous
            </Link>
          )}
          <Link
            href={`/api/harnesses/${id}/export`}
            className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground"
          >
            Export history
          </Link>
          <ReanalyzeButton harnessId={id} versionId={data.version.id} />
        </div>
      </div>

      {showWhatsNew && whatsNew && data.analysis && (
        <WhatsNewBanner
          harnessId={id}
          whatsNew={whatsNew}
          previousScore={previousOnVersion?.overallScore ?? null}
          currentScore={data.analysis.overallScore}
        />
      )}

      {!viewingLatest && (
        <p className="rounded-sm border border-edge bg-surface px-3 py-2 text-xs text-muted">
          Viewing a historical version.{" "}
          <Link href={`/harnesses/${id}`} className="text-accent hover:text-foreground">
            Jump to current
          </Link>
        </p>
      )}

      {data.report?.meta.ingestion && (
        <CoveragePanel
          coverage={data.report.meta.ingestion.coverage}
          fillGapsHref={`/harnesses/${id}/edit`}
        />
      )}

      {data.report ? (
        <ReportLinksProvider base={{ kind: "harness", harnessId: id }}>
          <ReportOverview report={data.report} />
        </ReportLinksProvider>
      ) : (
        <section className="rounded-md border border-edge bg-surface p-8 text-center">
          <p className="text-sm text-muted">No analysis stored for this version.</p>
          <div className="mt-3 flex justify-center">
            <ReanalyzeButton harnessId={id} versionId={data.version.id} />
          </div>
        </section>
      )}
    </div>
  );
}
