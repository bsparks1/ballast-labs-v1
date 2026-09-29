import type { ReactNode } from "react";

/** Uppercase wide-tracked section label — signature editorial device. */
export function Eyebrow({
  children,
  className = "",
  as: Tag = "p",
}: {
  children: ReactNode;
  className?: string;
  as?: "p" | "span" | "h2" | "h3" | "div";
}) {
  return <Tag className={`eyebrow ${className}`.trim()}>{children}</Tag>;
}
