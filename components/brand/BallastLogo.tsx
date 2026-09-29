/** Ballast waterline-stack mark — three bars, widest on top. */
export function BallastMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 86 78"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {/* Waterline — brand blue on dark; follows currentColor in .light */}
      <rect className="ballast-mark-waterline" x="0" y="0" width="86" height="7" />
      <rect className="ballast-mark-body" x="15" y="25" width="56" height="21" />
      <rect className="ballast-mark-body" x="24" y="55" width="38" height="22" />
    </svg>
  );
}

/** Horizontal lockup: mark + Ballast Labs wordmark. */
export function BallastLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <BallastMark className="ballast-mark h-5 w-auto" />
      <span className="flex items-baseline gap-1.5 tracking-tight">
        <span className="text-sm font-semibold text-foreground">Ballast</span>
        <span className="text-sm font-normal text-muted">Labs</span>
      </span>
    </span>
  );
}
