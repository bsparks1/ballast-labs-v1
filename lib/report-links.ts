export type ReportLinkBase = { kind: "session" } | { kind: "harness"; harnessId: string };

export function reportOverviewHref(base: ReportLinkBase): string {
  return base.kind === "session" ? "/report" : `/harnesses/${base.harnessId}`;
}

export function reportComponentHref(base: ReportLinkBase, component: string): string {
  return base.kind === "session"
    ? `/report/${component}`
    : `/harnesses/${base.harnessId}/components/${component}`;
}

export function reportGroupHref(base: ReportLinkBase, group: string): string {
  return base.kind === "session"
    ? `/report/group/${group}`
    : `/harnesses/${base.harnessId}/group/${group}`;
}
