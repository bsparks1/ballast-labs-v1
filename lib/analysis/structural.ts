/**
 * Layer A — Deterministic structural analysis.
 *
 * Pure TypeScript over the pasted text. NO model calls.
 * Fast, reliable, always defensible: every finding produced here can be
 * traced to an exact pattern match in the input.
 */

import YAML from "yaml";
import type { Finding, HarnessComponent, Instruction, ToolGrant } from "@/lib/types";
import { makeFinding } from "./findings";

// ---------------------------------------------------------------------------
// Pattern tables (maintained lists — extend these over time)
// ---------------------------------------------------------------------------

/** Markers of absolute, unconditional rules. */
const ABSOLUTE_RE =
  /\b(always|never|must not|must|only|under no circumstances|at all times|do not|don't|shall not|shall|without exception|in all cases|no matter what|are required to|is required to|may not)\b/i;

/** Markers of conditional rules. */
const CONDITIONAL_RE =
  /\b(if|when|whenever|unless|in case|in the event|upon|once|should (?:a|an|the|any|you)|depending on|as long as|provided that)\b/i;

/** Markers of vague, subjective, unenforceable directives. */
const VAGUE_PATTERNS: RegExp[] = [
  /\bbe helpful\b/i,
  /\buse (?:good|your best|sound|common) (?:judgment|judgement|sense)\b/i,
  /\b(?:as|when|where|if) appropriate\b/i,
  /\bbe professional\b/i,
  /\bbe friendly\b/i,
  /\bbe polite\b/i,
  /\bbe respectful\b/i,
  /\bbe empathetic\b/i,
  /\bappropriately\b/i,
  /\breasonable\b/i,
  /\btry to\b/i,
  /\bstrive to\b/i,
  /\baim to\b/i,
  /\bdo your best\b/i,
  /\bwhere possible\b/i,
  /\bas needed\b/i,
  /\bbest effort\b/i,
  /\bgenerally\b/i,
  /\bhigh.quality\b/i,
  /\bgreat (?:customer )?(?:service|experience)\b/i,
];

/**
 * Known dead scaffolding — instructions that measurably do nothing on modern
 * models but persist in prompts because nobody dares remove them.
 */
const FOSSIL_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /think (?:through (?:this|it) )?step[- ]by[- ]step/i, label: "think step by step" },
  { pattern: /let'?s think/i, label: "let's think" },
  { pattern: /take a deep breath/i, label: "take a deep breath" },
  { pattern: /do(?:n'?t| not) hallucinate/i, label: "do not hallucinate" },
  { pattern: /never hallucinate/i, label: "never hallucinate" },
  { pattern: /do(?:n'?t| not) make (?:things|stuff|anything) up/i, label: "don't make things up" },
  { pattern: /you are a helpful (?:ai )?assistant/i, label: "you are a helpful assistant" },
  { pattern: /you are an ai (?:language )?model/i, label: "you are an AI model" },
  { pattern: /double[- ]check your (?:work|answers?|responses?)/i, label: "double-check your work" },
  { pattern: /think carefully before (?:you )?(?:respond|answer)/i, label: "think carefully before answering" },
  { pattern: /i(?:'ll| will) tip you/i, label: "tip bribe" },
  { pattern: /this is very important to my career/i, label: "importance plea" },
  { pattern: /\bact as if\b.*\bexpert\b/i, label: "act as an expert" },
];

/** Verbs that make a bare sentence an enforceable directive. */
const IMPERATIVE_RE =
  /^(?:please )?(?:respond|answer|reply|use|avoid|ensure|keep|maintain|follow|refer|escalate|ask|provide|include|exclude|write|format|return|output|cite|check|verify|confirm|treat|handle|refuse|decline|redirect|log|record|remember|forget|store|greet|apologi[sz]e|offer|limit|restrict|prioriti[sz]e|be|act|stay|remain|speak|address|resolve|transfer|route|flag|report|notify|summari[sz]e|explain|translate|start|end|begin|close|open|state|mention|list|link|quote|search|look|consult|read|review|obtain|get|collect|gather|validate|sanitize|mask|redact|encrypt|delete|remove|create|update|send|forward|assign|tag|label|classify|prioritize|defer|wait|pause|stop|continue|proceed|retry|repeat|persist|save|cache|clear|reset)\b/i;

const NORMATIVE_RE =
  /\b(you (?:must|should|will|shall|may|can|are (?:to|expected|required|allowed|permitted|forbidden))|must|should|never|always|do not|don't|shall|required|forbidden|prohibited|not allowed|not permitted|is expected|make sure|it is (?:critical|essential|important|mandatory)|under no circumstances)\b/i;

// Tool detection ------------------------------------------------------------

type ToolPattern = { name: string; pattern: RegExp };

const TOOL_NOUNS: ToolPattern[] = [
  { name: "database", pattern: /\b(database|\bdb\b|sql|postgres|mysql|mongo)\b/i },
  { name: "shell", pattern: /\b(shell|terminal|bash|command[- ]line|cli)\b/i },
  { name: "filesystem", pattern: /\b(file ?system|files?|director(?:y|ies))\b/i },
  { name: "api", pattern: /\bapi(?:s| call| endpoint|s)?\b/i },
  { name: "email", pattern: /\be-?mails?\b/i },
  { name: "crm", pattern: /\b(crm|salesforce|hubspot|customer records?)\b/i },
  { name: "payments", pattern: /\b(payments?|refunds?|billing|charges?|stripe|invoice)\b/i },
  { name: "calendar", pattern: /\b(calendar|scheduling|meetings?)\b/i },
  { name: "browser", pattern: /\b(browser|web search|internet|browse)\b/i },
  { name: "slack", pattern: /\bslack\b/i },
  { name: "github", pattern: /\b(github|git|repositor(?:y|ies))\b/i },
  { name: "deployment", pattern: /\b(deploy(?:ment)?s?|kubernetes|k8s|production environment|infra(?:structure)?)\b/i },
  { name: "tickets", pattern: /\b(tickets?|jira|linear|zendesk|helpdesk)\b/i },
  { name: "knowledge-base", pattern: /\b(knowledge ?base|kb|documentation|internal docs|wiki)\b/i },
];

const TOOL_GRANT_LANG_RE =
  /\b(access to|permissions?|granted|you can|you may|able to|allowed to|authorized to|have access)\b/i;

const PERMISSION_VERBS: { permission: string; pattern: RegExp }[] = [
  { permission: "read", pattern: /\b(read|view|look ?up|query|search|fetch|retrieve|access|check|consult|list)\b/i },
  { permission: "write", pattern: /\b(write|update|create|modify|edit|insert|post|send|add|log|record|save|store)\b/i },
  { permission: "delete", pattern: /\b(delete|remove|drop|purge|erase|wipe|destroy)\b/i },
  { permission: "execute", pattern: /\b(execute|run|invoke|trigger|issue|process)\b/i },
  { permission: "deploy", pattern: /\b(deploy|release|publish|roll ?out|promote)\b/i },
  { permission: "admin", pattern: /\b(admin(?:ister|istrative)?|full access|unrestricted|manage|configure|grant|revoke)\b/i },
  { permission: "export", pattern: /\b(export|download)\b/i },
];

export const DANGEROUS_PERMISSIONS = new Set(["delete", "execute", "deploy", "admin", "write", "export"]);
export const HIGH_RISK_PERMISSIONS = new Set(["delete", "deploy", "admin", "export"]);
export const DESTRUCTIVE_TOOL_NAME_RE = /\b(delete|close|cancel|export|drop|purge|erase|wipe|destroy|refund)\b/i;

// Component signal scans ----------------------------------------------------

const GUARDRAIL_RE =
  /\b(never|must not|do not|don't|refuse|decline|under no circumstances|not allowed|not permitted|forbidden|prohibited|off[- ]limits|block)\b/i;

const GUARDRAIL_TOPIC_RE =
  /\b(pii|personal (?:data|information)|password|credential|secret|api key|legal|medical|financial advice|harmful|unsafe|jailbreak|prompt injection|compliance|regulated|sensitive|confidential|internal[- ]only|share|disclose|reveal)\b/i;

const DELEGATION_RE =
  /\b(escalat\w+|hand(?:s)? ?off|hand over|transfer(?:s|red)? to|human (?:agent|supervisor|reviewer|operator|in the loop)|supervisor|manager approval|approval|sign[- ]off|defer to|route to|loop in|notify a human)\b/i;

const MEMORY_RE =
  /\b(remember|memor(?:y|ize)|persist\w*|retain|recall|across sessions?|conversation history|previous (?:conversations?|sessions?|interactions?)|long[- ]term|store .*(?:preference|detail|information)|forget)\b/i;

const KNOWLEDGE_RE =
  /\b(knowledge ?base|documentation|internal docs|wiki|faq|reference (?:material|docs?)|product catalog|policy document|training data|as of \d{4}|last updated)\b/i;

// ---------------------------------------------------------------------------
// Instruction extraction
// ---------------------------------------------------------------------------

/** Split raw prompt text into atomic candidate sentences. */
export function splitSentences(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    // drop markdown headers, fences, separators
    .filter((l) => l.length > 0 && !/^#{1,6}\s/.test(l) && !/^```/.test(l) && !/^[-=*_]{3,}$/.test(l))
    // strip bullet markers and numbering
    .map((l) => l.replace(/^(?:[-*•‣▪]|\d+[.)]|[a-z][.)])\s+/i, ""));

  const sentences: string[] = [];
  for (const line of lines) {
    const parts = line
      .split(/(?<=[.!?;])\s+(?=[A-Z"'(])/)
      .map((s) => s.trim())
      .filter(Boolean);
    sentences.push(...parts);
  }
  return sentences;
}

function isInstructionSentence(s: string): boolean {
  if (s.length < 8) return false;
  if (NORMATIVE_RE.test(s)) return true;
  if (IMPERATIVE_RE.test(s)) return true;
  if (CONDITIONAL_RE.test(s) && IMPERATIVE_RE.test(s.replace(/^.*?,\s*/, ""))) return true;
  return false;
}

function classifyInstruction(s: string): Instruction["type"] {
  // A rule that only applies under a stated condition is conditional even if
  // the consequent uses absolute language.
  if (CONDITIONAL_RE.test(s)) return "conditional";
  if (ABSOLUTE_RE.test(s)) return "absolute";
  if (VAGUE_PATTERNS.some((p) => p.test(s))) return "vague";
  // Bare imperative with a concrete verb = unconditional directive.
  if (IMPERATIVE_RE.test(s) || NORMATIVE_RE.test(s)) return "absolute";
  return "vague";
}

export function matchFossil(s: string): string | null {
  for (const { pattern, label } of FOSSIL_PATTERNS) {
    if (pattern.test(s)) return label;
  }
  return null;
}

export function isVague(s: string): boolean {
  return VAGUE_PATTERNS.some((p) => p.test(s));
}

/** Extract atomic instructions from a system prompt. */
export function extractInstructions(text: string): Instruction[] {
  const sentences = splitSentences(text);
  const instructions: Instruction[] = [];
  let i = 0;
  for (const s of sentences) {
    const fossil = matchFossil(s);
    if (!fossil && !isInstructionSentence(s)) continue;
    i += 1;
    instructions.push({
      id: `ins-${i}`,
      text: s,
      type: fossil ? "vague" : classifyInstruction(s),
      isFossil: fossil !== null,
    });
  }
  return instructions;
}

// ---------------------------------------------------------------------------
// Tool grant extraction
// ---------------------------------------------------------------------------

/** Parse a structured config (JSON or YAML) for reliable tool grants. */
export function parseConfigTools(config: string): ToolGrant[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(config);
  } catch {
    try {
      parsed = YAML.parse(config);
    } catch {
      return [];
    }
  }
  if (parsed === null || typeof parsed !== "object") return [];

  const obj = parsed as Record<string, unknown>;
  const rawTools = Array.isArray(obj.tools)
    ? obj.tools
    : Array.isArray(obj.functions)
      ? obj.functions
      : Array.isArray(parsed)
        ? (parsed as unknown[])
        : [];

  const grants: ToolGrant[] = [];
  for (const t of rawTools) {
    if (typeof t === "string") {
      grants.push({ name: t, permissions: inferPermissionsFromName(t), exercised: "unknown" });
      continue;
    }
    if (t === null || typeof t !== "object") continue;
    const tool = t as Record<string, unknown>;
    const name = typeof tool.name === "string" ? tool.name : typeof tool.id === "string" ? tool.id : null;
    if (!name) continue;
    let permissions: string[] = [];
    if (Array.isArray(tool.permissions)) {
      permissions = tool.permissions.filter((p): p is string => typeof p === "string");
    } else if (typeof tool.access === "string") {
      permissions = [tool.access];
    } else {
      const desc = typeof tool.description === "string" ? tool.description : "";
      permissions = extractPermissions(`${name} ${desc}`);
    }
    if (permissions.length === 0) permissions = inferPermissionsFromName(name);
    let exercised: ToolGrant["exercised"] = "unknown";
    if (typeof tool.exercised === "boolean") exercised = tool.exercised;
    else if (typeof tool.usage_count === "number") exercised = tool.usage_count > 0;
    else if (typeof tool.last_used === "string") exercised = true;
    else if (tool.last_used === null) exercised = false;
    grants.push({ name, permissions, exercised });
  }
  return grants;
}

function inferPermissionsFromName(name: string): string[] {
  const normalized = name.replace(/[_-]/g, " ");
  const perms = extractPermissions(normalized);
  if (/\b(close|cancel|terminate)\b/i.test(normalized) && !perms.includes("execute")) {
    perms.push("execute");
  }
  if (/\brefund\b/i.test(normalized) && !perms.includes("execute")) {
    perms.push("execute");
  }
  return perms.length > 0 ? perms : ["read"];
}

function extractPermissions(text: string): string[] {
  const perms: string[] = [];
  for (const { permission, pattern } of PERMISSION_VERBS) {
    if (pattern.test(text)) perms.push(permission);
  }
  return perms;
}

/** Pull snake_case / identifier tool names from sentences that mention tools. */
export function extractIdentifierToolGrants(text: string): ToolGrant[] {
  const grants: ToolGrant[] = [];
  const seen = new Set<string>();
  for (const s of splitSentences(text)) {
    if (!/\btools?\b/i.test(s)) continue;
    const idents = s.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi) ?? [];
    for (const name of idents) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      grants.push({
        name,
        permissions: inferPermissionsFromName(name),
        exercised: "unknown",
      });
    }
  }
  return grants;
}

/** Scan prose for tool/permission mentions and build ToolGrant[]. */
export function scanToolGrants(text: string, config?: string): ToolGrant[] {
  // Structured config wins when present.
  if (config && config.trim().length > 0) {
    const fromConfig = parseConfigTools(config);
    if (fromConfig.length > 0) return fromConfig;
  }

  const byName = new Map<string, Set<string>>();

  for (const tool of extractIdentifierToolGrants(text)) {
    const set = byName.get(tool.name) ?? new Set<string>();
    tool.permissions.forEach((p) => set.add(p));
    byName.set(tool.name, set);
  }

  const sentences = splitSentences(text);
  for (const s of sentences) {
    if (!TOOL_GRANT_LANG_RE.test(s)) continue;
    for (const { name, pattern } of TOOL_NOUNS) {
      if (!pattern.test(s)) continue;
      const perms = extractPermissions(s);
      if (perms.length === 0) continue; // a noun without a capability verb is just a mention
      const set = byName.get(name) ?? new Set<string>();
      perms.forEach((p) => set.add(p));
      byName.set(name, set);
    }
  }

  return [...byName.entries()].map(([name, perms]) => ({
    name,
    permissions: [...perms],
    exercised: "unknown" as const,
  }));
}

// ---------------------------------------------------------------------------
// Structural findings
// ---------------------------------------------------------------------------

export type StructuralResult = {
  instructions: Instruction[];
  tools: ToolGrant[];
  findings: Finding[];
  summaries: Partial<Record<HarnessComponent, string>>;
  /**
   * Whether the prompt actually exercises this component. Absence is not a
   * perfect score — it is not-applicable and must be excluded from overall.
   */
  present: Record<HarnessComponent, boolean>;
};

export function runStructuralAnalysis(text: string, config?: string): StructuralResult {
  const instructions = extractInstructions(text);
  const tools = scanToolGrants(text, config);
  const findings: Finding[] = [];
  const summaries: Partial<Record<HarnessComponent, string>> = {};
  const sentences = splitSentences(text);

  // ---- Instructions component ----
  const absolute = instructions.filter((i) => i.type === "absolute");
  const vague = instructions.filter((i) => i.type === "vague" && !i.isFossil);
  const fossils = instructions.filter((i) => i.isFossil);

  summaries.instructions = `${instructions.length} atomic instructions extracted: ${absolute.length} absolute, ${instructions.filter((i) => i.type === "conditional").length} conditional, ${vague.length + fossils.length} vague — including ${fossils.length} fossil${fossils.length === 1 ? "" : "s"}.`;

  if (instructions.length > 40) {
    findings.push(
      makeFinding({
        category: "structural",
        component: "instructions",
        severity: "warning",
        title: `Instruction overload: ${instructions.length} rules`,
        description:
          "Beyond roughly 40 concurrent rules, instruction-following reliability degrades measurably — the model silently drops or deprioritizes rules under load. Every rule added past this point dilutes the ones that matter.",
        affectedElement: `${instructions.length} instructions in one system prompt`,
        recommendation:
          "Consolidate overlapping rules, delete fossils and vague directives, and move situational guidance into retrieved context instead of the always-on prompt.",
      })
    );
  }

  if (instructions.length >= 10 && absolute.length / instructions.length > 0.6) {
    findings.push(
      makeFinding({
        category: "structural",
        component: "instructions",
        severity: "warning",
        title: `High absolute-rule density: ${absolute.length} of ${instructions.length} rules are absolute`,
        description:
          "When most rules are phrased as always/never/must with no stated precedence, any two of them can collide at runtime and the model must guess which one wins. Absolute language should be reserved for rules that genuinely have no exceptions.",
        affectedElement: `${absolute.length} absolute rules (${Math.round((absolute.length / instructions.length) * 100)}% of all instructions)`,
        evidence: absolute.slice(0, 6).map((i) => i.text),
        recommendation:
          "Demote rules that have legitimate exceptions to conditional form (\"if X, then Y\") and add an explicit precedence order for the absolutes that remain.",
      })
    );
  }

  if (fossils.length > 0) {
    const tokenEstimate = Math.round(fossils.reduce((n, f) => n + f.text.length / 4, 0));
    findings.push(
      makeFinding({
        category: "structural",
        component: "instructions",
        severity: fossils.length >= 4 ? "warning" : "info",
        title: `${fossils.length} fossil instruction${fossils.length === 1 ? "" : "s"} doing nothing`,
        description:
          "These are dead scaffolding — phrases like \"think step by step\" or \"do not hallucinate\" that have no measurable effect on modern models. They survive because nobody dares delete them. They waste tokens on every single call and add noise that dilutes the rules that do matter.",
        affectedElement: fossils.map((f) => `"${f.text}"`).join("; "),
        evidence: fossils.map((f) => f.text),
        recommendation: `Delete all ${fossils.length}. This recovers roughly ${tokenEstimate} tokens per call with zero behavior change.`,
      })
    );
  }

  if (vague.length > 0) {
    findings.push(
      makeFinding({
        category: "structural",
        component: "instructions",
        severity: vague.length >= 5 ? "warning" : "info",
        title: `${vague.length} vague directive${vague.length === 1 ? "" : "s"} that cannot be enforced`,
        description:
          "Directives like \"be professional\" or \"use good judgment\" are subjective — there is no way to verify compliance, and the model interprets them inconsistently. They create an illusion of control without providing any.",
        affectedElement: vague.slice(0, 5).map((v) => `"${v.text}"`).join("; "),
        evidence: vague.map((v) => v.text),
        recommendation:
          "Replace each vague directive with a concrete, testable rule (e.g. \"be professional\" → \"address the customer by name; never use slang or emoji\") or delete it.",
      })
    );
  }

  // ---- Tools component ----
  summaries.tools =
    tools.length === 0
      ? "No tool grants detected in the prompt or config."
      : `${tools.length} tool grant${tools.length === 1 ? "" : "s"} detected: ${tools.map((t) => `${t.name} (${t.permissions.join(", ")})`).join("; ")}.`;

  for (const tool of tools) {
    const dangerous = tool.permissions.filter((p) => DANGEROUS_PERMISSIONS.has(p));
    const highRisk = tool.permissions.filter((p) => HIGH_RISK_PERMISSIONS.has(p));
    if (dangerous.length === 0) continue;
    if (tool.exercised === true) continue;
    const unusedNote =
      tool.exercised === false
        ? "This tool has never been exercised — the grant is pure standing risk."
        : "There is no evidence this capability is ever exercised.";
    const unknownNonHighRisk = tool.exercised === "unknown" && highRisk.length === 0;
    findings.push(
      makeFinding({
        category: "structural",
        component: "tools",
        severity: highRisk.length > 0 ? "critical" : unknownNonHighRisk ? "info" : "warning",
        title: `Overpermissioned: ${tool.name} holds ${dangerous.join("/")} access`,
        description: `The agent is granted ${tool.permissions.join(", ")} on ${tool.name}. ${unusedNote} Standing write-side permissions are the primary blast radius if the agent is manipulated via prompt injection or simply misfires.`,
        affectedElement: `${tool.name}: [${tool.permissions.join(", ")}]`,
        recommendation:
          highRisk.length > 0
            ? `Remove ${highRisk.join(" and ")} access from ${tool.name}, or gate it behind explicit human approval per invocation.`
            : `Downgrade ${tool.name} to read-only unless a specific workflow requires writes; if one does, scope the grant to that workflow.`,
      })
    );
  }

  // ---- Guardrails component ----
  const prohibitions = sentences.filter((s) => GUARDRAIL_RE.test(s) && GUARDRAIL_TOPIC_RE.test(s));
  const hasDangerousTools = tools.some((t) => t.permissions.some((p) => DANGEROUS_PERMISSIONS.has(p)));

  summaries.guardrails =
    prohibitions.length === 0
      ? "No explicit safety guardrails (prohibitions on sensitive topics or data) detected."
      : `${prohibitions.length} explicit guardrail${prohibitions.length === 1 ? "" : "s"} detected covering sensitive topics or data.`;

  if (prohibitions.length === 0 && hasDangerousTools) {
    findings.push(
      makeFinding({
        category: "structural",
        component: "guardrails",
        severity: "critical",
        title: "Write-capable agent with no explicit guardrails",
        description:
          "The agent holds write-side tool permissions but the prompt contains no explicit prohibitions on sensitive data, destructive actions, or off-limits topics. Nothing in the harness bounds what the agent may do with the access it has.",
        affectedElement: "Entire prompt — no guardrail statements found",
        recommendation:
          "Add explicit, absolute prohibitions for the highest-risk actions (e.g. \"Never delete records without human confirmation\", \"Never disclose credentials or PII\"), and state that they override all other instructions.",
      })
    );
  } else if (prohibitions.length === 0 && (instructions.length > 0 || tools.length > 0)) {
    findings.push(
      makeFinding({
        category: "structural",
        component: "guardrails",
        severity: "info",
        title: "No explicit guardrails detected",
        description:
          "The prompt contains no explicit prohibitions on sensitive topics or data handling. This may be acceptable for a low-risk agent, but it means the harness places no stated bounds on behavior.",
        affectedElement: "Entire prompt — no guardrail statements found",
        recommendation:
          "State the agent's hard limits explicitly, even if brief — what it must never disclose, never do, and never claim.",
      })
    );
  } else if (prohibitions.length > 0) {
    const vagueGuardrails = prohibitions.filter((s) => isVague(s));
    if (vagueGuardrails.length > 0) {
      findings.push(
        makeFinding({
          category: "structural",
        component: "guardrails",
          severity: "warning",
          title: `${vagueGuardrails.length} guardrail${vagueGuardrails.length === 1 ? "" : "s"} phrased vaguely`,
          description:
            "Guardrails written in subjective language cannot be reliably enforced — the model decides case-by-case what counts as a violation.",
          affectedElement: vagueGuardrails.map((s) => `"${s}"`).join("; "),
          evidence: vagueGuardrails,
          recommendation: "Rewrite each guardrail as a concrete, testable prohibition with no judgment calls.",
        })
      );
    }
  }

  // ---- Delegation component ----
  const delegationMentions = sentences.filter((s) => DELEGATION_RE.test(s));
  summaries.delegation =
    delegationMentions.length === 0
      ? "No escalation or handoff path detected."
      : `${delegationMentions.length} delegation/escalation rule${delegationMentions.length === 1 ? "" : "s"} detected.`;

  if (delegationMentions.length === 0 && hasDangerousTools) {
    findings.push(
      makeFinding({
        category: "structural",
        component: "delegation",
        severity: "warning",
        title: "No escalation path for a write-capable agent",
        description:
          "The agent can take consequential actions but the harness defines no condition under which it should stop and hand off to a human. When it hits a situation it can't handle, its only options are to guess or to act anyway.",
        affectedElement: "Entire prompt — no escalation or handoff rules found",
        recommendation:
          "Define explicit escalation triggers (e.g. \"if the customer disputes a charge over $X, transfer to a human\") and a named destination for handoffs.",
      })
    );
  }

  // ---- Memory component ----
  const memoryMentions = sentences.filter((s) => MEMORY_RE.test(s));
  summaries.memory =
    memoryMentions.length === 0
      ? "No memory or persistence behavior specified."
      : `${memoryMentions.length} memory-related rule${memoryMentions.length === 1 ? "" : "s"} detected.`;

  if (memoryMentions.length > 0) {
    const vagueMemory = memoryMentions.filter((s) => isVague(s) || !ABSOLUTE_RE.test(s));
    const sensitiveMemory = memoryMentions.filter((s) =>
      /\b(pii|personal|payment|card|password|credential|sensitive|address|phone|ssn)\b/i.test(s)
    );
    if (sensitiveMemory.length > 0) {
      findings.push(
        makeFinding({
          category: "structural",
        component: "memory",
          severity: "warning",
          title: "Memory rules touch sensitive data",
          description:
            "The prompt instructs the agent to remember or store information in categories that may include personal or sensitive data, without a stated retention limit or exclusion list.",
          affectedElement: sensitiveMemory.map((s) => `"${s}"`).join("; "),
          evidence: sensitiveMemory,
          recommendation:
            "Enumerate exactly which fields may be remembered, exclude sensitive categories explicitly, and state a retention policy.",
        })
      );
    } else if (vagueMemory.length === memoryMentions.length) {
      findings.push(
        makeFinding({
          category: "structural",
        component: "memory",
          severity: "info",
          title: "Memory behavior mentioned but underspecified",
          description:
            "The prompt references remembering or persisting information but never states what may be stored, for how long, or what must never be retained.",
          affectedElement: memoryMentions.slice(0, 3).map((s) => `"${s}"`).join("; "),
          evidence: memoryMentions,
          recommendation:
            "Specify an allowlist of what the agent may retain and an explicit prohibition list for everything else.",
        })
      );
    }
  }

  // ---- Knowledge component ----
  const knowledgeMentions = sentences.filter((s) => KNOWLEDGE_RE.test(s));
  summaries.knowledge =
    knowledgeMentions.length === 0
      ? "No knowledge sources or reference material detected."
      : `${knowledgeMentions.length} knowledge-source reference${knowledgeMentions.length === 1 ? "" : "s"} detected.`;

  const currentYear = new Date().getFullYear();
  const staleRefs = knowledgeMentions.filter((s) => {
    const years = [...s.matchAll(/\b(20\d{2})\b/g)].map((m) => parseInt(m[1], 10));
    return years.some((y) => y <= currentYear - 2);
  });
  if (staleRefs.length > 0) {
    findings.push(
      makeFinding({
        category: "structural",
        component: "knowledge",
        severity: "warning",
        title: "Knowledge references appear stale",
        description:
          "The prompt pins the agent's knowledge to dated material at least two years old. The agent will confidently answer from an outdated snapshot.",
        affectedElement: staleRefs.map((s) => `"${s}"`).join("; "),
        evidence: staleRefs,
        recommendation:
          "Update the referenced material or replace static references with a retrieval step against a maintained source.",
      })
    );
  }

  const present: Record<HarnessComponent, boolean> = {
    instructions: instructions.length > 0,
    tools: tools.length > 0,
    knowledge: knowledgeMentions.length > 0,
    memory: memoryMentions.length > 0,
    guardrails: prohibitions.length > 0,
    delegation: delegationMentions.length > 0,
  };

  return { instructions, tools, findings, summaries, present };
}
