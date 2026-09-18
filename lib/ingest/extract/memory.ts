import type { MemorySettings } from "../types";

const CHECKPOINTER_RE =
  /\b(MemorySaver|AsyncPostgresSaver|PostgresSaver|SqliteSaver|InMemorySaver|InMemoryStore|AsyncSqliteSaver|RedisSaver)\b/g;

const CHECKPOINTER_ASSIGN = /\bcheckpointer\s*=\s*([A-Za-z_][A-Za-z0-9_]*)/;
const STORE_ASSIGN = /\bstore\s*=\s*([A-Za-z_][A-Za-z0-9_]*)/;

const MODEL_RES: { field: keyof Pick<MemorySettings, "model" | "temperature" | "maxTokens" | "retries">; re: RegExp; parse: (v: string) => string | number }[] = [
  { field: "model", re: /\b(?:model(?:_name)?|llm)\s*[:=]\s*["'`]([A-Za-z0-9./:_-]+)["'`]/, parse: (v) => v },
  { field: "temperature", re: /\btemperature\s*[:=]\s*([0-9]*\.?[0-9]+)/, parse: (v) => Number(v) },
  { field: "maxTokens", re: /\b(?:max_tokens|maxTokens|max_output_tokens)\s*[:=]\s*([0-9]+)/, parse: (v) => Number(v) },
  { field: "retries", re: /\b(?:max_retries|maxRetries|retries)\s*[:=]\s*([0-9]+)/, parse: (v) => Number(v) },
];

export function extractMemorySettings(path: string, source: string): MemorySettings | null {
  const details: string[] = [];
  const checkpointers = [...source.matchAll(CHECKPOINTER_RE)].map((m) => m[1]);
  const uniqueCheck = [...new Set(checkpointers)];
  const checkAssign = source.match(CHECKPOINTER_ASSIGN)?.[1];
  const storeAssign = source.match(STORE_ASSIGN)?.[1];

  const settings: MemorySettings = {
    source: path,
    details,
  };

  if (uniqueCheck.length > 0) {
    settings.checkpointer = uniqueCheck[0];
    details.push(`checkpointer class ${uniqueCheck.join(", ")}`);
  } else if (checkAssign) {
    settings.checkpointer = checkAssign;
    details.push(`checkpointer=${checkAssign}`);
  }
  if (storeAssign) {
    settings.store = storeAssign;
    details.push(`store=${storeAssign}`);
  }

  for (const { field, re, parse } of MODEL_RES) {
    const match = source.match(re);
    if (!match) continue;
    const value = parse(match[1]);
    if (field === "model" && typeof value === "string") {
      settings.model = value;
      details.push(`model=${value}`);
    } else if (field === "temperature" && typeof value === "number" && !Number.isNaN(value)) {
      settings.temperature = value;
      details.push(`temperature=${value}`);
    } else if (field === "maxTokens" && typeof value === "number") {
      settings.maxTokens = value;
      details.push(`maxTokens=${value}`);
    } else if (field === "retries" && typeof value === "number") {
      settings.retries = value;
      details.push(`retries=${value}`);
    }
  }

  if (details.length === 0) return null;
  return settings;
}

export function mergeMemory(settings: Array<MemorySettings | null>): MemorySettings | null {
  const present = settings.filter((s): s is MemorySettings => s != null);
  if (present.length === 0) return null;
  const merged: MemorySettings = { source: present[0].source, details: [] };
  const detailSet = new Set<string>();
  for (const item of present) {
    merged.checkpointer ??= item.checkpointer;
    merged.store ??= item.store;
    merged.model ??= item.model;
    merged.temperature ??= item.temperature;
    merged.maxTokens ??= item.maxTokens;
    merged.retries ??= item.retries;
    if (!merged.checkpointer && item.checkpointer) merged.source = item.source;
    for (const d of item.details) detailSet.add(d);
  }
  merged.details = [...detailSet];
  return merged;
}
