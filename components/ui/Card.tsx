import type { ReactNode } from "react";

/** Sharp hairline card. Use interactive for hover lift on clickable cards. */
export function Card({
  children,
  className = "",
  interactive = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  as?: "div" | "article" | "li" | "section";
}) {
  return (
    <Tag className={`card ${interactive ? "card-hover" : ""} ${className}`.trim()}>{children}</Tag>
  );
}
