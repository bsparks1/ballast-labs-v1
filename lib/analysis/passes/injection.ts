/**
 * Pass 3 — Prompt-injection surface.
 * Detects instructions to read, trust, or act on untrusted external content.
 */

import type { Finding } from "@/lib/types";
import { makeFinding } from "@/lib/analysis/findings";
import { asString, callModelArray } from "@/lib/analysis/model";
import { DANGEROUS_PERMISSIONS } from "@/lib/analysis/structural";
import type { AnalysisPass, PassOutput } from "./types";

const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /act on (?:any |the |all )?instructions (?:they contain|contained in|in )/i,
    label: "act on instructions contained in untrusted content",
  },
  {
    pattern: /follow (?:any |the |all )?instructions (?:in|from|contained in) /i,
    label: "follow instructions from untrusted content",
  },
  {
    pattern: /(?:read|trust|obey|execute)\s+(?:any\s+|the\s+)?(?:instructions|commands|directives)\s+(?:in|from|inside)\s+(?:user|customer|uploaded|retrieved|external|email|document)/i,
    label: "trust instructions inside external content",
  },
  {
    pattern: /you must always follow the customer(?:'s)? instructions/i,
    label: "always follow the customer's instructions",
  },
];

const MODEL_SYSTEM = `You are auditing an AI agent's system prompt for PROMPT-INJECTION SURFACE.

Flag instructions that tell the agent to read, trust, or act on untrusted external content (user-uploaded documents, retrieved content, emails, web pages) especially in the same context as privileged instructions or tool access.

Any instruction like "act on instructions contained in [user content]" is a critical injection vulnerability. Cross-reference against the tools the agent holds — untrusted input + powerful tools = critical.

Output STRICT JSON only — no prose, no markdown fences. Schema:
{"findings":[{"quote":"<the exact instruction>","reason":"<why this is an injection surface>","severity":"critical"}]}

If none, output {"findings":[]}.`;

export function deterministicInjectionFindings(rawPrompt: string, hasPowerfulTools: boolean): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const { pattern, label } of INJECTION_PATTERNS) {
    const match = rawPrompt.match(pattern);
    if (!match) continue;
    const quote = match[0];
    if (seen.has(quote.toLowerCase())) continue;
    seen.add(quote.toLowerCase());
    findings.push(
      makeFinding({
        category: "injection",
        component: "guardrails",
        severity: "critical",
        title: "Prompt-injection surface: agent acts on untrusted content",
        description: `The prompt instructs the agent to ${label}. Untrusted input can override the system prompt${hasPowerfulTools ? " and drive privileged tools" : ""}. This is an EchoLeak-shaped vulnerability.`,
        affectedElement: quote,
        evidence: [surroundingSentence(rawPrompt, quote)],
        recommendation:
          "Treat customer documents, emails, and retrieved content as untrusted data — never as instructions. State that tool-using actions may only follow the system prompt, not content the user supplies.",
      })
    );
  }

  return findings;
}

function surroundingSentence(text: string, snippet: string): string {
  const idx = text.toLowerCase().indexOf(snippet.toLowerCase());
  if (idx < 0) return snippet;
  const start = text.lastIndexOf("\n", idx);
  const end = text.indexOf("\n", idx + snippet.length);
  return text.slice(start + 1, end === -1 ? undefined : end).trim();
}

export const findInjectionSurface: AnalysisPass = async (ctx): Promise<PassOutput> => {
  const hasPowerfulTools = ctx.tools.some((t) => t.permissions.some((p) => DANGEROUS_PERMISSIONS.has(p)));
  const deterministic = deterministicInjectionFindings(ctx.rawPrompt, hasPowerfulTools);

  if (!ctx.modelAvailable) {
    return { findings: deterministic };
  }

  const toolList = ctx.tools.map((t) => `${t.name}: [${t.permissions.join(", ")}]`).join(", ") || "(none)";
  const list = await callModelArray(
    ctx.callModel,
    "injection-surface",
    MODEL_SYSTEM,
    `Tools held: ${toolList}\n\nSystem prompt:\n${ctx.rawPrompt}`,
    "findings"
  );
  const modeled: Finding[] = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const quote = asString(f.quote);
    if (!quote) continue;
    modeled.push(
      makeFinding({
        category: "injection",
        component: "guardrails",
        severity: "critical",
        title: "Prompt-injection surface: agent acts on untrusted content",
        description: asString(f.reason) || "The prompt instructs the agent to trust or act on untrusted external content.",
        affectedElement: quote,
        evidence: [quote],
        recommendation:
          "Treat external content as untrusted data. Never follow instructions that appear inside user documents, emails, or retrieved text.",
      })
    );
  }
  return { findings: [...deterministic, ...modeled] };
};
