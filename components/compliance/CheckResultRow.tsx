"use client";

import { useId, useState } from "react";
import { SeverityBadge } from "@/components/SeverityBadge";
import type { PolicyCheckResult } from "@/lib/types";
import { VerdictBadge } from "./VerdictBadge";
import { VerdictExplanation } from "./VerdictExplanation";

export function CheckResultRow({ row }: { row: PolicyCheckResult }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <article className="panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge
          verdict={row.verdict}
          expanded={open}
          controls={panelId}
          onToggle={() => setOpen((current) => !current)}
        />
        <SeverityBadge severity={row.severity} />
        <span className="font-mono text-[11px] text-faint">{row.policyCode}</span>
        <span className="text-sm font-medium">{row.policyName}</span>
        <span className="ml-auto eyebrow">{row.confidence} confidence</span>
      </div>
      {open && (
        <div id={panelId} className="mt-3">
          <VerdictExplanation
            verdict={row.verdict}
            reasoning={row.reasoning}
            evidence={row.evidence}
            recommendation={row.recommendation}
          />
        </div>
      )}
    </article>
  );
}
