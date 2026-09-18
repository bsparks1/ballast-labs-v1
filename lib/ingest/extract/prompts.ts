import { looksLikePromptText, isPromptLikeName, extractNamedStringAssignments, extractCallStringArgs, extractFromMessagesSystemStrings, uniqueTexts } from "./text";
import type { ExtractedPrompt } from "../types";

const GUARDRAIL_HINT =
  /\b(never|must not|do not|don't|refuse|decline|under no circumstances|not allowed|forbidden|prohibited|off[- ]limits)\b/i;
const GUARDRAIL_TOPIC =
  /\b(pii|personal (?:data|information)|password|credential|secret|api key|jailbreak|prompt injection|harmful|unsafe|confidential)\b/i;

export function extractPromptsFromSource(path: string, source: string): ExtractedPrompt[] {
  const prompts: ExtractedPrompt[] = [];
  const seen = new Set<string>();
  const add = (name: string, text: string) => {
    const trimmed = text.trim();
    if (!looksLikePromptText(trimmed)) return;
    const key = trimmed.replace(/\s+/g, " ").slice(0, 200).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    prompts.push({ name, text: trimmed, source: path });
  };

  for (const assignment of extractNamedStringAssignments(source)) {
    if (isPromptLikeName(assignment.name) || looksLikePromptText(assignment.text)) {
      if (isPromptLikeName(assignment.name) || assignment.text.length >= 80) {
        add(assignment.name, assignment.text);
      }
    }
  }

  for (const text of extractCallStringArgs(source, "SystemMessage")) add("SystemMessage", text);
  for (const text of extractCallStringArgs(source, "HumanMessage")) {
    if (looksLikePromptText(text) && text.length >= 80) add("HumanMessage", text);
  }
  for (const text of extractCallStringArgs(source, "from_template")) add("from_template", text);
  for (const text of extractCallStringArgs(source, "fromTemplate")) add("fromTemplate", text);
  for (const text of extractFromMessagesSystemStrings(source)) add("ChatPromptTemplate", text);

  return prompts;
}

export function splitGuardrailPrompts(prompts: ExtractedPrompt[]): {
  instructions: ExtractedPrompt[];
  guardrails: ExtractedPrompt[];
} {
  const instructions: ExtractedPrompt[] = [];
  const guardrails: ExtractedPrompt[] = [];
  for (const prompt of prompts) {
    const sentences = prompt.text.split(/(?<=[.!?;])\s+/);
    const hits = sentences.filter((s) => GUARDRAIL_HINT.test(s) && GUARDRAIL_TOPIC.test(s));
    if (hits.length >= 2 || (hits.length >= 1 && /guardrail/i.test(prompt.name))) {
      guardrails.push({
        ...prompt,
        name: `${prompt.name} (guardrails)`,
        text: uniqueTexts(hits).join("\n"),
      });
    }
    instructions.push(prompt);
  }
  return { instructions, guardrails };
}
