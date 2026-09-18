"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  getReportSnapshot,
  getServerReportSnapshot,
  subscribeReport,
} from "@/lib/report-store";
import { Header } from "@/components/Header";
import { ReportLinksProvider } from "@/components/report/ReportLinks";
import { ReportOverview } from "@/components/report/ReportOverview";
import { SaveHarnessButton } from "@/components/harness/SaveHarnessButton";
import { CoveragePanel } from "@/components/ingest/CoveragePanel";
import { FillGapsForm } from "@/components/ingest/FillGapsForm";

export default function ReportPage() {
  const report = useSyncExternalStore(subscribeReport, getReportSnapshot, getServerReportSnapshot);

  if (report === undefined) return null;

  if (!report) {
    return (
      <>
        <Header />
        <div className="mx-auto w-full max-w-6xl p-6">
          <div className="rounded-md border border-edge bg-surface p-8 text-center">
            <p className="text-sm text-muted">No analysis in this session.</p>
            <Link
              href="/"
              className="mt-3 inline-block rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Analyze a harness
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        right={
          <Link href="/" className="text-xs text-muted hover:text-foreground">
            New analysis
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
        <SaveHarnessButton />
        {report.meta.ingestion && <CoveragePanel coverage={report.meta.ingestion.coverage} />}
        {report.meta.ingestion && <FillGapsForm />}
        <ReportLinksProvider base={{ kind: "session" }}>
          <ReportOverview report={report} />
        </ReportLinksProvider>
      </div>
    </>
  );
}
