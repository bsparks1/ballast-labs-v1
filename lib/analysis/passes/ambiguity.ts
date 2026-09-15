/**
 * Pass 5 — Ambiguity / unenforceability.
 * Directives too subjective to verify or follow consistently.
 */

import type { Finding, Instruction } from "@/lib/types";
import { makeFinding } from "@/lib/analysis/findings";
import { asString, asSeverity, parseJsonArrayField } from "@/lib/analysis/model";
import { isVague } from "@/lib/analysis/structural";
import type { AnalysisPass, PassOutput } from "./types";

const HIGH_STAKES_RE =
  /\b(refund|payment|delete|export|close|cancel|escalat|approv|pii|password|credential|charge)\b/i;

const EXTRA_VAGUE_RE =
  /\b(good judgment|respond appropriately|be helpful|be professional|be friendly|use your (?:best )?judgment|as appropriate)\b/i;

const MODEL_SYSTEM = `You are auditing an AI agent's system prompt for UNENFORCEABLE directives.

Flag instructions too subjective to verify or follow consistently — phrases like "be helpful", "use good judgment", "respond appropriately", "be professional". These are governance holes: a rule that cannot be checked is not governing.

Severity is "info" unless the vague rule governs a high-stakes action (money, deletion, escalation, sensitive data) — then "warning".

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"findings":[{"quote":"<the vague directive>","reason":"<why it cannot be enforced>","severity":"info"|"warning"}]}

If none, output {"findings":[]}.`;

export function deterministicAmbiguity(instructions: Instruction[]): Finding[] {
  const findings: Finding[] = [];
  for (const ins of instructions) {
    if (ins.isFossil) continue;
    const vague = ins.type === "vague" || isVague(ins.text) || EXTRA_VAGUE_RE.test(ins.text);
    if (!vague) continue;
    const highStakes = HIGH_STAKES_RE.test(ins.text);
    findings.push(
      makeFinding({
        category: "ambiguity",
        component: "instructions",
        severity: highStakes ? "warning" : "info",
        title: "Unenforceable directive",
        description: `"${ins.text}" is too subjective to verify or follow consistently. A rule that cannot be checked is not governing the agent.`,
        affectedElement: ins.id,
        evidence: [ins.text],
        recommendation:
          "Replace this with a concrete, testable rule (e.g. \"be professional\" → \"address the customer by name; never use slang or emoji\") or delete it.",
      })
    );
  }
  return findings;
}

export const findAmbiguity: AnalysisPass = async (ctx): Promise<PassOutput> => {
  const deterministic = deterministicAmbiguity(ctx.instructions);

  if (!ctx.modelAvailable) {
    return {
      findings: deterministic,
      incomplete: {
        status: deterministic.length > 0 ? "partial" : "skipped",
        note: "Ambiguity model call was skipped (ANTHROPIC_API_KEY is not set).",
      },
    };
  }

  try {
    const ruleList = ctx.instructions.map((i) => `${i.id}: "${i.text}"`).join("\n");
    const raw = await ctx.callModel("ambiguity", MODEL_SYSTEM, `Instructions:\n${ruleList}`);
    const list = parseJsonArrayField("ambiguity", raw, "findings");
    const modeled: Finding[] = [];
    for (const item of list) {
      if (item === null || typeof item !== "object") continue;
      const f = item as Record<string, unknown>;
      const quote = asString(f.quote);
      if (!quote) continue;
      modeled.push(
        makeFinding({
          category: "ambiguity",
          component: "instructions",
          severity: asSeverity(f.severity, "info"),
          title: "Unenforceable directive",
          description: asString(f.reason) || `"${quote}" is too subjective to verify or follow consistently.`,
          affectedElement: quote,
          evidence: [quote],
          recommendation: "Replace this with a concrete, testable rule or delete it.",
        })
      );
    }
    return { findings: [...deterministic, ...modeled] };
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    console.error("[ballast:pass] ambiguity failed", err);
    return {
      findings: deterministic,
      incomplete: {
        status: deterministic.length > 0 ? "partial" : "error",
        note: `Ambiguity model pass failed: ${note}`,
      },
    };
  }
};
