import { extractPromptsFromSource, splitGuardrailPrompts } from "../extract/prompts";
import { extractPythonTools, extractTypeScriptTools, mergeTools } from "../extract/tools";
import { extractRetrievers, mergeKnowledge, parseEnvExample } from "../extract/knowledge";
import { extractMemorySettings, mergeMemory } from "../extract/memory";
import { buildCoverage, emptyModel } from "../coverage";
import { notebookToSource } from "./notebook";
import {
  SOURCE_RE,
  indexFiles,
  isPythonPath,
  isTypeScriptPath,
  pickCandidateFiles,
  readMany,
} from "../files";
import type { AdapterExtractResult, FrameworkAdapter, IngestionSource, RepoFileAccess } from "../types";

/**
 * Best-effort fallback when no framework adapter matches.
 * Reports partial/manual coverage rather than pretending the harness is complete.
 */
export const genericAdapter: FrameworkAdapter = {
  id: "generic",
  name: "Generic (convention scan)",

  async detect(): Promise<number> {
    return 0.05;
  },

  async extract(files: RepoFileAccess, source: IngestionSource): Promise<AdapterExtractResult> {
    const listed = await files.listFiles();
    const index = indexFiles(listed, source.subdir);
    const warnings: string[] = [...(source.warnings ?? [])];
    if (index.likelyMonorepo || index.scoped.length >= 800) {
      warnings.push(
        "No agent-framework manifest found in a large tree. This scan is shallow on purpose — paste specific files or point at the agent subdirectory."
      );
    }

    const candidates = pickCandidateFiles(index.scoped, [], index.likelyMonorepo);
    const loaded = await readMany(files, candidates);
    const model = emptyModel("unknown", "generic", "Unknown / homegrown", source.label, warnings);
    model.metadata.sourceKind = source.kind;

    const prompts = [];
    const toolGroups = [];
    const knowledgeGroups = [];
    const memoryParts = [];
    let py = 0;
    let ts = 0;

    for (const [path, raw] of loaded) {
      const contents = path.endsWith(".ipynb") ? notebookToSource(raw) : raw;
      if (isPythonPath(path)) py += 1;
      if (isTypeScriptPath(path)) ts += 1;
      if (/\.env/i.test(path)) knowledgeGroups.push(parseEnvExample(path, contents));
      knowledgeGroups.push(extractRetrievers(path, contents));
      memoryParts.push(extractMemorySettings(path, contents));
      if (!SOURCE_RE.test(path) && !/\.env/i.test(path)) continue;
      prompts.push(...extractPromptsFromSource(path, contents));
      if (isPythonPath(path)) toolGroups.push(extractPythonTools(path, contents));
      if (isTypeScriptPath(path)) toolGroups.push(extractTypeScriptTools(path, contents));
    }

    model.metadata.language = py > 0 && ts > 0 ? "mixed" : py > 0 ? "python" : ts > 0 ? "typescript" : "unknown";
    const split = splitGuardrailPrompts(prompts);
    model.instructions = split.instructions;
    model.guardrails = split.guardrails;
    model.tools = mergeTools(toolGroups);
    model.knowledge = mergeKnowledge(knowledgeGroups);
    model.memory = mergeMemory(memoryParts);

    if (model.instructions.length === 0 && model.tools.length === 0) {
      warnings.push("Almost nothing matched prompt or tool conventions. Paste the system prompt to continue.");
      model.metadata.warnings = warnings;
    }

    return { model, coverage: buildCoverage(model, index.scoped.length, loaded.size) };
  },
};
