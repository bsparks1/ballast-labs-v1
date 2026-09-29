import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

/** Section with optional eyebrow + hairline top border for blueprint grid feel. */
export function Section({
  eyebrow,
  title,
  children,
  className = "",
  hairline = true,
}: {
  eyebrow?: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  hairline?: boolean;
}) {
  return (
    <section className={`${hairline ? "border-t border-edge pt-10" : ""} ${className}`.trim()}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {title ? (
        <h2 className={`display-md ${eyebrow ? "mt-3" : ""}`.trim()}>{title}</h2>
      ) : null}
      <div className={eyebrow || title ? "mt-6" : undefined}>{children}</div>
    </section>
  );
}
