import { POLICY_PRINCIPLES } from "@/lib/compliance/principles";
import type { HarnessComponent, PolicyLifecycle, PolicySource, PolicyVerdict, Severity } from "@/lib/types";

export type PolicyOrigin = {
  name: string;
  statement: string;
  checkableIntent: string;
  severity: Severity;
};

export type PolicyListItem = {
  id: string;
  code: string;
  principle: string;
  name: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
  source: PolicySource;
  version: number;
  status: PolicyLifecycle;
  adoptedFromId: string | null;
  verdict: PolicyVerdict | null;
  /** Why the last check landed where it did. Null when this policy was not in that check. */
  check: {
    reasoning: string;
    evidence: string[];
    recommendation: string;
  } | null;
  origin: PolicyOrigin | null;
  confidence: "high" | "low" | null;
  generationNote: string;
};

export type GeneratedDraft = {
  name: string;
  statement: string;
  summary: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
  principle: (typeof POLICY_PRINCIPLES)[number];
  confidence: "high" | "low";
  generationNote: string;
  checks: string[];
  doesNotCheck: string[];
  verdictLogic: { compliant: string; violated: string; cannotDetermine: string };
  persisted: false;
};

export type LibraryListItem = {
  id: string;
  code: string;
  principle: string;
  name: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
  adoptedPolicyId: string | null;
};

export const fieldClass =
  "mt-1 w-full rounded-[2px] border border-edge bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground";
