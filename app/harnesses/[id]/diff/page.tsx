import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { store } from "@/lib/db";
import { loadVersionPair } from "@/lib/harness/service";
import { DiffView } from "@/components/harness/DiffView";

export default async function HarnessDiffPage({
  params,
  searchParams,
}: PageProps<"/harnesses/[id]/diff">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/harnesses/${id}/diff`);
  const from = typeof query.from === "string" ? Number(query.from) : undefined;
  const to = typeof query.to === "string" ? Number(query.to) : undefined;
  const data = await loadVersionPair(
    user.id,
    id,
    Number.isFinite(from) ? from : undefined,
    Number.isFinite(to) ? to : undefined
  );
  if (!data) notFound();

  const versions = await Promise.all(
    data.versions.map(async (v) => {
      const analysis = await store.getLatestAnalysis(v.id);
      return { number: v.versionNumber, score: analysis?.overallScore ?? null };
    })
  );

  return (
    <DiffView
      harnessId={id}
      harnessName={data.harness.name}
      fromNumber={data.fromVersion.versionNumber}
      toNumber={data.toVersion.versionNumber}
      versions={versions}
      diff={data.diff}
    />
  );
}
