/**
 * Research-grounded starter policy pack.
 * Templates are stored with userId null. A user adopts by copying one into their set.
 * `checker` is the deterministic pre-check id — kept equal to `code` until the user rewrites checkableIntent.
 */

import type { HarnessComponent, Policy, PolicySource, Severity } from "@/lib/types";

export { POLICY_PRINCIPLES } from "./principles";

export type StarterPolicyDef = {
  code: string;
  principle: string;
  name: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
};

export const STARTER_PACK: StarterPolicyDef[] = [
  {
    code: "A1",
    principle: "Tools & Permissions",
    name: "Least privilege",
    statement:
      "Every tool the agent is granted is named in an instruction that says when that tool may be used. A capability that is granted and never mentioned is not governed.",
    checkableIntent:
      "Every granted tool must appear in an instruction that scopes its use. A tool that is granted and never referenced outside the grant list is a violation. If the harness grants no tools, least privilege cannot be determined.",
    components: ["tools", "instructions"],
    frameworks: ["OWASP LLM06", "NIST AI RMF MANAGE 2.3"],
    severity: "warning",
  },
  {
    code: "A2",
    principle: "Tools & Permissions",
    name: "Destructive tools require a gate",
    statement:
      "Delete, close, export, execute, admin, and similar destructive tools may run only after an explicit confirmation, approval, or stated condition.",
    checkableIntent:
      "Any granted tool whose name or permission is destructive (delete, close, export, drop, purge, execute, admin, deploy) must be paired with an instruction that requires confirmation, approval, or a stated condition before that tool is used. A destructive grant with no such gate is a violation. If the harness grants no destructive tool and does not disclaim them, the gate cannot be determined.",
    components: ["tools", "instructions"],
    frameworks: ["OWASP LLM06", "EU AI Act Art. 14"],
    severity: "critical",
  },
  {
    code: "A3",
    principle: "Tools & Permissions",
    name: "No standing admin or export",
    statement:
      "Admin and export permissions are not standing grants. Each one names the workflow that may use it, or the harness states that the agent does not hold them.",
    checkableIntent:
      "A granted admin or export permission must be named in an instruction that states the workflow, approval, or condition for its use. An unnamed standing admin or export grant is a violation. An explicit statement that the agent does not hold export or admin satisfies the control. If the harness never mentions admin or export, the control cannot be determined.",
    components: ["tools"],
    frameworks: ["OWASP LLM06", "NIST AI RMF MANAGE 1.3"],
    severity: "critical",
  },
  {
    code: "B1",
    principle: "Financial Authority",
    name: "Bounded financial commitment authority",
    statement:
      "The agent may commit money — refunds, credits, payments, or billing changes — only inside an explicit numeric limit.",
    checkableIntent:
      "If the harness authorizes refunds, credits, payments, discounts, or other financial commitments, it must state a numeric limit. An authorization to commit money with no numeric bound is a violation. If the harness never authorizes a financial commitment, the control cannot be determined.",
    components: ["tools", "instructions"],
    frameworks: ["OWASP LLM06", "NIST AG-MP.1", "EU AI Act Art. 14"],
    severity: "critical",
  },
  {
    code: "B2",
    principle: "Financial Authority",
    name: "Compensation requires a bound",
    statement:
      "Discounts, credits, and other compensation require an explicit numeric bound. An open offer of compensation is not a control.",
    checkableIntent:
      "If the harness mentions discounts, credits, coupons, or compensation, it must include a numeric limit. Mentioning compensation with no numeric bound is a violation. If compensation is never mentioned, the control cannot be determined.",
    components: ["instructions"],
    frameworks: ["OWASP LLM06"],
    severity: "warning",
  },
  {
    code: "C1",
    principle: "Human Oversight",
    name: "Human escalation path",
    statement:
      "The harness names a human role and at least one concrete condition that sends the task to that person.",
    checkableIntent:
      "The harness must contain an instruction that escalates or hands off to a named human role under a stated condition (when, if, unless, before). Instructions that forbid escalation or set full autonomy as the goal violate the control even if another line mentions escalation. If the harness never discusses escalation or handoff, the control cannot be determined.",
    components: ["delegation"],
    frameworks: ["EU AI Act Art. 14", "NIST AI RMF GOVERN 1.2"],
    severity: "warning",
  },
  {
    code: "C2",
    principle: "Human Oversight",
    name: "Identity before record access",
    statement:
      "The agent verifies identity before it discusses or changes an account, order, patient, or customer record.",
    checkableIntent:
      "If the harness discusses account, order, patient, customer, chart, member, or appointment records, it must require identity verification before that access. Record access with no verification step is a violation. If the harness does not discuss records, the control cannot be determined.",
    components: ["instructions", "guardrails"],
    frameworks: ["NIST AI RMF MEASURE 2.7"],
    severity: "warning",
  },
  {
    code: "C3",
    principle: "Human Oversight",
    name: "Escalation is not forbidden",
    statement:
      "The harness does not tell the agent to avoid humans, refuse handoff, or pursue full autonomy.",
    checkableIntent:
      "Instructions that say never escalate, never transfer to a human, handle everything without a human, or that full autonomy is the goal are a violation. A stated escalation duty with no such ban satisfies the control. If the harness never discusses escalation, the control cannot be determined.",
    components: ["delegation", "instructions"],
    frameworks: ["EU AI Act Art. 14"],
    severity: "critical",
  },
  {
    code: "D1",
    principle: "Data Handling",
    name: "No disclosure of another party's data",
    statement:
      "The agent must not disclose another customer's or patient's data, and must not share passwords, payment cards, or government IDs.",
    checkableIntent:
      "The harness must prohibit disclosing another party's data or sharing passwords, payment cards, or government IDs. An instruction that tells the agent to disclose that data is a violation. If the harness never addresses disclosure, the control cannot be determined.",
    components: ["guardrails"],
    frameworks: ["OWASP LLM02"],
    severity: "critical",
  },
  {
    code: "D2",
    principle: "Data Handling",
    name: "Secrets stay out of output",
    statement:
      "The agent does not print, log, return, or repeat secrets, environment variables, API keys, or credentials.",
    checkableIntent:
      "An instruction to print, log, return, or include secrets, credentials, API keys, or environment values is a violation. An explicit prohibition on logging, storing, sharing, or repeating those values satisfies the control. If the harness never mentions secrets or credentials, the control cannot be determined.",
    components: ["guardrails", "instructions"],
    frameworks: ["OWASP LLM02"],
    severity: "critical",
  },
  {
    code: "D3",
    principle: "Data Handling",
    name: "Memory excludes sensitive data",
    statement:
      "If the agent remembers anything across sessions, sensitive categories are excluded and retention is stated.",
    checkableIntent:
      "If the harness tells the agent to remember, persist, or store details across sessions, it must exclude sensitive data (passwords, payment data, government IDs, or an explicit sensitive-data exclusion). Memory with no exclusion is a violation. If the harness never mentions memory, the control cannot be determined.",
    components: ["memory"],
    frameworks: ["OWASP LLM02", "NIST AI RMF MAP 4.2"],
    severity: "warning",
  },
  {
    code: "E1",
    principle: "Injection",
    name: "Untrusted content is data",
    statement:
      "Customer messages, uploaded documents, and retrieved notes are data. The agent does not follow instructions found inside them.",
    checkableIntent:
      "An instruction to act on, follow, or obey instructions contained in user, customer, patient, or uploaded content is a violation. An instruction that those materials are untrusted data and must not be followed satisfies the control. If the harness never addresses untrusted content, the control cannot be determined.",
    components: ["guardrails", "instructions"],
    frameworks: ["OWASP LLM01"],
    severity: "critical",
  },
  {
    code: "E2",
    principle: "Injection",
    name: "System instructions outrank the user",
    statement:
      "The agent is not told to always follow the user's instructions. Tool use follows the system prompt.",
    checkableIntent:
      "An instruction to always follow the customer, patient, or user's instructions is a violation. An instruction that directions inside user content are not followed, or that tool calls follow only the system prompt, satisfies the control. If the harness never says which instructions win, the control cannot be determined.",
    components: ["instructions", "guardrails"],
    frameworks: ["OWASP LLM01"],
    severity: "critical",
  },
  {
    code: "F1",
    principle: "Delegation",
    name: "No autonomous consequential action",
    statement:
      "The agent does not take consequential actions — deploy, execute, delete, refund, close, export — on its own, immediately, or under a goal of full autonomy.",
    checkableIntent:
      "If the harness instructs the agent to deploy immediately, act with full autonomy, resolve consequential actions itself, or never escalate, and the agent can deploy, execute, delete, export, refund, or administer, that is a violation. A human gate on those actions with no autonomy language satisfies the control. If the harness has no consequential capability and does not discuss autonomy, the control cannot be determined.",
    components: ["delegation", "tools"],
    frameworks: ["OWASP LLM06", "EU AI Act Art. 14"],
    severity: "critical",
  },
  {
    code: "F2",
    principle: "Delegation",
    name: "Sub-agent delegation is scoped",
    statement:
      "If the agent can hand work to another agent, the handoff names a scope and a human stop. Silence is not the same as a prohibition.",
    checkableIntent:
      "If the harness mentions another agent, a sub-agent, or delegating to an agent, the handoff must name a scope or a human stop. An unscoped agent-to-agent handoff is a violation. If the harness never mentions delegation to another agent, the control cannot be determined.",
    components: ["delegation"],
    frameworks: ["OWASP LLM06", "NIST AI RMF MANAGE 2.2"],
    severity: "warning",
  },
  {
    code: "G1",
    principle: "Instruction Integrity",
    name: "Tool use has a concrete bound",
    statement:
      "What the agent may do with its tools is written as a concrete limit, not left to good judgment, company policy, or using tools as needed.",
    checkableIntent:
      "If the harness grants tools, at least one instruction must bound an action with a concrete limiter (only, never, must, approval, before, unless) that is not solely 'good judgment', 'company policy', or 'as needed'. Tools whose only bound is that vague language are a violation. If the harness grants no tools, the control cannot be determined. If tools exist and no bound is stated either way, the control cannot be determined.",
    components: ["instructions", "tools"],
    frameworks: ["OWASP LLM06"],
    severity: "warning",
  },
  {
    code: "G2",
    principle: "Instruction Integrity",
    name: "No opposing absolute rules",
    statement:
      "The harness does not contain two absolute rules that require opposite actions, such as never escalate and always escalate, or always deploy and never deploy.",
    checkableIntent:
      "Two instructions that require opposite actions on the same decision — escalate versus never escalate, always deploy versus never deploy, or always be concise versus always be thorough — are a violation. If instructions exist and no opposing pair is present, the control is satisfied. If there are no instructions, the control cannot be determined.",
    components: ["instructions"],
    frameworks: ["NIST AI RMF MEASURE 2.6"],
    severity: "warning",
  },
  {
    code: "G3",
    principle: "Instruction Integrity",
    name: "Hard limits are concrete",
    statement:
      "Hard limits are written as concrete prohibitions. 'Follow company policy' and 'use good judgment' do not count as a limit.",
    checkableIntent:
      "A concrete prohibition (never, do not, must not) aimed at a specific object satisfies the control. If the only limit language is company policy, good judgment, or as needed, that is a violation. If the harness states no limit either way, the control cannot be determined.",
    components: ["guardrails", "instructions"],
    frameworks: ["EU AI Act Art. 14"],
    severity: "warning",
  },
];

export function policyFromDef(
  def: StarterPolicyDef,
  fields: {
    id: string;
    userId: string | null;
    source?: PolicySource;
    createdBy?: string | null;
    createdAt?: string;
    version?: number;
    checker?: string | null;
    adoptedFromId?: string | null;
    status?: Policy["status"];
  }
): Policy {
  return {
    id: fields.id,
    userId: fields.userId,
    name: def.name,
    statement: def.statement,
    checkableIntent: def.checkableIntent,
    components: def.components,
    frameworks: def.frameworks,
    severity: def.severity,
    source: fields.source ?? "starter",
    createdBy: fields.createdBy ?? null,
    createdAt: fields.createdAt ?? new Date(0).toISOString(),
    version: fields.version ?? 1,
    code: def.code,
    principle: def.principle,
    checker: fields.checker === undefined ? def.code : fields.checker,
    adoptedFromId: fields.adoptedFromId ?? null,
    status: fields.status ?? "active",
    confidence: null,
    generationNote: "",
  };
}
