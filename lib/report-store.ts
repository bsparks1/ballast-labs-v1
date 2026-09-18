/**
 * Client-side report persistence for the current one-off audit session.
 * Named harnesses are stored server-side (see lib/db). This keeps the
 * paste-once audit working without an account.
 */

import type { HarnessReport } from "@/lib/types";

const KEY = "ballast:report";
const INPUT_KEY = "ballast:input";

export type SessionInput = { prompt: string; config?: string };

const listeners = new Set<() => void>();

function notify() {
  cachedRaw = undefined;
  for (const listener of listeners) listener();
}

export function saveReport(report: HarnessReport, input?: SessionInput): void {
  sessionStorage.setItem(KEY, JSON.stringify(report));
  if (input) sessionStorage.setItem(INPUT_KEY, JSON.stringify(input));
  notify();
}

export function getSessionInput(): SessionInput | null {
  try {
    const raw = sessionStorage.getItem(INPUT_KEY);
    return raw ? (JSON.parse(raw) as SessionInput) : null;
  } catch {
    return null;
  }
}

let cachedRaw: string | null | undefined;
let cachedReport: HarnessReport | null = null;

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

export function getServerReportSnapshot(): HarnessReport | null | undefined {
  return undefined;
}

export function subscribeReport(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}
