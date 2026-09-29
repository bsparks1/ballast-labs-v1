"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { suffix: "", label: "Overview", match: "overview" },
  { suffix: "/diff", label: "Diff", match: "diff" },
  { suffix: "/timeline", label: "Timeline", match: "timeline" },
  { suffix: "/compliance", label: "Compliance", match: "compliance" },
  { suffix: "/edit", label: "Update", match: "edit" },
] as const;

export function HarnessNav({ harnessId }: { harnessId: string }) {
  const pathname = usePathname();
  const base = `/harnesses/${harnessId}`;

  function active(match: (typeof TABS)[number]["match"]): boolean {
    if (match === "overview") {
      return pathname === base || pathname.startsWith(`${base}/components`) || pathname.startsWith(`${base}/group`);
    }
    return pathname.startsWith(`${base}/${match}`);
  }

  return (
    <nav className="flex flex-wrap gap-1 border-b border-edge">
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const isActive = active(tab.match);
        return (
          <Link
            key={tab.label}
            href={href}
            className={`px-3 py-2 eyebrow no-underline transition-colors ${
              isActive ? "border-b-2 border-accent-fill text-foreground" : "text-faint hover:text-muted"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
