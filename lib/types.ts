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
  title: string; // short, e.g. "Two rules directly contradict"
  description: string; // plain-language explanation
  affectedElement: string; // the exact rule text / permission / setting
  evidence?: string[]; // e.g. the two conflicting rule texts, quoted
  recommendation: string; // the specific fix
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

export type ComponentReport = {
  component: HarnessComponent;
  healthScore: number; // 0-100
  findings: Finding[];
  // component-specific parsed contents:
  instructions?: Instruction[];
  tools?: ToolGrant[];
  rawSummary?: string; // short human summary of what was found
};

export type HarnessReport = {
  overallHealthScore: number; // 0-100, derived from component scores + severities
  components: ComponentReport[];
  meta: {
    instructionCount: number;
    absoluteRuleCount: number;
    fossilCount: number;
    verifiedConflictCount: number;
    createdAt: string;
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
