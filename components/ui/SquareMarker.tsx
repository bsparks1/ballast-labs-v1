import type { ReactNode } from "react";

/** Small solid square marker + content — replaces round bullets. */
export function SquareMarker({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-start gap-2.5 ${className}`.trim()}>
      <span aria-hidden className="marker mt-[0.45em]" />
      <span>{children}</span>
    </span>
  );
}

/** Arrow-joined phrase pair: "Tool granted → never used" */
export function ArrowPair({
  from,
  to,
  className = "",
}: {
  from: ReactNode;
  to: ReactNode;
  className?: string;
}) {
  return (
    <span className={`arrow-pair ${className}`.trim()}>
      <span>{from}</span>
      <span aria-hidden className="arrow-sep">
        →
      </span>
      <span>{to}</span>
    </span>
  );
}
