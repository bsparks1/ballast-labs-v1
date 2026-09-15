/**
 * Client-side report persistence for the current session.
 *
 * V1 has no database — the report lives in sessionStorage between the input
 * screen and the dashboard. This module is the seam: to add a DB later,
 * replace these functions with fetches against a reports API.
 */

import type { HarnessReport } from "@/lib/types";

const KEY = "ballast:report";

export function saveReport(report: HarnessReport): void {
  sessionStorage.setItem(KEY, JSON.stringify(report));
  cachedRaw = undefined; // invalidate snapshot cache
}

// --- useSyncExternalStore adapters -----------------------------------------
// getSnapshot must return a referentially stable value, so we cache the
// parsed report keyed on the raw string.

let cachedRaw: string | null | undefined; // undefined = cache invalid
let cachedReport: HarnessReport | null = null;

/** Client snapshot: the report for this session, or null if none. */
export function getReportSnapshot(): HarnessReport | null {
  const raw = sessionStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedReport = raw ? (JSON.parse(raw) as HarnessReport) : null;
    } catch {
      cachedReport = null;
    }
  }
  return cachedReport;
}

/** Server snapshot: undefined = "unknown yet" (render nothing during hydration). */
export function getServerReportSnapshot(): HarnessReport | null | undefined {
  return undefined;
}

/** The report only changes via full-page navigation in V1; no subscription needed. */
export function subscribeReport(): () => void {
  return () => {};
}
