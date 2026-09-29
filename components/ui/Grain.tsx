import type { ReactNode } from "react";

/** Dark cinematic panel with subtle film grain. */
export function Grain({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header";
}) {
  return <Tag className={`grain ${className}`.trim()}>{children}</Tag>;
}
