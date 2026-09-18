import { STAT_GROUP_IDS } from "@/lib/stat-groups";

export function generateStaticParams() {
  return STAT_GROUP_IDS.map((group) => ({ group }));
}

export default function StatGroupLayout({ children }: LayoutProps<"/report/group/[group]">) {
  return children;
}
