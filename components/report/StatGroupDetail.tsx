"use client";

import Link from "next/link";
import type { HarnessReport } from "@/lib/types";
import {
  STAT_GROUPS,
  findingsForGroup,
  instructionsForGroup,
  isStatGroupId,
  relatedFindings,
  reportFindings,
} from "@/lib/stat-groups";
import { Header } from "@/components/Header";
import { FindingCard } from "@/components/FindingCard";
import { InstructionItem } from "@/components/InstructionItem";
import { useReportLinks } from "./ReportLinks";

export function StatGroupDetail({
  report,
  groupId,
  includeHeader = true,
}: {
  report: HarnessReport;
  groupId: string;
  includeHeader?: boolean;
}) {
  const links = useReportLinks();
  const valid = isStatGroupId(groupId);
  const group = valid ? STAT_GROUPS[groupId] : null;

  if (!group) {
    return (
      <>
        {includeHeader && <Header />}
        <div className="mx-auto w-full max-w-4xl p-6">
          <div className="panel p-8 text-center">
            <p className="text-sm text-muted">Unknown grouping.</p>
            <Link
              href={links.overview}
              className="btn btn-primary mt-3 inline-flex"
            >
              Back to report
            </Link>
          </div>
        </div>
      </>
    );
  }

  const findings = group.kind === "findings" ? findingsForGroup(report, group.id) : [];
  const instructions = group.kind === "instructions" ? instructionsForGroup(report, group.id) : [];
  const allFindings = reportFindings(report);
  const count = group.kind === "findings" ? findings.length : instructions.length;

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
        <section className="panel p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Report grouping</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-medium tracking-tight">{group.title}</h1>
              <p className="mt-1 text-sm text-muted">{group.description}</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{count}</p>
          </div>
        </section>

        {count === 0 ? (
          <section className="panel p-6 text-center">
            <p className="text-sm font-medium text-faint">{group.empty}</p>
          </section>
        ) : group.kind === "findings" ? (
          <section className="space-y-3">
            <h2 className="eyebrow">
              {`${findings.length} finding${findings.length === 1 ? "" : "s"}`}
            </h2>
            {findings.map((f) => (
              <FindingCard key={f.id} finding={f} showComponent />
            ))}
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="eyebrow">
              {`${instructions.length} instruction${instructions.length === 1 ? "" : "s"}`}
            </h2>
            {instructions.map((item) => {
              const related = group.id === "absolute-rules" ? relatedFindings(allFindings, item) : [];
              return (
                <article key={item.id} className="panel p-4 sm:p-5">
                  <InstructionItem instruction={item} />
                  {group.id === "fossils" && (
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      Dead scaffolding quoted from the prompt. Deleting it does not change agent behavior; it only
                      recovers tokens and removes noise from the instruction set.
                    </p>
                  )}
                  {related.length > 0 && (
                    <div className="mt-4 space-y-3 border-t border-edge pt-4">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-faint">
                        Related audit
                      </p>
                      {related.map((f) => (
                        <FindingCard key={f.id} finding={f} showComponent />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
