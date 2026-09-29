"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getReportSnapshot,
  getServerReportSnapshot,
  subscribeReport,
} from "@/lib/report-store";
import { Header } from "@/components/Header";
import { ReportLinksProvider } from "@/components/report/ReportLinks";
import { ComponentDetail } from "@/components/report/ComponentDetail";

export default function ComponentDrilldown() {
  const params = useParams<{ component: string }>();
  const report = useSyncExternalStore(subscribeReport, getReportSnapshot, getServerReportSnapshot);

  if (report === undefined) return null;

  if (!report) {
    return (
      <>
        <Header />
        <div className="mx-auto w-full max-w-4xl p-6">
          <div className="panel p-8 text-center">
            <p className="text-sm text-muted">No analysis in this session.</p>
            <Link
              href="/"
              className="btn btn-primary mt-3 inline-flex"
            >
              Analyze a harness
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <ReportLinksProvider base={{ kind: "session" }}>
      <ComponentDetail report={report} component={params.component} />
    </ReportLinksProvider>
  );
}
