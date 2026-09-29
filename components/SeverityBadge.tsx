import type { Severity } from "@/lib/types";
import { SEVERITY_BADGE_CLASS } from "@/lib/format";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${SEVERITY_BADGE_CLASS[severity]}`}
    >
      {severity}
    </span>
  );
}
