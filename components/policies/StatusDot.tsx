import type { PolicyLifecycle } from "@/lib/types";

export const STATUS_LABEL: Record<PolicyLifecycle, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
};

const DOT: Record<PolicyLifecycle, string> = {
  active: "status-pulse bg-healthy",
  paused: "bg-warning",
  draft: "border border-muted bg-transparent",
};

const TEXT: Record<PolicyLifecycle, string> = {
  active: "text-healthy",
  paused: "text-warning",
  draft: "text-muted",
};

export function StatusDot({
  status,
  size = "sm",
  quiet = false,
}: {
  status: PolicyLifecycle;
  size?: "sm" | "md";
  quiet?: boolean;
}) {
  const text = quiet ? "text-muted" : TEXT[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${text}`}>
      <span
        aria-hidden
        className={`inline-block shrink-0 rounded-full ${size === "md" ? "h-2.5 w-2.5" : "h-2 w-2"} ${DOT[status]}`}
      />
      <span className={`eyebrow ${size === "md" ? "text-[11px]" : "text-[10px]"} ${text}`}>
        {STATUS_LABEL[status]}
      </span>
    </span>
  );
}
