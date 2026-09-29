/**
 * Policy lifecycle. Only "active" policies are evaluated against a harness.
 * Paused and draft policies stay visible and editable, and are excluded
 * before any compliance check runs.
 */
export const POLICY_LIFECYCLES = ["active", "paused", "draft"] as const;

export type PolicyLifecycle = (typeof POLICY_LIFECYCLES)[number];

export function asLifecycle(value: unknown): PolicyLifecycle | null {
  return typeof value === "string" && (POLICY_LIFECYCLES as readonly string[]).includes(value)
    ? (value as PolicyLifecycle)
    : null;
}

export function isActivePolicy(policy: { status: string }): boolean {
  return policy.status === "active";
}

/** The analysis set. Call this before checkPolicy — never evaluate the full pack. */
export function selectPoliciesForAnalysis<T extends { status: string }>(policies: T[]): T[] {
  return policies.filter(isActivePolicy);
}

/**
 * A stored report is current only when it checked exactly the active policies
 * at their current versions. Anything else is a previous pack, not this one.
 */
export function complianceReportCoversActive(
  results: { policyId: string; policyVersion: number }[],
  active: { id: string; version: number }[]
): boolean {
  if (results.length !== active.length) return false;
  const byId = new Map(results.map((result) => [result.policyId, result.policyVersion]));
  return active.every((policy) => byId.get(policy.id) === policy.version);
}
