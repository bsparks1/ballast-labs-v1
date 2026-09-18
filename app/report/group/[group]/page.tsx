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
import { StatGroupDetail } from "@/components/report/StatGroupDetail";

export default function StatGroupPage() {
  const params = useParams<{ group: string }>();
  const report = useSyncExternalStore(subscribeReport, getReportSnapshot, getServerReportSnapshot);

  if (report === undefined) return null;

  if (!report) {
    return (
      <>
        <Header />
        <div className="mx-auto w-full max-w-4xl p-6">
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
    <ReportLinksProvider base={{ kind: "session" }}>
      <StatGroupDetail report={report} groupId={params.group} />
    </ReportLinksProvider>
  );
}
