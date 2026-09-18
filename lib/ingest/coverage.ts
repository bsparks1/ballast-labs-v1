import type { HarnessComponent } from "@/lib/types";
import { COMPONENT_LABELS } from "@/lib/types";
import type { AgentLanguage, ComponentCoverage, CoverageReport, CoverageStatus, HarnessModel } from "./types";

function statusFor(count: number, partialWhen: boolean, emptyStatus: CoverageStatus): CoverageStatus {
  if (count <= 0) return emptyStatus;
  if (partialWhen) return "partial";
  return "extracted";
}

export function buildCoverage(model: HarnessModel, filesScanned: number, filesRead: number): CoverageReport {
  const components: ComponentCoverage[] = [];

  const promptSources = [...new Set(model.instructions.map((p) => p.source))];
  components.push({
    component: "instructions",
    status: statusFor(model.instructions.length, model.instructions.length === 1 && model.instructions[0].text.length < 120, "not_found"),
    detail:
      model.instructions.length === 0
        ? "No prompt files or prompt-like assignments matched known conventions."
        : `${model.instructions.length} prompt${model.instructions.length === 1 ? "" : "s"} extracted from ${promptSources.join(", ")}.`,
    sources: promptSources,
  });

  const toolSources = [...new Set(model.tools.map((t) => t.source))];
  const toolsMissingDesc = model.tools.filter((t) => !t.description).length;
  components.push({
    component: "tools",
    status: statusFor(model.tools.length, toolsMissingDesc > 0 && toolsMissingDesc === model.tools.length, "not_found"),
    detail:
      model.tools.length === 0
        ? "No @tool / tool() definitions or tools.py/ts cluster found."
        : `${model.tools.length} tool${model.tools.length === 1 ? "" : "s"} extracted${toolSources.length ? ` from ${toolSources.join(", ")}` : ""}.`,
    sources: toolSources,
  });

  const knowledgeSources = [...new Set(model.knowledge.map((k) => k.source))];
  const hasVector = model.knowledge.some((k) => k.kind === "vectorstore" || k.kind === "retriever");
  const hasEnv = model.knowledge.some((k) => k.kind === "env" || k.kind === "integration");
  components.push({
    component: "knowledge",
    status:
      model.knowledge.length === 0
        ? "not_found"
        : hasVector && hasEnv
          ? "extracted"
          : "partial",
    detail:
      model.knowledge.length === 0
        ? "No .env.example keys or retriever/vectorstore setup found."
        : `${model.knowledge.length} integration/knowledge source${model.knowledge.length === 1 ? "" : "s"}: ${model.knowledge.map((k) => k.name).join(", ")}.`,
    sources: knowledgeSources,
  });

  const memory = model.memory;
  const memoryExtracted = Boolean(memory?.checkpointer || memory?.store);
  const memoryPartial = Boolean(memory && !memoryExtracted && (memory.model || memory.details.length > 0));
  components.push({
    component: "memory",
    status: memoryExtracted ? "extracted" : memoryPartial ? "partial" : "not_found",
    detail: memory
      ? memory.details.join("; ")
      : "No checkpointer, store, or model-config settings found.",
    sources: memory ? [memory.source] : [],
  });

  const guardSources = [...new Set(model.guardrails.map((g) => g.source))];
  components.push({
    component: "guardrails",
    status: statusFor(model.guardrails.length, model.guardrails.length > 0 && model.guardrails.every((g) => g.text.length < 80), "not_found"),
    detail:
      model.guardrails.length === 0
        ? "No dedicated guardrail statements were isolated from prompts or config."
        : `${model.guardrails.length} guardrail fragment${model.guardrails.length === 1 ? "" : "s"} pulled from extracted prompts.`,
    sources: guardSources,
  });

  const graphs = model.delegation?.graphs ?? [];
  components.push({
    component: "delegation",
    status:
      graphs.length >= 2
        ? "extracted"
        : graphs.length === 1 || model.delegation
          ? "partial"
          : "not_found",
    detail: model.delegation?.summary ?? "No langgraph.json graphs or supervisor/handoff structure found.",
    sources: model.delegation ? [model.delegation.source] : [],
  });

  return {
    adapter: model.metadata.adapter,
    framework: model.metadata.framework,
    language: model.metadata.language,
    components,
    summary: summarizeCoverage(components, model.metadata.warnings),
    warnings: model.metadata.warnings,
    filesScanned,
    filesRead,
  };
}

export function summarizeCoverage(components: ComponentCoverage[], warnings: string[] = []): string {
  const extracted = components.filter((c) => c.status === "extracted").map((c) => COMPONENT_LABELS[c.component]);
  const partial = components.filter((c) => c.status === "partial").map((c) => COMPONENT_LABELS[c.component]);
  const missing = components.filter((c) => c.status === "not_found").map((c) => COMPONENT_LABELS[c.component]);
  const na = components.filter((c) => c.status === "not_applicable").map((c) => COMPONENT_LABELS[c.component]);

  const parts: string[] = [];
  if (extracted.length > 0) {
    parts.push(`Ballast extracted ${joinList(extracted)} from your repo`);
  } else {
    parts.push("Ballast could not automatically extract a complete harness from this repo");
  }
  if (partial.length > 0) {
    parts.push(`${joinList(partial)} ${partial.length === 1 ? "was" : "were"} only partially recovered`);
  }
  if (missing.length > 0) {
    parts.push(
      `${joinList(missing)} ${missing.length === 1 ? "wasn't" : "weren't"} found automatically — add ${missing.length === 1 ? "it" : "them"} manually or paste the relevant config`
    );
  }
  if (na.length > 0) {
    parts.push(`${joinList(na)} ${na.length === 1 ? "looks" : "look"} not applicable for this agent`);
  }
  let summary = `${parts.join(". ")}.`;
  if (warnings.length > 0) summary += ` ${warnings[0]}`;
  return summary;
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function coverageHeadline(coverage: CoverageReport): { extracted: HarnessComponent[]; missing: HarnessComponent[] } {
  return {
    extracted: coverage.components.filter((c) => c.status === "extracted" || c.status === "partial").map((c) => c.component),
    missing: coverage.components.filter((c) => c.status === "not_found").map((c) => c.component),
  };
}

export function emptyModel(language: AgentLanguage, adapter: string, framework: string, sourceLabel: string, warnings: string[] = []): HarnessModel {
  return {
    instructions: [],
    tools: [],
    knowledge: [],
    memory: null,
    guardrails: [],
    delegation: null,
    metadata: {
      framework,
      adapter,
      language,
      dependencies: [],
      sourceKind: "memory",
      sourceLabel,
      warnings,
    },
  };
}
