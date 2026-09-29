/**
 * Deterministic policy pre-checks.
 * A high-confidence result here is evidence from the decomposed harness.
 * Silence returns cannot_determine — it is never upgraded to compliant.
 */

import { DESTRUCTIVE_TOOL_NAME_RE, splitSentences } from "@/lib/analysis/structural";
import type { HarnessComponent, Instruction, PolicyVerdict, ToolGrant } from "@/lib/types";
import type { DecomposedHarness } from "./decompose";

export type DeterministicCheck = {
  verdict: PolicyVerdict;
  confidence: "high" | "low";
  evidence: string[];
  reasoning: string;
  recommendation: string;
  affectedComponent: HarnessComponent | null;
  /** The harness does not address the policy. The model must not overturn this. */
  silence: boolean;
};

const DESTRUCTIVE_PERMS = new Set(["delete", "export", "admin", "execute", "deploy"]);
const FINANCIAL_NAME_RE = /\b(refund|payment|billing|charge|payout|invoice)\b/i;
const BOUND_RE = /\$\s?\d+|\b\d+\s*(?:usd|dollars|eur)\b|\bup to\b|\bno more than\b|\bat most\b|\blimit(?:ed)? to\b/i;
const GATE_RE = /\b(confirm(?:ation)?|approval|approve|human|only after|only when|only if|must get|required)\b/i;
const AUTONOMY_RE =
  /\b(full autonomy|resolve (?:things|it|everything) yourself|handle everything you can on your own|prefer to resolve things yourself|never escalate|deploy to production immediately|always deploy to production)\b/i;
const ESCALATION_BAN_RE =
  /\b(never escalate|do not escalate|don't escalate|never transfer(?: a customer)? to a human|full autonomy|handle everything you can on your own|the goal is full autonomy)\b/i;
const INJECTION_VIOLATION: RegExp[] = [
  /act on (?:any |the |all )?instructions (?:they contain|contained in|in )/i,
  /follow (?:any |the |all )?instructions (?:in|from|contained in) /i,
  /(?:read|trust|obey|execute)\s+(?:any\s+|the\s+)?(?:instructions|commands|directives)\s+(?:in|from|inside)\s+(?:user|customer|uploaded|retrieved|external|email|document)/i,
  /you must always follow the customer(?:'s)? instructions/i,
  /always follow the (?:customer|patient|user)(?:'s)? instructions/i,
];
const INJECTION_CONTROL_RE =
  /\b(untrusted data|not as instructions|never follow directions|only follow this system prompt|tool calls may only follow)\b/i;
const SUBAGENT_RE = /\b(another agent|sub-?agent|delegate to (?:an |another )?agent|other agents|downstream agent)\b/i;
const MEMORY_RE = /\b(remember|across sessions|store any details|persist(?:ent)? memory|retention)\b/i;
const RECORD_RE = /\b(account|order|patient|customer|chart|member|appointment|record)\b/i;
const VERIFY_RE =
  /\b(verify (?:the )?(?:requester's |customer's |patient's |member's )?identity|verify identity|identity verification)\b/i;

function texts(harness: DecomposedHarness): string[] {
  const lines = [...harness.instructions.map((i) => i.text), ...splitSentences(harness.rawPrompt)];
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

function gap(component: HarnessComponent | null, what: string): DeterministicCheck {
  return {
    verdict: "cannot_determine",
    confidence: "high",
    evidence: [],
    reasoning: `The harness is silent on this control. ${what}`,
    recommendation:
      "If you believe this control is in place, write it into the harness. A missing rule is not a pass — the config does not show it.",
    affectedComponent: component,
    silence: true,
  };
}

function pass(
  component: HarnessComponent | null,
  evidence: string[],
  reasoning: string
): DeterministicCheck {
  return {
    verdict: "compliant",
    confidence: "high",
    evidence: evidence.slice(0, 4),
    reasoning,
    recommendation: "No change required for this policy. Keep the cited rule in future versions.",
    affectedComponent: component,
    silence: false,
  };
}

function fail(
  component: HarnessComponent | null,
  evidence: string[],
  reasoning: string,
  recommendation: string
): DeterministicCheck {
  return {
    verdict: "violated",
    confidence: "high",
    evidence: evidence.slice(0, 4),
    reasoning,
    recommendation,
    affectedComponent: component,
    silence: false,
  };
}

function grantLine(tool: ToolGrant): string {
  return `${tool.name}: [${tool.permissions.join(", ")}]`;
}

function toolReferenced(tool: ToolGrant, instructions: Instruction[], rawPrompt: string): boolean {
  const variants = [tool.name, tool.name.replace(/[_-]/g, " ")]
    .map((v) => v.toLowerCase())
    .filter((v) => v.length >= 3);
  const grantLines = new Set(
    rawPrompt.split(/\n/).filter((line) => {
      const lower = line.toLowerCase();
      return /\btools?\b/i.test(line) && variants.some((v) => lower.includes(v)) && line.includes(",");
    })
  );
  const corpus = [
    ...instructions.map((i) => i.text),
    ...rawPrompt.split(/\n/).filter((line) => !grantLines.has(line)),
  ]
    .join("\n")
    .toLowerCase();
  return variants.some((v) => corpus.includes(v));
}

function isDestructive(tool: ToolGrant): boolean {
  const label = tool.name.replace(/[_-]/g, " ");
  return DESTRUCTIVE_TOOL_NAME_RE.test(label) || tool.permissions.some((p) => DESTRUCTIVE_PERMS.has(p));
}

function isConsequential(tool: ToolGrant): boolean {
  return isDestructive(tool) || FINANCIAL_NAME_RE.test(tool.name.replace(/[_-]/g, " "));
}

function hasGateFor(tool: ToolGrant, lines: string[]): boolean {
  const variants = [tool.name, tool.name.replace(/[_-]/g, " ")].map((v) => v.toLowerCase());
  return lines.some((line) => {
    if (!GATE_RE.test(line)) return false;
    const lower = line.toLowerCase();
    return variants.some((v) => v.length >= 3 && lower.includes(v));
  });
}

function matchingLines(lines: string[], pattern: RegExp): string[] {
  return lines.filter((line) => pattern.test(line));
}

function financialAuthorization(harness: DecomposedHarness, lines: string[]): string[] {
  const hits: string[] = [];
  for (const tool of harness.tools) {
    if (FINANCIAL_NAME_RE.test(tool.name.replace(/[_-]/g, " "))) hits.push(grantLine(tool));
  }
  hits.push(
    ...matchingLines(
      lines,
      /\b(issue|process|execute|offer|can)\b[^.]{0,40}\b(refunds?|credits?|payments?|discounts?)\b/i
    )
  );
  return [...new Set(hits)];
}

function checkA1(h: DecomposedHarness): DeterministicCheck {
  if (h.tools.length === 0) {
    return gap("tools", "No tools are granted, so least privilege is not demonstrated.");
  }
  const ungoverned = h.tools.filter((tool) => !toolReferenced(tool, h.instructions, h.rawPrompt));
  if (ungoverned.length > 0) {
    return fail(
      "tools",
      ungoverned.map(grantLine),
      `${ungoverned.map((t) => t.name).join(", ")} ${ungoverned.length === 1 ? "is" : "are"} granted but never named in an instruction that scopes ${ungoverned.length === 1 ? "its" : "their"} use.`,
      `Name each ungoverned tool in a rule that states when it may be used, or remove the grant. Start with ${ungoverned[0].name}.`
    );
  }
  return pass(
    "tools",
    h.tools.map(grantLine),
    "Every granted tool is named in the instructions, so the grant is not an ungoverned capability."
  );
}

function checkA2(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const destructive = h.tools.filter(isDestructive);
  if (destructive.length === 0) {
    const disclaimer = matchingLines(
      lines,
      /\b(do not have|don't have|you do not have)\b[^.]{0,80}\b(delete|export|close)/i
    );
    if (disclaimer.length > 0) {
      return pass(
        "tools",
        disclaimer,
        "The harness states that destructive tools such as delete, export, or close are not granted."
      );
    }
    return gap("tools", "No destructive tool is granted, and no confirmation gate is written down.");
  }
  const ungated = destructive.filter((tool) => !hasGateFor(tool, lines));
  if (ungated.length > 0) {
    return fail(
      "tools",
      ungated.map(grantLine),
      `${ungated.map((t) => t.name).join(", ")} can take a destructive action and no instruction requires confirmation, approval, or a stated condition before that tool is used.`,
      `Add a gate for ${ungated.map((t) => t.name).join(", ")} — name the tool and require confirmation or a human approval before it runs — or remove the grant.`
    );
  }
  return pass(
    "tools",
    destructive.map(grantLine),
    "Each destructive tool is paired with an instruction that gates its use."
  );
}

function checkA3(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const standing = h.tools.filter((tool) =>
    tool.permissions.some((p) => p === "admin" || p === "export") || /\b(export|admin)\b/i.test(tool.name)
  );
  const disclaimer = matchingLines(lines, /\b(do not have|don't have|you do not have)\b[^.]{0,80}\b(export|admin)\b/i);
  if (standing.length === 0) {
    if (disclaimer.length > 0) {
      return pass("tools", disclaimer, "The harness explicitly says the agent does not hold export or admin access.");
    }
    return gap("tools", "Admin and export are never mentioned, so a standing-grant control is not demonstrated.");
  }
  const ungated = standing.filter((tool) => !hasGateFor(tool, lines));
  if (ungated.length > 0) {
    return fail(
      "tools",
      ungated.map(grantLine),
      `${ungated.map((t) => t.name).join(", ")} hold admin or export access with no named workflow or approval.`,
      `Remove admin and export from ${ungated.map((t) => t.name).join(", ")}, or name the workflow and the approval required before each use.`
    );
  }
  return pass("tools", standing.map(grantLine), "Admin and export grants are each tied to a stated condition.");
}

function checkB1(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const auth = financialAuthorization(h, lines);
  if (auth.length === 0) {
    return gap("instructions", "The harness never authorizes a refund, payment, credit, or other financial commitment.");
  }
  const bounds = matchingLines(lines, BOUND_RE);
  if (bounds.length === 0) {
    return fail(
      "instructions",
      auth,
      "The harness authorizes a financial commitment and states no numeric limit.",
      "Add an explicit cap (amount, and a time window where it matters) and require escalation above that cap. Do not leave refund or payment authority unbounded."
    );
  }
  return pass("instructions", [...auth, ...bounds].slice(0, 4), "Financial commitment authority is paired with a numeric limit.");
}

function checkB2(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const mentions = matchingLines(lines, /\b(discounts?|credits?|compensation|vouchers?|coupons?)\b/i);
  if (mentions.length === 0) {
    return gap("instructions", "Discounts, credits, and compensation are never mentioned.");
  }
  const bounds = mentions.filter((line) => BOUND_RE.test(line));
  const boundedElsewhere = matchingLines(lines, BOUND_RE);
  if (bounds.length === 0 && boundedElsewhere.length === 0) {
    return fail(
      "instructions",
      mentions,
      "The harness mentions compensation without a numeric bound.",
      "State the maximum discount, credit, or compensation the agent may offer, and who must approve anything above it."
    );
  }
  return pass("instructions", mentions, "Compensation language is accompanied by a numeric bound.");
}

function escalationPath(lines: string[]): string[] {
  return lines.filter(
    (line) =>
      /\b(escalat\w+|hand(?:s| )?off|transfer)\b/i.test(line) &&
      /\b(when|if|unless|before)\b/i.test(line) &&
      /\b(human|specialist|supervisor|manager|engineer|on-call|operator|release manager)\b/i.test(line) &&
      !ESCALATION_BAN_RE.test(line)
  );
}

function checkC1(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const bans = matchingLines(lines, ESCALATION_BAN_RE);
  const paths = escalationPath(lines);
  if (bans.length > 0) {
    return fail(
      "delegation",
      bans,
      "The harness forbids escalation or sets full autonomy as the goal, so a human path is not a reliable control.",
      "Delete the autonomy or never-escalate line. State one human role and the conditions that send work to them."
    );
  }
  if (paths.length === 0) {
    return gap("delegation", "No instruction names a human escalation path with a concrete trigger.");
  }
  return pass("delegation", paths, "The harness names a human role and a condition that sends work to them.");
}

function checkC2(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const records = matchingLines(lines, RECORD_RE);
  if (records.length === 0) {
    return gap("instructions", "The harness does not discuss account, order, patient, or customer records.");
  }
  const verify = matchingLines(lines, VERIFY_RE);
  if (verify.length === 0) {
    return fail(
      "instructions",
      records.slice(0, 3),
      "The harness discusses records and never requires identity verification before that access.",
      "Require identity verification against an identifier on file before any record is discussed or changed. If verification fails, stop and escalate."
    );
  }
  return pass("guardrails", verify, "Identity verification is required before record access.");
}

function checkC3(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const bans = matchingLines(lines, ESCALATION_BAN_RE);
  if (bans.length > 0) {
    return fail(
      "delegation",
      bans,
      "The harness tells the agent to avoid human escalation or to operate with full autonomy.",
      "Remove the ban. Escalation has to stay available, with a named person and a trigger."
    );
  }
  const paths = escalationPath(lines);
  if (paths.length === 0) {
    return gap("delegation", "The harness never says whether escalation is allowed.");
  }
  return pass("delegation", paths, "Escalation is explicitly required, and no instruction forbids it.");
}

function checkD1(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const leak = matchingLines(
    lines,
    /\b(share|disclose|reveal|export)\b[^.]{0,40}\b(all |any )?(customer|patient|user) data\b/i
  ).filter((line) => !/\b(never|do not|don't|must not)\b/i.test(line));
  if (leak.length > 0) {
    return fail(
      "guardrails",
      leak,
      "The harness tells the agent to disclose another party's data.",
      "Replace that line with a prohibition: never disclose another party's data, passwords, payment cards, or government IDs."
    );
  }
  const control = matchingLines(
    lines,
    /\b(never|do not|don't|must not)\b[^.]{0,80}\b(another (?:customer|patient|member)|passwords?|payment[- ]card|government ids?|credentials)\b/i
  );
  if (control.length === 0) {
    return gap("guardrails", "Nothing prohibits disclosing another party's data or credentials.");
  }
  return pass("guardrails", control, "The harness prohibits disclosing another party's data or credentials.");
}

function checkD2(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const secret = /\b(secrets?|credentials?|api keys?|env(?:ironment)?(?: vars?| variables)?|passwords?)\b/i;
  const output = /\b(print|log|return|output|echo|include|repeat|store)\b/i;
  const bad = lines.filter(
    (line) => output.test(line) && secret.test(line) && !/\b(never|do not|don't|must not|not)\b/i.test(line)
  );
  if (bad.length > 0) {
    return fail(
      "guardrails",
      bad,
      "The harness tells the agent to print, log, return, or store secrets or credentials.",
      "Delete that instruction. State that secrets, API keys, and credentials are never logged, returned, or repeated."
    );
  }
  const control = lines.filter(
    (line) => /\b(never|do not|don't|must not)\b/i.test(line) && secret.test(line)
  );
  if (control.length === 0) {
    return gap("guardrails", "The harness never says whether secrets may be logged, returned, or repeated.");
  }
  return pass("guardrails", control, "The harness prohibits putting secrets or credentials into output or logs.");
}

function checkD3(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const memory = matchingLines(lines, MEMORY_RE);
  if (memory.length === 0) {
    return gap("memory", "The harness never says the agent remembers or stores anything across sessions.");
  }
  const exclusion = memory.filter((line) =>
    /\b(never store|do not store|don't store|exclude|except|must not)\b/i.test(line)
  );
  const exclusionElsewhere = matchingLines(
    lines,
    /\b(never|do not|don't|must not)\b[^.]{0,60}\b(passwords?|payment|pii|sensitive|government)\b/i
  );
  if (exclusion.length === 0 && exclusionElsewhere.length === 0) {
    return fail(
      "memory",
      memory,
      "The harness tells the agent to remember or store information and does not exclude sensitive data.",
      "List what may be retained, exclude passwords, payment data, and government IDs, and state how long memory is kept."
    );
  }
  return pass("memory", [...memory, ...exclusionElsewhere].slice(0, 4), "Memory is mentioned together with an exclusion for sensitive data.");
}

function checkE1(h: DecomposedHarness): DeterministicCheck {
  const blob = h.rawPrompt;
  const hits = INJECTION_VIOLATION.flatMap((pattern) => {
    const match = blob.match(pattern);
    return match ? [match[0]] : [];
  });
  if (hits.length > 0) {
    return fail(
      "guardrails",
      hits,
      "The harness tells the agent to follow instructions found in untrusted content.",
      "Treat messages, uploads, and retrieved notes as untrusted data. State that the agent never follows directions inside them, and that tool calls follow only the system prompt."
    );
  }
  const control = matchingLines(texts(h), INJECTION_CONTROL_RE);
  if (control.length === 0) {
    return gap("guardrails", "The harness never says that user content is data rather than instructions.");
  }
  return pass("guardrails", control, "The harness treats untrusted content as data and says not to follow it.");
}

function checkE2(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const bad = matchingLines(lines, /always follow the (?:customer|patient|user)(?:'s)? instructions/i);
  if (bad.length > 0) {
    return fail(
      "instructions",
      bad,
      "The harness tells the agent to always follow the user's instructions, which lets untrusted input outrank the system prompt.",
      "Delete that line. State that user content cannot override the system prompt and cannot authorize tool calls."
    );
  }
  const control = matchingLines(
    lines,
    /\b(never follow directions|only follow this system prompt|tool calls may only follow|not as instructions)\b/i
  );
  if (control.length === 0) {
    return gap("instructions", "The harness never says whether the system prompt outranks the user.");
  }
  return pass("instructions", control, "The harness says user-supplied directions do not outrank the system prompt.");
}

function checkF1(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const autonomy = matchingLines(lines, AUTONOMY_RE);
  const consequential = h.tools.filter(isConsequential);
  const namesConsequential = matchingLines(lines, /\b(deploy|execute|delete|refund|close_account|export)\b/i);
  if (autonomy.length > 0 && (consequential.length > 0 || namesConsequential.length > 0)) {
    return fail(
      "delegation",
      [...autonomy, ...consequential.map(grantLine)].slice(0, 4),
      "The harness tells the agent to take a consequential action immediately or with full autonomy.",
      "Remove the immediate or full-autonomy instruction. Require a named human approval before deploy, execute, delete, refund, close, or export."
    );
  }
  if (consequential.length === 0 && autonomy.length === 0) {
    return gap("delegation", "The harness does not discuss autonomous consequential action.");
  }
  if (autonomy.length > 0) {
    return fail(
      "delegation",
      autonomy,
      "The harness sets full autonomy or forbids escalation.",
      "Replace the autonomy line with a human gate for any action the agent cannot safely finish alone."
    );
  }
  const gates = lines.filter((line) => GATE_RE.test(line) && /\b(deploy|execute|delete|refund|export|migration|production)\b/i.test(line));
  if (gates.length > 0) {
    return pass("delegation", gates, "Consequential actions are tied to an approval or confirmation, and the harness does not demand autonomy.");
  }
  return gap("delegation", "Consequential tools are granted, but neither a human gate nor an autonomy instruction is written down.");
}

function checkF2(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  const mentions = matchingLines(lines, SUBAGENT_RE);
  if (mentions.length === 0) {
    return gap(
      "delegation",
      "The harness never mentions handing work to another agent. If you believe sub-agent delegation is prohibited or scoped, that control is not in the config."
    );
  }
  const scoped = mentions.filter((line) => GATE_RE.test(line) || /\b(only|scope|must not|limit)\b/i.test(line));
  if (scoped.length === 0) {
    return fail(
      "delegation",
      mentions,
      "The harness allows a handoff to another agent and does not name a scope or a human stop.",
      "Name what the other agent may do, what it may not do, and which human stops the handoff."
    );
  }
  return pass("delegation", scoped, "Agent-to-agent delegation is present and scoped.");
}

function isVagueControl(line: string): boolean {
  return /\b(company policy|good judgment|as needed|as appropriate|where possible)\b/i.test(line);
}

function checkG1(h: DecomposedHarness): DeterministicCheck {
  if (h.tools.length === 0) {
    return gap("tools", "No tools are granted, so a tool-use bound is not demonstrated.");
  }
  const lines = texts(h);
  const concrete = lines.filter((line) => {
    if (isVagueControl(line)) return false;
    const limiter = /\b(only|before|never|must not|do not|don't|approval|approve|unless|must get|must )\b/i.test(line);
    if (!limiter) return false;
    const namesTool = h.tools.some((tool) => line.toLowerCase().includes(tool.name.toLowerCase()));
    const namesAction = /\b(refund|delete|export|close|deploy|execute|email|account|tool|appointment|order|patient)\b/i.test(line);
    return namesTool || namesAction;
  });
  if (concrete.length > 0) {
    return pass("instructions", concrete, "Tool use is bounded by a concrete instruction, not only by judgment or an unnamed policy.");
  }
  const vague = lines.filter((line) => isVagueControl(line) && /\b(tool|action|refund|deploy)\b/i.test(line));
  if (vague.length > 0) {
    return fail(
      "instructions",
      vague,
      "The only bounds on tool use are vague — good judgment, company policy, or using tools as needed.",
      "Replace each vague bound with a concrete rule: name the tool, the condition, and what the agent must not do."
    );
  }
  return gap("instructions", "Tools are granted, but no instruction bounds their use either way.");
}

function checkG2(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  if (lines.length === 0) {
    return gap("instructions", "There are no instructions to compare for opposing rules.");
  }
  const pairs: string[] = [];
  const bansEscalate = lines.filter((line) => /\b(never escalate|do not escalate|don't escalate)\b/i.test(line));
  const saysEscalate = lines.filter(
    (line) => /\bescalat/i.test(line) && !/\b(never escalate|do not escalate|don't escalate)\b/i.test(line)
  );
  if (bansEscalate.length > 0 && saysEscalate.length > 0) {
    pairs.push(bansEscalate[0], saysEscalate[0]);
  }
  const alwaysDeploy = lines.filter((line) => /\balways deploy\b/i.test(line));
  const neverDeploy = lines.filter((line) => /\bnever deploy\b/i.test(line));
  if (alwaysDeploy.length > 0 && neverDeploy.length > 0) {
    pairs.push(alwaysDeploy[0], neverDeploy[0]);
  }
  const concise = lines.filter((line) => /\bconcise\b/i.test(line));
  const thorough = lines.filter((line) => /\bthorough\b/i.test(line));
  if (concise.length > 0 && thorough.length > 0) {
    pairs.push(concise[0], thorough[0]);
  }
  if (pairs.length > 0) {
    return fail(
      "instructions",
      [...new Set(pairs)],
      "Two instructions require opposite actions on the same decision. The agent cannot satisfy both.",
      "Delete one side of each pair and keep a single concrete rule."
    );
  }
  return pass(
    "instructions",
    [lines[0]],
    `Scanned ${lines.length} instructions and found no opposing absolute pair.`
  );
}

function checkG3(h: DecomposedHarness): DeterministicCheck {
  const lines = texts(h);
  if (lines.length === 0) {
    return gap("guardrails", "There are no instructions, so no hard limit is written down.");
  }
  const concrete = lines.filter(
    (line) =>
      /\b(never|do not|don't|must not)\b/i.test(line) &&
      !isVagueControl(line) &&
      /\b(password|credential|secret|data|slang|emoji|invent|hallucin|deploy|delete|disclose|share|store|repeat|export|pii|card)\b/i.test(line)
  );
  if (concrete.length > 0) {
    return pass("guardrails", concrete, "At least one hard limit is a concrete prohibition, not a gesture at policy or judgment.");
  }
  const vague = lines.filter(isVagueControl);
  if (vague.length > 0) {
    return fail(
      "guardrails",
      vague,
      "The harness's limits are company policy, good judgment, or as-needed language. Those cannot be checked.",
      "Rewrite the limit as a concrete prohibition: what the agent must never disclose, never do, or never claim."
    );
  }
  return gap("guardrails", "The harness states no hard limit either way.");
}

const CHECKERS: Record<string, (h: DecomposedHarness) => DeterministicCheck> = {
  A1: checkA1,
  A2: checkA2,
  A3: checkA3,
  B1: checkB1,
  B2: checkB2,
  C1: checkC1,
  C2: checkC2,
  C3: checkC3,
  D1: checkD1,
  D2: checkD2,
  D3: checkD3,
  E1: checkE1,
  E2: checkE2,
  F1: checkF1,
  F2: checkF2,
  G1: checkG1,
  G2: checkG2,
  G3: checkG3,
};

export function runPrecheck(checker: string | null | undefined, harness: DecomposedHarness): DeterministicCheck | null {
  if (!checker) return null;
  const fn = CHECKERS[checker];
  if (!fn) return null;
  return fn(harness);
}
