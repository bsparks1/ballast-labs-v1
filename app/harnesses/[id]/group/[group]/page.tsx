import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { loadHarnessView } from "@/lib/harness/service";
import { ReportLinksProvider } from "@/components/report/ReportLinks";
import { StatGroupDetail } from "@/components/report/StatGroupDetail";

export default async function HarnessGroupPage({
  params,
}: PageProps<"/harnesses/[id]/group/[group]">) {
  const { id, group } = await params;
  const user = await requireUser(`/harnesses/${id}`);
  const data = await loadHarnessView(user.id, id);
  if (!data?.report) notFound();

  return (
    <ReportLinksProvider base={{ kind: "harness", harnessId: id }}>
      <StatGroupDetail report={data.report} groupId={group} includeHeader={false} />
    </ReportLinksProvider>
  );
}
