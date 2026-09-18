"use client";

import { createContext, useContext } from "react";
import {
  reportComponentHref,
  reportGroupHref,
  reportOverviewHref,
  type ReportLinkBase,
} from "@/lib/report-links";

const defaultBase: ReportLinkBase = { kind: "session" };
const Ctx = createContext<ReportLinkBase>(defaultBase);

export function ReportLinksProvider({
  base,
  children,
}: {
  base: ReportLinkBase;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={base}>{children}</Ctx.Provider>;
}

export function useReportLinks() {
  const base = useContext(Ctx);
  return {
    overview: reportOverviewHref(base),
    component: (c: string) => reportComponentHref(base, c),
    group: (g: string) => reportGroupHref(base, g),
  };
}
