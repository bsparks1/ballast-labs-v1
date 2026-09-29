import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { PolicyEditor } from "@/components/policies/PolicyEditor";
import { PolicyStatusControl } from "@/components/policies/PolicyStatusControl";
import { StatusDot } from "@/components/policies/StatusDot";
import { SeverityBadge } from "@/components/SeverityBadge";
import { requireUser } from "@/lib/auth/current-user";
import { store } from "@/lib/db";

export default async function PolicyDetailPage({ params }: PageProps<"/policies/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/policies/${id}`);
  const policy = await store.getUserPolicy(user.id, id);
  if (!policy) notFound();
  const versions = await store.getPolicyVersionHistory(user.id, id);
  const authors = new Map<string, string>();
  for (const version of versions) {
    if (!version.createdBy || authors.has(version.createdBy)) continue;
    const author = await store.getUserById(version.createdBy);
    if (author) authors.set(version.createdBy, author.email);
  }

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <Link href="/policies" className="eyebrow hover:text-muted">
          My Policies
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-faint">{policy.code}</span>
          <h1 className="display-md">{policy.name}</h1>
          <SeverityBadge severity={policy.severity} />
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-faint">
          {policy.principle} · version {policy.version} · {policy.frameworks.join(" · ")}
        </p>
        <div className="mt-3">
          <StatusDot status={policy.status} size="md" />
        </div>
        <div className="mt-4">
          <PolicyStatusControl policyId={policy.id} policyName={policy.name} status={policy.status} />
        </div>
        {policy.confidence === "low" && policy.generationNote ? (
          <p role="status" className="mt-4 rounded-sm border border-warning/40 bg-warning-dim px-3 py-2 text-sm">
            {policy.generationNote}
          </p>
        ) : null}
        <div className="mt-3">
          <Link href={`/api/policies/${policy.id}/export`} className="text-xs text-muted hover:text-foreground">
            Export version history
          </Link>
        </div>

        <div className="mt-6">
          <PolicyEditor
            policyId={policy.id}
            initialStatement={policy.statement}
            initialIntent={policy.checkableIntent}
            initialSeverity={policy.severity}
          />
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-medium">Version history</h2>
          <ol className="mt-3 space-y-3">
            {[...versions].reverse().map((version) => (
              <li key={version.id} className="panel px-4 py-3">
                <p suppressHydrationWarning className="eyebrow">
                  v{version.versionNumber} · {version.createdAt.toLocaleString()} ·{" "}
                  {version.createdBy ? authors.get(version.createdBy) ?? "unknown" : "starter pack"} · {version.severity}
                </p>
                {version.note ? <p className="mt-1 text-xs text-muted">{version.note}</p> : null}
                {version.generationNote ? <p className="mt-1 text-xs text-warning">{version.generationNote}</p> : null}
                <p className="mt-2 text-sm">{version.statement}</p>
                <p className="mt-2 text-xs text-faint">{version.checkableIntent}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
