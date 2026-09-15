/**
 * Pass 2 — Missing constraints / unbounded authority.
 * Highest-value pass: capabilities with no governing limit.
 */

import type { Finding, Instruction, ToolGrant } from "@/lib/types";
import { makeFinding } from "@/lib/analysis/findings";
import { asString, asSeverity, parseJsonArrayField } from "@/lib/analysis/model";
import { DESTRUCTIVE_TOOL_NAME_RE } from "@/lib/analysis/structural";
import type { AnalysisPass, PassContext, PassOutput } from "./types";

const LIMIT_RE =
  /\$\s*\d|\d+\s*(?:usd|dollars?)|at most\s+\d|up to\s+\d|no more than|ceiling|cap(?:ped)?|threshold|approval|supervisor|manager sign[- ]?off|human confirmation|must confirm|ask (?:the customer )?for confirmation/i;

const MONEY_ACTION_RE =
  /\b(refunds?|discounts?|credits?|compensation|chargebacks?|payouts?|write[- ]?offs?)\b/i;

const SENSITIVE_DATA_RE =
  /\b(pii|personal (?:data|information)|ssn|social security|health|hipaa|financial (?:data|information)|account details|payment cards?|passwords?|credentials?)\b/i;

const DATA_HANDLING_RE =
  /\b(do not (?:store|retain|share|repeat)|never (?:store|retain|share|disclose)|redact|mask|encrypt|retention|data handling|identity)\b/i;

const MODEL_SYSTEM = `You are auditing an AI agent's system prompt for UNBOUNDED AUTHORITY — capabilities with no governing limit.

Find cases where the agent can take an action but no rule limits it. Specifically:
- Authority to commit, spend, refund, discount, or promise with NO stated ceiling, threshold, or approval gate.
- Ability to take irreversible or destructive actions (delete, close, cancel, export) with NO stated condition or confirmation requirement.
- Handling of sensitive data (PII, financial, health) with NO stated data-handling rule.

For each, emit: "Agent can [X] but no rule limits it."

Do NOT flag actions that already have a numeric cap, named approver, or explicit confirmation requirement.

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"findings":[{"capability":"<the unbounded action>","reason":"<why it is unbounded>","severity":"critical"|"warning","evidence":["<quoted instruction or tool>"]}]}

Severity: critical for money, destructive actions, or sensitive data; warning otherwise.
If none, output {"findings":[]}.`;

function promptHasLimitNear(rawPrompt: string, topic: RegExp): boolean {
  const sentences = rawPrompt.split(/(?<=[.!?\n])/);
  return sentences.some((s) => topic.test(s) && LIMIT_RE.test(s));
}

export function deterministicMissingConstraints(
  instructions: Instruction[],
  tools: ToolGrant[],
  rawPrompt: string
): Finding[] {
  const findings: Finding[] = [];
  const joinedInstructions = instructions.map((i) => i.text).join("\n");

  const refundTools = tools.filter((t) => /refund|discount|credit|payout|charge/i.test(t.name));
  const moneyMentioned = MONEY_ACTION_RE.test(joinedInstructions) || refundTools.length > 0;
  const moneyLimited = promptHasLimitNear(rawPrompt, MONEY_ACTION_RE);

  if (moneyMentioned && !moneyLimited) {
    const evidence = [
      ...instructions.filter((i) => MONEY_ACTION_RE.test(i.text)).map((i) => i.text),
      ...refundTools.map((t) => `${t.name} (${t.permissions.join(", ")})`),
    ].slice(0, 4);
    findings.push(
      makeFinding({
        category: "missing-constraint",
        component: "tools",
        severity: "critical",
        title: "Unbounded refund/spend authority",
        description:
          "Agent can issue refunds, discounts, or similar financial adjustments but no rule limits it — no ceiling, threshold, or approval gate is stated.",
        affectedElement: refundTools[0]?.name ?? "refunds",
        evidence,
        recommendation:
          "Add a hard numeric cap (e.g. refunds up to $50) and require human approval above it. State that the cap overrides any customer request.",
      })
    );
  }

  const destructive = tools.filter(
    (t) =>
      DESTRUCTIVE_TOOL_NAME_RE.test(t.name.replace(/[_-]/g, " ")) ||
      t.permissions.some((p) => ["delete", "export", "admin", "deploy"].includes(p))
  );
  for (const tool of destructive) {
    const nameRe = new RegExp(
      tool.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[_-]/g, "[-_\\s]"),
      "i"
    );
    const governed = instructions.some(
      (i) => nameRe.test(i.text) && (LIMIT_RE.test(i.text) || /\bif\b|\bwhen\b|\bunless\b|\bconfirm/i.test(i.text))
    );
    if (governed) continue;
    findings.push(
      makeFinding({
        category: "missing-constraint",
        component: "tools",
        severity: "critical",
        title: `Agent can ${tool.name} but no rule limits it`,
        description: `The agent holds ${tool.name} (${tool.permissions.join(", ")}) — an irreversible or high-impact capability — with no stated condition, confirmation requirement, or approval gate.`,
        affectedElement: tool.name,
        evidence: [tool.name + ": [" + tool.permissions.join(", ") + "]"],
        recommendation: `Require explicit human confirmation before invoking ${tool.name}, and state the exact conditions under which it may run.`,
      })
    );
  }

  if (SENSITIVE_DATA_RE.test(rawPrompt) && !DATA_HANDLING_RE.test(rawPrompt)) {
    findings.push(
      makeFinding({
        category: "missing-constraint",
        component: "guardrails",
        severity: "critical",
        title: "Agent can handle sensitive data but no rule limits it",
        description:
          "The prompt references personal, financial, or account data but states no data-handling rule — what may be stored, shared, or repeated.",
        affectedElement: "sensitive data handling",
        recommendation:
          "Add an explicit data-handling rule: what fields may be read, what must never be stored or repeated, and a retention limit.",
      })
    );
  }

  return findings;
}

export const findMissingConstraints: AnalysisPass = async (ctx): Promise<PassOutput> => {
  const deterministic = deterministicMissingConstraints(ctx.instructions, ctx.tools, ctx.rawPrompt);

  if (!ctx.modelAvailable) {
    return {
      findings: deterministic,
      incomplete: {
        status: deterministic.length > 0 ? "partial" : "skipped",
        note: "Missing-constraint model call was skipped (ANTHROPIC_API_KEY is not set).",
      },
    };
  }

  try {
    const toolList =
      ctx.tools.length === 0
        ? "(no structured tools extracted)"
        : ctx.tools.map((t) => `${t.name}: [${t.permissions.join(", ")}]`).join("\n");
    const ruleList = ctx.instructions.map((i) => `${i.id}: "${i.text}"`).join("\n");
    const raw = await ctx.callModel(
      "missing-constraints",
      MODEL_SYSTEM,
      `Tools:\n${toolList}\n\nInstructions:\n${ruleList}\n\nFull prompt:\n${ctx.rawPrompt}`
    );
    const list = parseJsonArrayField("missing-constraints", raw, "findings");
    const modeled: Finding[] = [];
    for (const item of list) {
      if (item === null || typeof item !== "object") continue;
      const f = item as Record<string, unknown>;
      const capability = asString(f.capability);
      if (!capability) continue;
      const severity = asSeverity(f.severity, "critical");
      modeled.push(
        makeFinding({
          category: "missing-constraint",
          component: /refund|spend|delete|export|close|data/i.test(capability) ? "tools" : "guardrails",
          severity: severity === "info" ? "warning" : severity,
          title: `Agent can ${capability} but no rule limits it`,
          description: asString(f.reason) || `Agent can ${capability} but no rule limits it.`,
          affectedElement: capability,
          evidence: Array.isArray(f.evidence) ? f.evidence.filter((e): e is string => typeof e === "string") : undefined,
          recommendation: "Add an explicit ceiling, condition, or approval gate that governs this capability.",
        })
      );
    }
    return { findings: [...deterministic, ...modeled] };
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    console.error("[ballast:pass] missing-constraints failed", err);
    return {
      findings: deterministic,
      incomplete: {
        status: deterministic.length > 0 ? "partial" : "error",
        note: `Missing-constraint model pass failed: ${note}`,
      },
    };
  }
};
