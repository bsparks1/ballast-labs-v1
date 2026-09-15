/**
 * Layer B — Model-graded conflict analysis. Server-side only.
 *
 * Two-pass design:
 *   Pass 1 scans the full instruction set for candidate conflict pairs.
 *   Pass 2 independently re-verifies each candidate in isolation; anything
 *   that resolves under scrutiny is discarded. Only verified conflicts
 *   survive and become findings.
 *
 * Every call forces strict JSON output and parses defensively. Any failure
 * anywhere returns [] so the deterministic Layer A findings always ship.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Finding, Instruction, Severity } from "@/lib/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
const MAX_CANDIDATES = 10;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const PASS1_SYSTEM = `You are a rules-engine auditor analyzing the instruction set of an AI agent's system prompt.

Your ONLY task: find pairs of instructions that impose INCOMPATIBLE REQUIRED ACTIONS under a REALISTIC TRIGGER CONDITION, with NO STATED PRECEDENCE between them.

A genuine conflict requires ALL of:
1. A realistic situation can trigger both rules at once.
2. When triggered, the rules demand actions that cannot both be performed (or one forbids exactly what the other requires).
3. Nothing in either rule (or in an obvious hierarchy like "this overrides everything") resolves which rule wins.

NOT conflicts:
- Rules about different situations that never co-trigger.
- A general rule plus a more specific exception ("never X" + "if Y, you may X only after approval" — the specific rule is a stated precedence).
- Redundant or overlapping rules that demand compatible actions.
- Tension in tone or emphasis without incompatible required actions.

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"candidates":[{"a":"<instruction id>","b":"<instruction id>","trigger":"<the realistic situation that fires both rules>","reason":"<why the required actions are incompatible>","severity":"critical"|"warning"}]}

Severity: "critical" if the conflict involves money, data mutation, safety, escalation, or compliance; otherwise "warning".
If there are no conflicts, output {"candidates":[]}.`;

const PASS2_SYSTEM = `You are an independent verifier. You are given exactly two rules from an AI agent's system prompt and a claimed conflict between them. Your job is to try to DEFEAT the claim.

The claim is VERIFIED only if:
1. The trigger situation is realistic (would plausibly occur in production).
2. Under that trigger, the two rules demand actions that genuinely cannot both be satisfied.
3. Neither rule states a precedence, exception, or condition that resolves the collision.

If you can construct ANY reasonable reading under which both rules can be satisfied simultaneously, or one rule clearly takes precedence, the claim is REJECTED.

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"verdict":"verified"|"rejected","explanation":"<one sentence>","recommendation":"<if verified: the specific fix, e.g. which rule to scope or the precedence to add>"}`;

// ---------------------------------------------------------------------------
// Defensive JSON parsing
// ---------------------------------------------------------------------------

/** Strip markdown fences and any stray prose around the first JSON object. */
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

type Candidate = {
  a: string;
  b: string;
  trigger: string;
  reason: string;
  severity: Severity;
};

function parseCandidates(raw: string, byId: Map<string, Instruction>): Candidate[] {
  const parsed = extractJson(raw);
  if (parsed === null || typeof parsed !== "object") return [];
  const list = (parsed as { candidates?: unknown }).candidates;
  if (!Array.isArray(list)) return [];

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
      trigger: typeof c.trigger === "string" ? c.trigger : "",
      reason: typeof c.reason === "string" ? c.reason : "",
      severity: c.severity === "critical" ? "critical" : "warning",
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
    explanation: typeof v.explanation === "string" ? v.explanation : "",
    recommendation: typeof v.recommendation === "string" ? v.recommendation : "",
  };
}

// ---------------------------------------------------------------------------
// Model calls
// ---------------------------------------------------------------------------

async function callModel(client: Anthropic, system: string, user: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function isConflictAnalysisAvailable(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0;
}

/**
 * Find verified conflicts between instructions.
 * Returns [] on any failure — callers always get the deterministic findings.
 */
export async function findVerifiedConflicts(instructions: Instruction[]): Promise<Finding[]> {
  if (!isConflictAnalysisAvailable()) return [];
  const rules = instructions.filter((i) => !i.isFossil);
  if (rules.length < 2) return [];

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const byId = new Map(rules.map((i) => [i.id, i]));

  try {
    // ---- Pass 1: candidate discovery over the full rule set ----
    const ruleList = rules.map((i) => `${i.id}: "${i.text}"`).join("\n");
    const pass1Raw = await callModel(client, PASS1_SYSTEM, `Instruction set:\n${ruleList}`);
    const candidates = parseCandidates(pass1Raw, byId);
    if (candidates.length === 0) return [];

    // ---- Pass 2: independent verification of each candidate in isolation ----
    const verifications = await Promise.allSettled(
      candidates.map((c) =>
        callModel(
          client,
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
      const result = verifications[idx];
      if (result.status !== "fulfilled") return;
      const verification = parseVerification(result.value);
      if (!verification || verification.verdict !== "verified") return;

      const ruleA = byId.get(c.a)!;
      const ruleB = byId.get(c.b)!;
      findings.push({
        id: `f-conflict-${findings.length + 1}`,
        component: "instructions",
        severity: c.severity,
        title: "Two rules directly contradict",
        description: `${verification.explanation || c.reason} Trigger: ${c.trigger}`,
        affectedElement: `${ruleA.id} vs ${ruleB.id}`,
        evidence: [ruleA.text, ruleB.text],
        recommendation:
          verification.recommendation ||
          "State an explicit precedence between these two rules, or scope one of them so they can no longer co-trigger.",
      });
    });
    return findings;
  } catch {
    // Model unavailable, rate-limited, or returned garbage — Layer A results still ship.
    return [];
  }
}
