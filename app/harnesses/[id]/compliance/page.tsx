import Link from "next/link";
import { notFound } from "next/navigation";
import { ComplianceReportView } from "@/components/compliance/ComplianceReportView";
import { RecheckButton } from "@/components/compliance/RecheckButton";
import { requireUser } from "@/lib/auth/current-user";
import { ensureStarterPolicies } from "@/lib/compliance/seed";
import { selectPoliciesForAnalysis, complianceReportCoversActive } from "@/lib/compliance/lifecycle";
import { recordCompliance } from "@/lib/compliance/run";
import { store } from "@/lib/db";

export default async function HarnessCompliancePage({
  params,
  searchParams,
}: PageProps<"/harnesses/[id]/compliance">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/harnesses/${id}/compliance`);
  const harness = await store.getHarness(user.id, id);
  if (!harness) notFound();

  await ensureStarterPolicies();
  const policies = await store.listUserPolicies(user.id);
  const active = selectPoliciesForAnalysis(policies);
  const versions = await store.listVersions(harness.id);
  const versionParam = typeof query.version === "string" ? Number(query.version) : undefined;
  const version =
    versionParam && Number.isFinite(versionParam)
      ? versions.find((item) => item.versionNumber === versionParam) ?? null
      : versions[versions.length - 1] ?? null;
  if (!version) notFound();

  let report = await store.getLatestComplianceReport(version.id);
  const viewingLatest = versions[versions.length - 1]?.id === version.id;
  if (
    viewingLatest &&
    active.length > 0 &&
    !complianceReportCoversActive(report?.results ?? [], active)
  ) {
    report = await recordCompliance({ userId: user.id, version });
  }

  const history = await store.listHarnessCompliance(harness.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Active policies, checked against this harness version. Paused and draft policies are not evaluated.
          Violations and gaps lead. A cannot-determine result means the config is silent — you may believe the
          control exists, but it is not written down.
        </p>
        {viewingLatest && <RecheckButton harnessId={id} />}
      </div>

      {policies.length === 0 ? (
        <section className="panel p-8 text-center">
          <p className="text-sm text-muted">Adopt policies before this harness can be checked.</p>
          <Link
            href="/policies"
            className="btn btn-primary mt-3 inline-flex"
          >
            Open My Policies
          </Link>
        </section>
      ) : active.length === 0 ? (
        <section className="panel p-8 text-center">
          <p className="text-sm text-muted">
            Nothing is being checked. Paused and draft policies stay in your pack and are not evaluated.
          </p>
          <Link
            href="/policies"
            className="btn btn-primary mt-3 inline-flex"
          >
            Activate a policy
          </Link>
        </section>
      ) : report ? (
        <ComplianceReportView
          harnessId={id}
          versionNumber={version.versionNumber}
          report={report}
          history={history.map((entry) => ({
            id: entry.report.id,
            versionNumber: entry.versionNumber,
            generatedAt: entry.report.generatedAt.toISOString(),
            overallStatus: entry.report.overallStatus,
            headline: entry.report.delta?.headline ?? null,
          }))}
        />
      ) : (
        <section className="panel p-8 text-center">
          <p className="text-sm text-muted">No compliance report stored for this version.</p>
          {viewingLatest && (
            <div className="mt-3 flex justify-center">
              <RecheckButton harnessId={id} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
