"use client";

import Link from "next/link";
import type { ComponentReport, HarnessComponent, HarnessReport } from "@/lib/types";
import { COMPONENT_LABELS, COMPONENT_DESCRIPTIONS, HARNESS_COMPONENTS } from "@/lib/types";
import { BAND_TEXT_CLASS, scoreBand } from "@/lib/format";
import { Header } from "@/components/Header";
import { FindingCard } from "@/components/FindingCard";
import { InstructionItem } from "@/components/InstructionItem";
import { useReportLinks } from "./ReportLinks";

export function ComponentDetail({
  report,
  component,
  includeHeader = true,
}: {
  report: HarnessReport;
  component: string;
  includeHeader?: boolean;
}) {
  const links = useReportLinks();
  const valid = HARNESS_COMPONENTS.includes(component as HarnessComponent);
  const componentReport: ComponentReport | undefined = report.components.find(
    (c) => c.component === component
  );

  if (!valid || !componentReport) {
    return (
      <>
        {includeHeader && <Header />}
        <div className="mx-auto w-full max-w-4xl p-6">
          <div className="rounded-md border border-edge bg-surface p-8 text-center">
            <p className="text-sm text-muted">{!valid ? "Unknown component." : "Component not in this report."}</p>
            <Link
              href={links.overview}
              className="mt-3 inline-block rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Back to report
            </Link>
          </div>
        </div>
      </>
    );
  }

  const notApplicable = componentReport.status === "not_applicable";
  const band = scoreBand(componentReport.healthScore);

  return (
    <>
      {includeHeader && (
        <Header
          right={
            <Link href={links.overview} className="text-xs text-muted hover:text-foreground">
              ← Back to overview
            </Link>
          }
        />
      )}
      <div className={`mx-auto w-full max-w-4xl flex-1 space-y-5 ${includeHeader ? "p-4 sm:p-6" : ""}`}>
        <section className="rounded-md border border-edge bg-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Harness component</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                {COMPONENT_LABELS[component as HarnessComponent]}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {COMPONENT_DESCRIPTIONS[component as HarnessComponent]}
              </p>
            </div>
            <div className="text-right">
              {notApplicable ? (
                <>
                  <p className="font-mono text-lg font-semibold uppercase tracking-widest text-faint">N/A</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-faint">not present</p>
                </>
              ) : (
                <>
                  <p className={`text-3xl font-semibold tabular-nums ${BAND_TEXT_CLASS[band]}`}>
                    {componentReport.healthScore}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-faint">/ 100</p>
                </>
              )}
            </div>
          </div>
          {componentReport.rawSummary && (
            <p className="mt-4 border-t border-edge pt-3 text-xs leading-relaxed text-muted">
              {componentReport.rawSummary}
            </p>
          )}
        </section>

        {notApplicable ? (
          <section className="rounded-md border border-edge bg-surface p-6 text-center">
            <p className="text-sm font-medium text-faint">N/A — not present in this harness</p>
            <p className="mt-1 text-xs text-muted">
              This component was not exercised in the prompt, so it is excluded from the overall score. That is
              different from a healthy check with no findings.
            </p>
          </section>
        ) : componentReport.findings.length === 0 ? (
          <section className="rounded-md border border-healthy/30 bg-healthy-dim/40 p-6 text-center">
            <p className="text-sm font-medium text-healthy">Healthy — no findings</p>
            <p className="mt-1 text-xs text-muted">
              Nothing in this component tripped a structural or model-graded check.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
              {`${componentReport.findings.length} finding${componentReport.findings.length === 1 ? "" : "s"}`}
            </h2>
            {componentReport.findings.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </section>
        )}

        {component === "tools" && componentReport.tools && componentReport.tools.length > 0 && (
          <section className="rounded-md border border-edge bg-surface">
            <h2 className="border-b border-edge px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
              Parsed tool grants
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left font-mono text-[10px] uppercase tracking-widest text-faint">
                  <th className="px-4 py-2 font-medium">Tool</th>
                  <th className="px-4 py-2 font-medium">Permissions</th>
                  <th className="px-4 py-2 font-medium">Exercised</th>
                </tr>
              </thead>
              <tbody>
                {componentReport.tools.map((t) => (
                  <tr key={t.name} className="border-b border-edge last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{t.name}</td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap gap-1">
                        {t.permissions.map((p) => (
                          <span
                            key={p}
                            className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                              ["delete", "admin", "deploy", "execute"].includes(p)
                                ? "bg-critical-dim text-critical"
                                : p === "write"
                                  ? "bg-warning-dim text-warning"
                                  : "bg-surface-raised text-muted"
                            }`}
                          >
                            {p}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {t.exercised === true ? (
                        <span className="text-healthy">yes</span>
                      ) : t.exercised === false ? (
                        <span className="text-critical">never</span>
                      ) : (
                        <span className="text-faint">unknown</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {component === "instructions" &&
          componentReport.instructions &&
          componentReport.instructions.length > 0 && (
            <section className="rounded-md border border-edge bg-surface">
              <h2 className="border-b border-edge px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
                Full decomposition — {componentReport.instructions.length} atomic instructions
              </h2>
              <ul>
                {componentReport.instructions.map((item) => (
                  <li key={item.id} className="border-b border-edge px-4 py-2.5 last:border-0">
                    <InstructionItem instruction={item} />
                  </li>
                ))}
              </ul>
            </section>
          )}
      </div>
    </>
  );
}
