import { Header } from "@/components/Header";
import { PoliciesWorkspace } from "@/components/policies/PoliciesWorkspace";
import type { LibraryListItem, PolicyListItem, PolicyOrigin } from "@/components/policies/types";
import { requireUser } from "@/lib/auth/current-user";
import { latestPolicyVerdicts, loadPolicyLibrary } from "@/lib/compliance/policies";
import type { PolicyRecord } from "@/lib/db";

function originFor(policy: PolicyRecord, starters: PolicyRecord[]): PolicyOrigin | null {
  if (!policy.adoptedFromId) return null;
  const starter = starters.find((item) => item.id === policy.adoptedFromId);
  if (!starter) return null;
  return {
    name: starter.name,
    statement: starter.statement,
    checkableIntent: starter.checkableIntent,
    severity: starter.severity,
  };
}

export default async function PoliciesPage() {
  const user = await requireUser("/policies");
  const [{ mine, starter }, verdicts] = await Promise.all([
    loadPolicyLibrary(user.id),
    latestPolicyVerdicts(user.id),
  ]);

  const adoptedByStarter = new Map<string, string>();
  const adoptedByCode = new Map<string, string>();
  for (const policy of mine) {
    if (policy.adoptedFromId) adoptedByStarter.set(policy.adoptedFromId, policy.id);
    adoptedByCode.set(policy.code, policy.id);
  }

  const policies: PolicyListItem[] = mine.map((policy) => {
    const check = verdicts.byPolicyId[policy.id] ?? null;
    return {
    id: policy.id,
    code: policy.code,
    principle: policy.principle,
    name: policy.name,
    statement: policy.statement,
    checkableIntent: policy.checkableIntent,
    components: policy.components,
    frameworks: policy.frameworks,
    severity: policy.severity,
    source: policy.source,
    version: policy.version,
    status: policy.status,
    adoptedFromId: policy.adoptedFromId,
    verdict: check?.verdict ?? null,
    check: check
      ? { reasoning: check.reasoning, evidence: check.evidence, recommendation: check.recommendation }
      : null,
    origin: originFor(policy, starter),
    confidence: policy.confidence,
    generationNote: policy.generationNote,
  };
  });

  const library: LibraryListItem[] = starter.map((policy) => ({
    id: policy.id,
    code: policy.code,
    principle: policy.principle,
    name: policy.name,
    statement: policy.statement,
    checkableIntent: policy.checkableIntent,
    components: policy.components,
    frameworks: policy.frameworks,
    severity: policy.severity,
    adoptedPolicyId: adoptedByStarter.get(policy.id) ?? adoptedByCode.get(policy.code) ?? null,
  }));

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 sm:py-10">
        <PoliciesWorkspace policies={policies} library={library} harnessName={verdicts.harnessName} />
      </div>
    </>
  );
}
