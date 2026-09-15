/**
 * Pass 4 — Instruction–tool mismatch.
 * Deterministic, with a light model assist when available.
 */

import type { Finding, Instruction, ToolGrant } from "@/lib/types";
import { makeFinding } from "@/lib/analysis/findings";
import { asString, asSeverity, parseJsonArrayField } from "@/lib/analysis/model";
import { DESTRUCTIVE_TOOL_NAME_RE, HIGH_RISK_PERMISSIONS } from "@/lib/analysis/structural";
import type { AnalysisPass, PassOutput } from "./types";

const MODEL_SYSTEM = `You are auditing an AI agent's granted tools against its instructions.

Find:
1. Tools granted but never referenced in any instruction (ungoverned capability).
2. Instructions telling the agent NOT to do something it has full tool permission to do.
3. Instructions referencing capabilities the agent has no tool for.

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"findings":[{"kind":"ungoverned"|"forbidden-but-permitted"|"instruction-without-tool","tool":"<name or n/a>","reason":"<one sentence>","severity":"critical"|"warning"}]}

Severity: critical for destructive/data tools that are ungoverned or that contradict a prohibition; else warning.
If none, output {"findings":[]}.`;

function toolMentionedInInstructions(tool: ToolGrant, instructions: Instruction[], rawPrompt: string): boolean {
  const variants = [tool.name, tool.name.replace(/[_-]/g, " "), tool.name.replace(/[_-]/g, "")].map((v) =>
    v.toLowerCase()
  );
  const nameRe = new RegExp(tool.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const grantLines = new Set(
    rawPrompt.split(/\n/).filter((line) => /\btools?\b/i.test(line) && nameRe.test(line) && /,\s*/.test(line))
  );
  const corpus = [
    ...instructions.map((i) => i.text),
    ...rawPrompt.split(/\n/).filter((line) => !grantLines.has(line)),
  ]
    .join("\n")
    .toLowerCase();
  return variants.some((v) => v.length >= 3 && corpus.includes(v));
}

function isDestructive(tool: ToolGrant): boolean {
  return (
    DESTRUCTIVE_TOOL_NAME_RE.test(tool.name.replace(/[_-]/g, " ")) ||
    tool.permissions.some((p) => HIGH_RISK_PERMISSIONS.has(p) || p === "delete" || p === "export")
  );
}

export function deterministicToolMismatch(
  instructions: Instruction[],
  tools: ToolGrant[],
  rawPrompt: string
): Finding[] {
  const findings: Finding[] = [];

  for (const tool of tools) {
    if (toolMentionedInInstructions(tool, instructions, rawPrompt)) continue;
    const destructive = isDestructive(tool);
    findings.push(
      makeFinding({
        category: "tool-mismatch",
        component: "tools",
        severity: destructive ? "critical" : "warning",
        title: `Ungoverned tool: ${tool.name} is granted but never instructed`,
        description: `The agent holds ${tool.name} (${tool.permissions.join(", ")}) but no instruction references it or constrains its use. That is an ungoverned capability.`,
        affectedElement: tool.name,
        evidence: [tool.name + ": [" + tool.permissions.join(", ") + "]"],
        recommendation: destructive
          ? `Remove ${tool.name} or add an explicit rule that names it, states when it may be used, and requires confirmation for destructive invocations.`
          : `Either document when ${tool.name} may be used, or remove the grant.`,
      })
    );
  }

  const prohibition = /\b(do not|don't|never|must not)\b.{0,80}\b(delete|modify|write|drop|export|close|cancel)\b/i;
  for (const ins of instructions) {
    if (!prohibition.test(ins.text)) continue;
    const action = ins.text.match(/\b(delete|modify|write|drop|export|close|cancel)\b/i)?.[1]?.toLowerCase();
    if (!action) continue;
    const matching = tools.filter(
      (t) =>
        t.name.replace(/[_-]/g, " ").toLowerCase().includes(action) ||
        t.permissions.some((p) => p.toLowerCase().includes(action) || (action === "delete" && p === "delete"))
    );
    for (const tool of matching) {
      findings.push(
        makeFinding({
          category: "tool-mismatch",
          component: "tools",
          severity: "critical",
          title: `Instruction forbids ${action}, but ${tool.name} permits it`,
          description: `The prompt tells the agent not to ${action}, yet ${tool.name} is granted with ${tool.permissions.join(", ")} access. This is the Replit shape: a prohibition next to an open permission.`,
          affectedElement: `${ins.id} vs ${tool.name}`,
          evidence: [ins.text, tool.name + ": [" + tool.permissions.join(", ") + "]"],
          recommendation: `Revoke ${action} permission on ${tool.name}, or change the instruction so the granted permission is the one the agent is actually allowed to use.`,
        })
      );
    }
  }

  return findings;
}

export const findToolMismatch: AnalysisPass = async (ctx): Promise<PassOutput> => {
  const deterministic = deterministicToolMismatch(ctx.instructions, ctx.tools, ctx.rawPrompt);

  if (!ctx.modelAvailable) {
    return {
      findings: deterministic,
      incomplete: {
        status: deterministic.length > 0 ? "partial" : "skipped",
        note: "Tool-mismatch model assist was skipped (ANTHROPIC_API_KEY is not set).",
      },
    };
  }

  try {
    const toolList = ctx.tools.map((t) => `${t.name}: [${t.permissions.join(", ")}]`).join("\n") || "(none)";
    const ruleList = ctx.instructions.map((i) => `${i.id}: "${i.text}"`).join("\n");
    const raw = await ctx.callModel(
      "tool-mismatch",
      MODEL_SYSTEM,
      `Tools:\n${toolList}\n\nInstructions:\n${ruleList}`
    );
    const list = parseJsonArrayField("tool-mismatch", raw, "findings");
    const modeled: Finding[] = [];
    for (const item of list) {
      if (item === null || typeof item !== "object") continue;
      const f = item as Record<string, unknown>;
      const tool = asString(f.tool, "tool");
      const severity = asSeverity(f.severity, "warning");
      modeled.push(
        makeFinding({
          category: "tool-mismatch",
          component: "tools",
          severity,
          title: asString(f.kind) === "forbidden-but-permitted"
            ? `Instruction forbids an action that ${tool} permits`
            : `Instruction–tool mismatch: ${tool}`,
          description: asString(f.reason),
          affectedElement: tool,
          recommendation: "Align granted tools with the instructions: revoke extra permissions or write the missing constraint.",
        })
      );
    }
    return { findings: [...deterministic, ...modeled] };
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    console.error("[ballast:pass] tool-mismatch failed", err);
    return {
      findings: deterministic,
      incomplete: {
        status: deterministic.length > 0 ? "partial" : "error",
        note: `Tool-mismatch model assist failed: ${note}`,
      },
    };
  }
};
