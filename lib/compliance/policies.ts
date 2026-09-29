import "server-only";
import { store } from "@/lib/db";
import type { PolicyRecord } from "@/lib/db";
import type { HarnessComponent, PolicyVerdict, Severity } from "@/lib/types";
import { HARNESS_COMPONENTS } from "@/lib/types";
import { buildConfirmedPolicyInput, type ConfirmGeneratedInput } from "./confirm";
import type { PolicyLifecycle } from "./lifecycle";
import { recheckUserHarnesses } from "./run";
import { ensureStarterPolicies } from "./seed";

export class PolicyNotFoundError extends Error {
  constructor() {
    super("Policy not found");
    this.name = "PolicyNotFoundError";
  }
}

export class PolicyActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyActionError";
  }
}

async function recheckIfActive(status: PolicyLifecycle, userId: string): Promise<void> {
  if (status === "active") await recheckUserHarnesses(userId);
}

const SEVERITIES = new Set<Severity>(["critical", "warning", "info"]);

export function asSeverity(value: unknown): Severity | null {
  return typeof value === "string" && SEVERITIES.has(value as Severity) ? (value as Severity) : null;
}

export function asComponents(value: unknown): HarnessComponent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is HarnessComponent =>
    typeof item === "string" && HARNESS_COMPONENTS.includes(item as HarnessComponent)
  );
}

export async function loadPolicyLibrary(userId: string): Promise<{
  mine: PolicyRecord[];
  starter: PolicyRecord[];
}> {
  await ensureStarterPolicies();
  const [mine, starter] = await Promise.all([
    store.listUserPolicies(userId),
    store.listStarterPolicies(),
  ]);
  return { mine, starter };
}

export async function adoptStarterPolicy(userId: string, starterId: string): Promise<PolicyRecord> {
  await ensureStarterPolicies();
  const starters = await store.listStarterPolicies();
  const starter = starters.find((p) => p.id === starterId);
  if (!starter) throw new PolicyNotFoundError();
  const mine = await store.listUserPolicies(userId);
  const existing = mine.find((p) => p.adoptedFromId === starter.id || p.code === starter.code);
  if (existing) return existing;
  const created = await store.createPolicy({
    userId,
    code: starter.code,
    principle: starter.principle,
    name: starter.name,
    statement: starter.statement,
    checkableIntent: starter.checkableIntent,
    components: starter.components,
    frameworks: starter.frameworks,
    severity: starter.severity,
    source: "starter",
    checker: starter.checker,
    createdBy: userId,
    adoptedFromId: starter.id,
    status: "draft",
    note: "Adopted from starter pack",
  });
  return created;
}

export async function confirmGeneratedPolicy(input: ConfirmGeneratedInput): Promise<PolicyRecord> {
  const fields = buildConfirmedPolicyInput(input);
  // Drafts are not evaluated. Activation is a later status change.
  return store.createPolicy(fields);
}

export async function createCustomPolicy(input: {
  userId: string;
  name: string;
  statement: string;
  checkableIntent: string;
  severity: Severity;
  principle: string;
  components: HarnessComponent[];
  frameworks: string[];
}): Promise<PolicyRecord> {
  const created = await store.createPolicy({
    userId: input.userId,
    code: `C-${Date.now().toString(36)}`,
    principle: input.principle,
    name: input.name,
    statement: input.statement,
    checkableIntent: input.checkableIntent,
    components: input.components.length > 0 ? input.components : ["instructions"],
    frameworks: input.frameworks,
    severity: input.severity,
    source: "custom",
    checker: null,
    createdBy: input.userId,
    status: "draft",
    note: "Custom policy",
  });
  return created;
}

export async function editPolicy(input: {
  userId: string;
  policyId: string;
  statement: string;
  checkableIntent: string;
  severity: Severity;
  note?: string;
}): Promise<PolicyRecord> {
  const current = await store.getUserPolicy(input.userId, input.policyId);
  if (!current) throw new PolicyNotFoundError();
  const intentChanged = input.checkableIntent.trim() !== current.checkableIntent.trim();
  const updated = await store.addPolicyVersion(input.userId, input.policyId, {
    statement: input.statement,
    checkableIntent: input.checkableIntent,
    severity: input.severity,
    source: current.source === "generated" && !intentChanged ? "generated" : "custom",
    checker: intentChanged ? null : current.checker,
    createdBy: input.userId,
    note: input.note,
    confidence: intentChanged ? null : current.confidence,
    generationNote: intentChanged ? "" : current.generationNote,
  });
  if (!updated) throw new PolicyNotFoundError();
  await recheckIfActive(updated.status, input.userId);
  return updated;
}

export async function setPolicyLifecycle(
  userId: string,
  policyId: string,
  status: PolicyLifecycle
): Promise<PolicyRecord> {
  const current = await store.getUserPolicy(userId, policyId);
  if (!current) throw new PolicyNotFoundError();
  if (current.status === status) return current;
  const updated = await store.setPolicyStatus(userId, policyId, status);
  if (!updated) throw new PolicyNotFoundError();
  if (current.status === "active" || status === "active") {
    await recheckUserHarnesses(userId);
  }
  return updated;
}

export async function revertPolicyToLibrary(userId: string, policyId: string): Promise<PolicyRecord> {
  const current = await store.getUserPolicy(userId, policyId);
  if (!current) throw new PolicyNotFoundError();
  if (!current.adoptedFromId) {
    throw new PolicyActionError("Only policies adopted from the library can be reverted.");
  }
  const starters = await store.listStarterPolicies();
  const starter = starters.find((policy) => policy.id === current.adoptedFromId);
  if (!starter) throw new PolicyNotFoundError();
  const updated = await store.addPolicyVersion(userId, policyId, {
    statement: starter.statement,
    checkableIntent: starter.checkableIntent,
    severity: starter.severity,
    source: "starter",
    checker: starter.checker,
    createdBy: userId,
    note: "Reverted to library original",
    confidence: null,
    generationNote: "",
    components: starter.components,
    frameworks: starter.frameworks,
    name: starter.name,
  });
  if (!updated) throw new PolicyNotFoundError();
  await recheckIfActive(updated.status, userId);
  return updated;
}

export async function removePolicy(userId: string, policyId: string): Promise<void> {
  const current = await store.getUserPolicy(userId, policyId);
  if (!current) throw new PolicyNotFoundError();
  const removed = await store.softDeletePolicy(userId, policyId);
  if (!removed) throw new PolicyNotFoundError();
  await recheckIfActive(current.status, userId);
}

export type PolicyCheckSnapshot = {
  verdict: PolicyVerdict;
  reasoning: string;
  evidence: string[];
  recommendation: string;
};

/** Verdicts from the harness the user looked at most recently, including why. */
export async function latestPolicyVerdicts(userId: string): Promise<{
  harnessName: string | null;
  byPolicyId: Record<string, PolicyCheckSnapshot>;
}> {
  const harnesses = await store.listHarnesses(userId);
  if (harnesses.length === 0) return { harnessName: null, byPolicyId: {} };
  const current = [...harnesses].sort((a, b) => {
    const viewed = (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0);
    if (viewed !== 0) return viewed;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];
  const version = await store.getLatestVersion(current.id);
  if (!version) return { harnessName: current.name, byPolicyId: {} };
  const report = await store.getLatestComplianceReport(version.id);
  const byPolicyId: Record<string, PolicyCheckSnapshot> = {};
  for (const result of report?.results ?? []) {
    byPolicyId[result.policyId] = {
      verdict: result.verdict,
      reasoning: result.reasoning,
      evidence: result.evidence,
      recommendation: result.recommendation,
    };
  }
  return { harnessName: current.name, byPolicyId };
}
