/**
 * Shared model-call plumbing for all model-graded analysis passes.
 * Server-side only.
 *
 * Design rules (learned from the "0 conflicts, score 95" failure):
 *   - Never swallow errors. Every failure THROWS so the engine can record
 *     passStatus: "error" instead of silently scoring the pass as clean.
 *   - Log every raw model response server-side so "is the call actually
 *     running and returning 200s?" is answerable from the logs.
 */

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export type ModelCaller = (passName: string, system: string, user: string) => Promise<string>;

export function isModelAvailable(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return client;
}

/**
 * Make one model call and return the raw text. Throws on any API failure.
 * `passName` is used to tag the server-side log lines.
 */
export async function callModel(passName: string, system: string, user: string): Promise<string> {
  if (!isModelAvailable()) {
    throw new Error("ANTHROPIC_API_KEY is not set — model-graded pass cannot run");
  }
  const started = Date.now();
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const httpOk = response.type === "message";
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    // Raw response logged server-side, per pass, so plumbing is auditable.
    console.log(
      `[ballast:model] pass=${passName} status=${httpOk ? 200 : "unknown"} model=${MODEL} id=${response.id} stop=${response.stop_reason} ms=${Date.now() - started} raw=${JSON.stringify(raw)}`
    );
    return raw;
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err ? (err as { status: unknown }).status : undefined;
    console.error(
      `[ballast:model] pass=${passName} FAILED status=${status ?? "n/a"} ms=${Date.now() - started}`,
      err
    );
    throw err;
  }
}

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

/**
 * Parse a model response that must contain a JSON object with an array field.
 * Throws (rather than returning []) when the response is unparseable —
 * "the model returned garbage" is an error, not an empty result.
 */
export function parseJsonArrayField(passName: string, raw: string, field: string): unknown[] {
  const parsed = extractJson(raw);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`[${passName}] model response was not parseable JSON`);
  }
  const list = (parsed as Record<string, unknown>)[field];
  if (!Array.isArray(list)) {
    throw new Error(`[${passName}] model response JSON missing "${field}" array`);
  }
  return list;
}

export function asSeverity(v: unknown, fallback: "critical" | "warning" | "info"): "critical" | "warning" | "info" {
  return v === "critical" || v === "warning" || v === "info" ? v : fallback;
}

export function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
