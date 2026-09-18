/** Shared size limits for analysis input. */

/** Max pasted system prompt (characters). ~2M chars ≈ 500k tokens of text. */
export const MAX_PROMPT_CHARS = 2_000_000;

/** Max characters sent to a single model call so large prompts still complete. */
export const MODEL_INPUT_CHAR_LIMIT = 280_000;

export function clipForModel(text: string): string {
  if (text.length <= MODEL_INPUT_CHAR_LIMIT) return text;
  const omitted = text.length - MODEL_INPUT_CHAR_LIMIT;
  return `${text.slice(0, MODEL_INPUT_CHAR_LIMIT)}\n\n[truncated ${omitted} characters to fit the model context]`;
}
