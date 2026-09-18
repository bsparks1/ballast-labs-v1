/**
 * Turn a HarnessModel into the prompt + config the existing analysis engine
 * already understands. Repo ingestion is a richer front door — it does not
 * replace or fork the engine.
 */

import { MAX_PROMPT_CHARS } from "@/lib/analysis/limits";
import type { HarnessReport } from "@/lib/types";
import { BALLAST_CONFIG_KEY, type AssembledHarness, type BallastConfigMeta, type CoverageReport, type HarnessModel, type IngestionSource } from "./types";

function section(title: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  return `## ${title}\n${trimmed}\n`;
}

export function assemblePrompt(model: HarnessModel, supplemental = ""): string {
  const extra = supplemental.trim();
  // Never invent a prompt. An empty extraction must not be turned into
  // Ballast-authored text that the engine would then score as a harness.
  if (model.instructions.length === 0 && !extra) return "";

  const parts: string[] = [];

  for (const prompt of model.instructions) {
    parts.push(`## Instructions (${prompt.name} — ${prompt.source})\n${prompt.text}`);
  }

  if (model.guardrails.length > 0) {
    parts.push(
      section(
        "Guardrails",
        model.guardrails.map((g) => `- ${g.text}`).join("\n")
      )
    );
  }

  if (model.knowledge.length > 0) {
    parts.push(
      section(
        "Knowledge sources",
        model.knowledge
          .map((k) => `- ${k.name} (${k.kind}${k.detail ? `: ${k.detail}` : ""}) from ${k.source}`)
          .join("\n")
      )
    );
  }

  if (model.memory) {
    const mem = model.memory;
    const lines = [
      mem.checkpointer ? `The agent persists state with ${mem.checkpointer} as checkpointer.` : "",
      mem.store ? `Long-term store: ${mem.store}.` : "",
      mem.model ? `Model: ${mem.model}.` : "",
      mem.temperature != null ? `Temperature: ${mem.temperature}.` : "",
      mem.maxTokens != null ? `Max tokens: ${mem.maxTokens}.` : "",
      "Conversation history is retained across turns when a checkpointer is configured.",
    ].filter(Boolean);
    parts.push(section("Memory", lines.join("\n")));
  }

  if (model.delegation) {
    const names = model.delegation.graphs.map((g) => g.name);
    const extra =
      names.length > 1
        ? `The supervisor (or routing graph) delegates to specialist graphs: ${names.join(", ")}.`
        : `Entry graph: ${names[0] ?? model.delegation.summary}.`;
    parts.push(section("Delegation", `${model.delegation.summary}\n${extra}`));
  }

  // Extracted tools stay in structured config only. Restating names or
  // descriptions here would look like instruction-level governance to the
  // tool-mismatch pass.
  if (extra) parts.push(`## Manual additions\n${extra}`);

  let prompt = parts.filter(Boolean).join("\n\n").trim();
  if (prompt.length > MAX_PROMPT_CHARS) {
    prompt = `${prompt.slice(0, MAX_PROMPT_CHARS)}\n\n[truncated after repo assembly]`;
  }
  return prompt;
}

export function assembleConfig(model: HarnessModel, source: IngestionSource, coverage: CoverageReport): string {
  const ballast: BallastConfigMeta = {
    source,
    adapter: model.metadata.adapter,
    framework: model.metadata.framework,
    coverage,
  };
  return JSON.stringify(
    {
      tools: model.tools.map((t) => ({
        name: t.name,
        permissions: t.permissions,
        description: t.description,
        source: t.source,
      })),
      knowledge: model.knowledge,
      memory: model.memory,
      delegation: model.delegation,
      metadata: {
        framework: model.metadata.framework,
        adapter: model.metadata.adapter,
        language: model.metadata.language,
        pythonVersion: model.metadata.pythonVersion,
        dependencies: model.metadata.dependencies,
      },
      [BALLAST_CONFIG_KEY]: ballast,
    },
    null,
    2
  );
}

export function assembleHarness(model: HarnessModel, source: IngestionSource, coverage: CoverageReport, supplemental = ""): AssembledHarness {
  return {
    prompt: assemblePrompt(model, supplemental),
    config: assembleConfig(model, source, coverage),
    model,
    coverage,
  };
}

export function parseBallastMeta(config?: string): BallastConfigMeta | null {
  if (!config || !config.trim()) return null;
  try {
    const parsed = JSON.parse(config) as Record<string, unknown>;
    const raw = parsed[BALLAST_CONFIG_KEY];
    if (!raw || typeof raw !== "object") return null;
    const rec = raw as Partial<BallastConfigMeta>;
    if (!rec.coverage || !rec.source || !rec.adapter) return null;
    return rec as BallastConfigMeta;
  } catch {
    return null;
  }
}

export function attachIngestionMeta(report: HarnessReport, config?: string): HarnessReport {
  const ballast = parseBallastMeta(config);
  if (!ballast) return report;
  return {
    ...report,
    meta: {
      ...report.meta,
      ingestion: {
        source: ballast.source,
        adapter: ballast.adapter,
        framework: ballast.framework,
        coverage: ballast.coverage,
        extractedAt: report.meta.createdAt,
      },
    },
  };
}
