import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { loadHarnessView } from "@/lib/harness/service";
import { ReportLinksProvider } from "@/components/report/ReportLinks";
import { ComponentDetail } from "@/components/report/ComponentDetail";

export default async function HarnessComponentPage({
  params,
}: PageProps<"/harnesses/[id]/components/[component]">) {
  const { id, component } = await params;
  const user = await requireUser(`/harnesses/${id}`);
  const data = await loadHarnessView(user.id, id);
  if (!data?.report) notFound();

  return (
    <ReportLinksProvider base={{ kind: "harness", harnessId: id }}>
      <ComponentDetail report={data.report} component={component} includeHeader={false} />
    </ReportLinksProvider>
  );
}
