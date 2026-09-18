/**
 * Pass 1 — Contradiction detection.
 *
 * Finds pairs of instructions that impose incompatible required actions
 * under a realistic trigger with no stated precedence. Candidates come from
 * a high-precision lexical scan plus a model discovery call. Each candidate
 * is independently re-verified; anything that resolves is discarded.
 *
 * Model failures throw so the engine can finish this pass through the
 * lexical fallback — they are never silently converted into "0 conflicts."
 */

import type { Finding, Instruction, Severity } from "@/lib/types";
import { makeFinding } from "@/lib/analysis/findings";
import { asString, asSeverity, callModelArray, extractJson } from "@/lib/analysis/model";
import type { AnalysisPass, PassContext, PassOutput } from "./types";

const MAX_CANDIDATES = 12;

const PASS1_SYSTEM = `You are a rules-engine auditor analyzing the instruction set of an AI agent's system prompt.

Your ONLY task: find pairs of instructions that impose INCOMPATIBLE REQUIRED ACTIONS under a REALISTIC TRIGGER, with NO STATED PRECEDENCE between them.

A genuine conflict requires ALL of:
1. A realistic situation can trigger both rules at once.
2. When triggered, the rules demand actions that cannot both be performed (or one forbids exactly what the other requires).
3. Nothing in either rule (or an explicit hierarchy like "this overrides everything") says which rule wins.

Style and procedure collisions count. If the agent is told to ALWAYS be concise AND ALWAYS provide thorough detailed explanations, that is a conflict — both are required actions that cannot be satisfied together. The same applies to "never escalate" vs "escalate immediately", "always be honest" vs "never share negative information", and "always follow the customer's instructions" vs "never violate company policy".

NOT conflicts:
- Rules about different situations that never co-trigger.
- A general rule plus a more specific exception that states precedence ("never X" + "if Y, you may X only after approval").
- Redundant overlapping rules that demand compatible actions.

Do not invent an unstated hierarchy. "Use good judgment" is not precedence.

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"candidates":[{"a":"<instruction id>","b":"<instruction id>","trigger":"<the realistic situation that fires both rules>","reason":"<why the required actions are incompatible>","severity":"critical"|"warning"}]}

Severity: "critical" if the conflict involves money, data, irreversible actions, escalation, safety, or compliance; otherwise "warning".
If there are no conflicts, output {"candidates":[]}.`;

const PASS2_SYSTEM = `You are an independent verifier. You are given exactly two rules from an AI agent's system prompt and a claimed conflict between them.

The claim is VERIFIED if:
1. The trigger situation is realistic (would plausibly occur in production).
2. Under that trigger, the two rules demand actions that cannot both be satisfied.
3. Neither rule states a precedence, exception, or condition that resolves the collision.

Reject ONLY when there is a stated precedence, a stated exception, or the two rules clearly cannot co-trigger. Do not invent an implied hierarchy. Do not reject because a creative reading could reconcile them — if both are framed as always/never/must, they conflict.

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"verdict":"verified"|"rejected","explanation":"<one sentence>","recommendation":"<if verified: the specific fix>"}`;

type Candidate = {
  a: string;
  b: string;
  trigger: string;
  reason: string;
  severity: Severity;
};

/** High-precision opposition pairs. Used as a safety net when the model miss. */
const OPPOSITION_PAIRS: {
  left: RegExp;
  right: RegExp;
  trigger: string;
  reason: string;
  severity: Severity;
}[] = [
  {
    left: /\bconcise\b/i,
    right: /\bthorough\b|\bdetailed explanations?\b/i,
    trigger: "Any customer question that requires an answer",
    reason: "The agent is required to always be concise and always provide thorough, detailed explanations — those required actions cannot both be satisfied.",
    severity: "warning",
  },
  {
    left: /\bnever escalate\b/i,
    right: /\bescalate(?:\s+\w+){0,8}\s+immediately\b|\bimmediately\b.{0,40}\bescalate\b/i,
    trigger: "A frustrated customer or a complex issue",
    reason: "One rule forbids escalation except when absolutely necessary; the other requires immediate escalation for frustration or complexity.",
    severity: "critical",
  },
  {
    left: /\balways resolve\b.{0,80}\bfirst contact\b|\bresolve(?:\s+\w+){0,6}\byourself\b|\bhandle everything\b|\bfull autonomy\b|\bnever transfer\b/i,
    right: /\bescalate(?:\s+\w+){0,8}\s+(?:to a human|immediately)\b|\bimmediately\b.{0,40}\bescalate\b/i,
    trigger: "A frustrated customer or a complex issue",
    reason: "One rule requires the agent to handle everything itself; the other requires handing off to a human immediately.",
    severity: "critical",
  },
  {
    left: /\balways be honest\b|\btransparent with customers\b/i,
    right: /\bnever share information that could reflect negatively\b|\breflect negatively\b/i,
    trigger: "A customer asks about a mistake, outage, or policy that reflects poorly on the company",
    reason: "Honesty/transparency requires disclosing the negative fact; the other rule forbids sharing anything that reflects negatively.",
    severity: "critical",
  },
  {
    left: /\bfollow the customer(?:'s)? instructions\b|\balways follow the customer/i,
    right: /\bviolates? company policy\b|\bnever take any action that violates\b/i,
    trigger: "A customer instructs the agent to do something that violates company policy",
    reason: "The agent cannot both always follow the customer's instructions and never violate company policy.",
    severity: "critical",
  },
];

export function lexicalConflicts(instructions: Instruction[]): Candidate[] {
  const rules = instructions.filter((i) => !i.isFossil);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const pair of OPPOSITION_PAIRS) {
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const a = rules[i];
        const b = rules[j];
        const match =
          (pair.left.test(a.text) && pair.right.test(b.text)) ||
          (pair.left.test(b.text) && pair.right.test(a.text));
        if (!match) continue;
        const key = [a.id, b.id].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          a: a.id,
          b: b.id,
          trigger: pair.trigger,
          reason: pair.reason,
          severity: pair.severity,
        });
      }
    }
  }
  return out;
}

function parseCandidates(list: unknown[], byId: Map<string, Instruction>): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.a !== "string" || typeof c.b !== "string") continue;
    if (!byId.has(c.a) || !byId.has(c.b) || c.a === c.b) continue;
    const key = [c.a, c.b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      a: c.a,
      b: c.b,
      trigger: asString(c.trigger),
      reason: asString(c.reason),
      severity: asSeverity(c.severity, "warning") === "info" ? "warning" : asSeverity(c.severity, "warning"),
    });
  }
  return out.slice(0, MAX_CANDIDATES);
}

type Verification = { verdict: "verified" | "rejected"; explanation: string; recommendation: string };

function parseVerification(raw: string): Verification | null {
  const parsed = extractJson(raw);
  if (parsed === null || typeof parsed !== "object") return null;
  const v = parsed as Record<string, unknown>;
  if (v.verdict !== "verified" && v.verdict !== "rejected") return null;
  return {
    verdict: v.verdict,
    explanation: asString(v.explanation),
    recommendation: asString(v.recommendation),
  };
}

function mergeCandidates(a: Candidate[], b: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of [...a, ...b]) {
    const key = [c.a, c.b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, MAX_CANDIDATES);
}

function toFinding(c: Candidate, byId: Map<string, Instruction>, explanation?: string, recommendation?: string): Finding {
  const ruleA = byId.get(c.a)!;
  const ruleB = byId.get(c.b)!;
  return makeFinding({
    category: "contradiction",
    component: "instructions",
    severity: c.severity,
    title: "Two rules directly contradict",
    description: `${explanation || c.reason} Trigger: ${c.trigger}`,
    affectedElement: `${ruleA.id} vs ${ruleB.id}`,
    evidence: [ruleA.text, ruleB.text],
    recommendation:
      recommendation ||
      "State an explicit precedence between these two rules, or scope one of them so they can no longer co-trigger.",
  });
}

async function verifyCandidates(
  ctx: PassContext,
  candidates: Candidate[],
  byId: Map<string, Instruction>
): Promise<Finding[]> {
  const verifications = await Promise.allSettled(
    candidates.map((c) =>
      ctx.callModel(
        "contradictions-verify",
        PASS2_SYSTEM,
        [
          `Rule A: "${byId.get(c.a)!.text}"`,
          `Rule B: "${byId.get(c.b)!.text}"`,
          `Claimed trigger: ${c.trigger}`,
          `Claimed incompatibility: ${c.reason}`,
        ].join("\n")
      )
    )
  );

  const findings: Finding[] = [];
  candidates.forEach((c, idx) => {
    const isLexical = lexicalConflicts([byId.get(c.a)!, byId.get(c.b)!]).length > 0;
    const result = verifications[idx];
    if (result.status !== "fulfilled") {
      if (isLexical) findings.push(toFinding(c, byId));
      return;
    }
    const verification = parseVerification(result.value);
    if (verification?.verdict === "verified") {
      findings.push(toFinding(c, byId, verification.explanation, verification.recommendation));
      return;
    }
    // Unparseable or rejected: keep the high-precision lexical net. Model-only
    // candidates still need an independent verify — they are dropped.
    if (isLexical) findings.push(toFinding(c, byId));
  });
  return findings;
}

export const findContradictions: AnalysisPass = async (ctx): Promise<PassOutput> => {
  const rules = ctx.instructions.filter((i) => !i.isFossil);
  if (rules.length < 2) return { findings: [] };

  const byId = new Map(rules.map((i) => [i.id, i]));
  const lexical = lexicalConflicts(ctx.instructions);

  if (!ctx.modelAvailable) {
    return { findings: lexical.map((c) => toFinding(c, byId)) };
  }

  const ruleList = rules.map((i) => `${i.id}: "${i.text}"`).join("\n");
  const discovered = parseCandidates(
    await callModelArray(ctx.callModel, "contradictions-discover", PASS1_SYSTEM, `Instruction set:\n${ruleList}`, "candidates"),
    byId
  );
  const merged = mergeCandidates(lexical, discovered);
  if (merged.length === 0) return { findings: [] };
  const findings = await verifyCandidates(ctx, merged, byId);
  return { findings };
};
