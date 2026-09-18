"use client";

import type { CoverageReport, CoverageStatus } from "@/lib/ingest/types";
import { COMPONENT_LABELS } from "@/lib/types";

const STATUS_LABEL: Record<CoverageStatus, string> = {
  extracted: "Extracted",
  partial: "Partial",
  not_found: "Not found",
  not_applicable: "Not applicable",
};

const STATUS_CLASS: Record<CoverageStatus, string> = {
  extracted: "text-healthy",
  partial: "text-warning",
  not_found: "text-muted",
  not_applicable: "text-faint",
};

export function CoveragePanel({
  coverage,
  fillGapsHref,
}: {
  coverage: CoverageReport;
  fillGapsHref?: string;
}) {
  const missing = coverage.components.filter((c) => c.status === "not_found" || c.status === "partial");
  return (
    <section className="rounded-md border border-edge bg-surface p-4 sm:p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
        Repo coverage
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{coverage.summary}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-faint">
        {coverage.framework} · {coverage.language} · {coverage.filesRead} files read of {coverage.filesScanned} listed
      </p>
      <ul className="mt-4 divide-y divide-edge">
        {coverage.components.map((c) => (
          <li key={c.component} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{COMPONENT_LABELS[c.component]}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{c.detail}</p>
            </div>
            <span className={`shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest ${STATUS_CLASS[c.status]}`}>
              {STATUS_LABEL[c.status]}
            </span>
          </li>
        ))}
      </ul>
      {coverage.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {coverage.warnings.map((w) => (
            <li key={w} className="text-xs text-warning">
              {w}
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && fillGapsHref && (
        <p className="mt-3 text-xs text-muted">
          Missing pieces can be pasted in.{" "}
          <a href={fillGapsHref} className="text-accent hover:text-foreground">
            Add them manually
          </a>
          .
        </p>
      )}
    </section>
  );
}
