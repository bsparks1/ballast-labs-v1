/**
 * Central data model for Ballast.
 * Everything in the app — analysis engine, API routes, UI — reads from these types.
 */

export type Severity = "critical" | "warning" | "info";

export type HarnessComponent =
  | "instructions"
  | "tools"
  | "knowledge"
  | "memory"
  | "guardrails"
  | "delegation";

export type Finding = {
  id: string;
  component: HarnessComponent; // which of the six it belongs to
  severity: Severity;
  category: FindingCategory; // which analysis pass produced it (used for dedupe)
  title: string; // short, e.g. "Two rules directly contradict"
  description: string; // plain-language explanation
  affectedElement: string; // the exact rule text / permission / setting
  evidence?: string[]; // e.g. the two conflicting rule texts, quoted
  recommendation: string; // the specific fix
};

/** The analysis pass that produced a finding. */
export type FindingCategory =
  | "structural"
  | "contradiction"
  | "missing-constraint"
  | "injection"
  | "tool-mismatch"
  | "ambiguity";

/** Identity of each analysis pass in the panel. */
export type PassId =
  | "structural"
  | "contradictions"
  | "missing-constraints"
  | "injection-surface"
  | "tool-mismatch"
  | "ambiguity";

/**
 * Per-pass execution status. A pass that errored or was skipped is NOT the
 * same as a pass that ran and found nothing — the report records it and the
 * UI must show "analysis incomplete" rather than silently scoring as clean.
 */
export type PassStatus = {
  pass: PassId;
  label: string;
  status: "ok" | "partial" | "error" | "skipped";
  findingCount: number;
  /** Human-readable reason when status is not "ok". */
  note?: string;
};

export type Instruction = {
  id: string;
  text: string;
  type: "absolute" | "conditional" | "vague"; // absolute = always/never/must/only
  isFossil: boolean; // dead scaffolding like "think step by step"
};

export type ToolGrant = {
  name: string;
  permissions: string[]; // e.g. ["read","write","delete"]
  exercised: boolean | "unknown";
};

export type ComponentStatus = "scored" | "not_applicable";

export type ComponentReport = {
  component: HarnessComponent;
  /** "not_applicable" = the prompt does not exercise this component; excluded from overall. */
  status: ComponentStatus;
  healthScore: number; // 0-100; ignored for overall when status is not_applicable
  findings: Finding[];
  // component-specific parsed contents:
  instructions?: Instruction[];
  tools?: ToolGrant[];
  rawSummary?: string; // short human summary of what was found
};

export type HarnessReport = {
  overallHealthScore: number; // 0-100, derived from component scores + severities
  components: ComponentReport[];
  /** Execution status of every analysis pass. Any non-"ok" entry means the
   *  analysis is incomplete and the report must say so. */
  passes: PassStatus[];
  meta: {
    instructionCount: number;
    absoluteRuleCount: number;
    fossilCount: number;
    verifiedConflictCount: number;
    criticalFindingCount: number;
    createdAt: string;
    /** Present when this report was assembled from repo ingestion. */
    ingestion?: import("./ingest/types").IngestionMeta;
  };
};

export const HARNESS_COMPONENTS: HarnessComponent[] = [
  "instructions",
  "tools",
  "knowledge",
  "memory",
  "guardrails",
  "delegation",
];

export const COMPONENT_LABELS: Record<HarnessComponent, string> = {
  instructions: "Instructions",
  tools: "Tools & Permissions",
  knowledge: "Knowledge",
  memory: "Memory",
  guardrails: "Guardrails",
  delegation: "Delegation",
};

export const COMPONENT_DESCRIPTIONS: Record<HarnessComponent, string> = {
  instructions: "The rules and directives the agent is told to follow",
  tools: "What the agent is permitted to do and touch",
  knowledge: "Reference material and context the agent is given",
  memory: "What the agent retains across sessions",
  guardrails: "Hard limits, refusals, and safety constraints",
  delegation: "When and how the agent hands off to humans or other agents",
};

export type PolicyVerdict = "compliant" | "violated" | "cannot_determine";

export type PolicySource = "starter" | "generated" | "custom";

/** Only active policies are evaluated. Paused and draft are never checked. */
export type PolicyLifecycle = "active" | "paused" | "draft";

/**
 * A checkable rule. `statement` is for people; `checkableIntent` is the precise
 * condition the engine verifies. `checker` selects a deterministic pre-check
 * for starter policies; it is cleared when a user rewrites the intent.
 */
export type Policy = {
  id: string;
  userId: string | null;
  name: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
  source: PolicySource;
  createdBy: string | null;
  createdAt: string;
  version: number;
  /** Stable starter id, e.g. "A1". Custom policies still carry a code for display. */
  code: string;
  /** UI grouping, e.g. "Financial Authority". */
  principle: string;
  /** Deterministic checker id. Null means the verdict is model-graded only. */
  checker: string | null;
  adoptedFromId: string | null;
  /** Load-bearing. The engine evaluates this policy only when status is active. */
  status: PolicyLifecycle;
  /** Set when a guided draft was saved. Null on starter, custom, and adopted policies. */
  confidence: "high" | "low" | null;
  /** Coaching or uncertainty note from the generator. Empty when nothing was flagged. */
  generationNote: string;
};

export type PolicyCheckResult = {
  policyId: string;
  harnessVersionId: string;
  verdict: PolicyVerdict;
  confidence: "high" | "low";
  evidence: string[];
  reasoning: string;
  recommendation: string;
  affectedComponent: HarnessComponent | null;
  checkedAt: string;
  /** Copied onto the result so a stored report stays readable after renames. */
  policyName: string;
  policyCode: string;
  policyVersion: number;
  severity: Severity;
  principle: string;
};

export type ComplianceSummary = {
  compliant: number;
  violated: number;
  cannotDetermine: number;
};

export type ComplianceDelta = {
  previousGeneratedAt: string | null;
  resolvedViolations: { policyId: string; name: string }[];
  newViolations: { policyId: string; name: string }[];
  newGaps: { policyId: string; name: string }[];
  resolvedGaps: { policyId: string; name: string }[];
  headline: string;
  notes: string[];
};

export type ComplianceReport = {
  harnessVersionId: string;
  policyPackVersion: string;
  results: PolicyCheckResult[];
  summary: ComplianceSummary;
  overallStatus: "compliant" | "violations_present" | "gaps_present";
  generatedAt: string;
  delta: ComplianceDelta | null;
};

/** Which analysis pass produced a finding — shown as the audit label. */
export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  structural: "Structural audit",
  contradiction: "Contradiction detection",
  "missing-constraint": "Missing constraints",
  injection: "Prompt-injection surface",
  "tool-mismatch": "Instruction–tool mismatch",
  ambiguity: "Ambiguity / unenforceability",
};
