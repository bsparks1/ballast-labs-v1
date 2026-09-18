/**
 * Adapter registry. Adding CrewAI / AutoGen / OpenAI Agents SDK later is
 * registerAdapter(newAdapter) — detectFramework and the rest of the app
 * stay unchanged.
 */

import { genericAdapter } from "./adapters/generic";
import { langGraphAdapter } from "./adapters/langgraph";
import type { FrameworkAdapter, RepoFileAccess } from "./types";

const adapters: FrameworkAdapter[] = [];

export function registerAdapter(adapter: FrameworkAdapter): void {
  if (adapters.some((a) => a.id === adapter.id)) return;
  adapters.push(adapter);
}

export function listAdapters(): FrameworkAdapter[] {
  return [...adapters];
}

export function getAdapter(id: string): FrameworkAdapter | undefined {
  return adapters.find((a) => a.id === id);
}

/** Confidence below this falls through to GenericAdapter. */
export const MATCH_THRESHOLD = 0.5;

export async function detectFramework(
  files: RepoFileAccess
): Promise<{ adapter: FrameworkAdapter; score: number; scores: { id: string; score: number }[] }> {
  const scores: { id: string; score: number; adapter: FrameworkAdapter }[] = [];
  for (const adapter of adapters) {
    if (adapter.id === "generic") continue;
    const score = await adapter.detect(files);
    scores.push({ id: adapter.id, score, adapter });
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (best && best.score >= MATCH_THRESHOLD) {
    return { adapter: best.adapter, score: best.score, scores: scores.map(({ id, score }) => ({ id, score })) };
  }
  return {
    adapter: getAdapter("generic") ?? genericAdapter,
    score: best?.score ?? 0,
    scores: scores.map(({ id, score }) => ({ id, score })),
  };
}

registerAdapter(langGraphAdapter);
registerAdapter(genericAdapter);
