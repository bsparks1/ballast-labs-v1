import { notebookToSource } from "./notebook";
import { extractPromptsFromSource, splitGuardrailPrompts } from "../extract/prompts";
import { extractBoundToolNames, extractPythonTools, extractTypeScriptTools, mergeTools } from "../extract/tools";
import { extractRetrievers, mergeKnowledge, parseEnvExample } from "../extract/knowledge";
import { extractMemorySettings, mergeMemory } from "../extract/memory";
import { parseLangGraphManifest, pickManifest, type LangGraphManifest } from "../extract/manifest";
import { buildCoverage, emptyModel } from "../coverage";
import {
  AGENT_ENTRY_RE,
  CONVENTION_FILE_RE,
  PROMPT_FILE_RE,
  SOURCE_RE,
  TOOL_DIR_RE,
  TOOL_FILE_RE,
  indexFiles,
  isPythonPath,
  isTypeScriptPath,
  pickCandidateFiles,
  readMany,
} from "../files";
import type {
  AdapterExtractResult,
  AgentLanguage,
  ExtractedPrompt,
  ExtractedTool,
  FrameworkAdapter,
  GraphEntry,
  HarnessModel,
  IngestionSource,
  KnowledgeSource,
  MemorySettings,
  RepoFileAccess,
} from "../types";

const LANGGRAPH_DEP_RE = /\blanggraph\b/i;
const LANGCHAIN_DEP_RE = /\blangchain\b/i;
const LANGGRAPH_JS_RE = /@langchain\/langgraph/;
const LANGCHAIN_JS_RE = /@langchain\/(core|openai|community|langgraph)/;
const IMPORT_RE = /(?:from\s+['"]langgraph|import\s+langgraph|from\s+langchain|import\s+langchain|@langchain\/langgraph|create_react_agent|createReactAgent|StateGraph)/;

function detectLanguage(paths: string[]): AgentLanguage {
  let py = 0;
  let ts = 0;
  for (const path of paths) {
    if (isPythonPath(path)) py += 1;
    else if (isTypeScriptPath(path)) ts += 1;
  }
  if (py > 0 && ts > 0) return "mixed";
  if (py > 0) return "python";
  if (ts > 0) return "typescript";
  return "unknown";
}

function readSource(path: string, contents: string): string {
  if (path.endsWith(".ipynb")) return notebookToSource(contents);
  return contents;
}

async function loadManifests(files: RepoFileAccess, paths: string[]): Promise<LangGraphManifest[]> {
  const manifests: LangGraphManifest[] = [];
  for (const path of paths.filter((p) => /(^|\/)langgraph\.json$/i.test(p))) {
    const raw = await files.readFile(path);
    if (!raw) continue;
    const parsed = parseLangGraphManifest(path, raw);
    if (parsed) manifests.push(parsed);
  }
  return manifests;
}

export const langGraphAdapter: FrameworkAdapter = {
  id: "langgraph",
  name: "LangChain / LangGraph",

  async detect(files: RepoFileAccess): Promise<number> {
    const listed = await files.listFiles();
    if (listed.some((p) => /(^|\/)langgraph\.json$/i.test(p))) return 1;
    const depFiles = listed
      .filter((p) => /(^|\/)(pyproject\.toml|requirements\.txt|package\.json)$/i.test(p))
      .slice(0, 8);
    let best = 0;
    for (const path of depFiles) {
      const raw = (await files.readFile(path)) ?? "";
      if (LANGGRAPH_DEP_RE.test(raw) || LANGGRAPH_JS_RE.test(raw)) best = Math.max(best, 0.95);
      else if (LANGCHAIN_DEP_RE.test(raw) || LANGCHAIN_JS_RE.test(raw)) best = Math.max(best, 0.7);
    }
    if (best >= 0.7) return best;
    const peek = listed.filter((p) => AGENT_ENTRY_RE.test(p) || SOURCE_RE.test(p)).slice(0, 5);
    for (const path of peek) {
      const raw = ((await files.readFile(path)) ?? "").slice(0, 8_000);
      if (IMPORT_RE.test(raw)) return Math.max(best, 0.85);
    }
    return best;
  },

  async extract(files: RepoFileAccess, source: IngestionSource): Promise<AdapterExtractResult> {
    const listed = await files.listFiles();
    const index = indexFiles(listed, source.subdir);
    const warnings: string[] = [...(source.warnings ?? [])];
    if (index.truncated) {
      warnings.push("File listing was capped. Point Ballast at the agent subdirectory for a fuller extraction.");
    }
    if (index.likelyMonorepo) {
      warnings.push(
        "This looks like a large monorepo. Ballast only scanned convention files near the top of the tree — point at the agent subdirectory (for example /backend) instead of the repo root."
      );
    }

    const manifests = await loadManifests(files, index.scoped);
    const manifest = pickManifest(manifests, source.subdir);
    if (manifests.length > 1) {
      warnings.push(
        `Found ${manifests.length} langgraph.json files; using ${manifest?.path ?? "none"}. Point at a subdirectory to choose a different graph.`
      );
    }

    const extra = [
      ...(manifest?.graphs.map((g) => g.file) ?? []),
      ...(manifest ? [manifest.path] : []),
    ];
    const candidates = pickCandidateFiles(index.scoped, extra, index.likelyMonorepo);
    const loaded = await readMany(files, candidates);

    const language = detectLanguage([...loaded.keys()]);
    const model: HarnessModel = emptyModel(language, "langgraph", "LangChain / LangGraph", source.label, warnings);
    model.metadata.sourceKind = source.kind;
    model.metadata.sourceLabel = source.label;

    if (manifest) {
      model.metadata.pythonVersion = manifest.pythonVersion;
      model.metadata.nodeVersion = manifest.nodeVersion;
      model.metadata.dependencies = manifest.dependencies;
      model.metadata.envFile = typeof manifest.env === "string" ? manifest.env : undefined;
      const graphs: GraphEntry[] = manifest.graphs.map((g) => ({
        name: g.name,
        file: g.file,
        symbol: g.symbol,
        description: g.description,
      }));
      if (graphs.length > 0) {
        const names = graphs.map((g) => g.name);
        model.delegation = {
          graphs,
          source: manifest.path,
          summary:
            graphs.length === 1
              ? `Single graph "${names[0]}" declared in ${manifest.path} (${graphs[0].file}:${graphs[0].symbol}).`
              : `Multi-agent structure: ${names.join(", ")} declared in ${manifest.path}.`,
        };
      }
    }

    const allPrompts: ExtractedPrompt[] = [];
    const toolGroups: ExtractedTool[][] = [];
    const knowledgeGroups: KnowledgeSource[][] = [];
    const memoryParts: Array<MemorySettings | null> = [];
    const boundNames: string[] = [];

    if (manifest?.env && typeof manifest.env === "object") {
      knowledgeGroups.push(
        parseEnvExample(
          manifest.path,
          Object.keys(manifest.env)
            .map((k) => `${k}=`)
            .join("\n")
        )
      );
    }

    for (const [path, raw] of loaded) {
      const contents = readSource(path, raw);

      if (/(^|\/)\.env/i.test(path) || path.endsWith(".env.example") || path.endsWith(".env.sample") || path.endsWith(".env.template")) {
        knowledgeGroups.push(parseEnvExample(path, contents));
      }
      knowledgeGroups.push(extractRetrievers(path, contents));
      memoryParts.push(extractMemorySettings(path, contents));

      if (!SOURCE_RE.test(path) && !PROMPT_FILE_RE.test(path) && !TOOL_FILE_RE.test(path) && !TOOL_DIR_RE.test(path) && !AGENT_ENTRY_RE.test(path) && !CONVENTION_FILE_RE.test(path)) {
        continue;
      }

      if (isPythonPath(path) || path.endsWith(".ipynb")) {
        allPrompts.push(...extractPromptsFromSource(path, contents));
        toolGroups.push(extractPythonTools(path, contents));
        boundNames.push(...extractBoundToolNames(contents));
      } else if (isTypeScriptPath(path)) {
        allPrompts.push(...extractPromptsFromSource(path, contents));
        toolGroups.push(extractTypeScriptTools(path, contents));
        boundNames.push(...extractBoundToolNames(contents));
      }
    }

    const { instructions, guardrails } = splitGuardrailPrompts(allPrompts);
    model.instructions = instructions;
    model.guardrails = guardrails;
    model.tools = mergeTools(toolGroups);
    for (const name of boundNames) {
      if (!model.tools.some((t) => t.name === name)) {
        model.tools.push({
          name,
          permissions: ["read"],
          exercised: "unknown",
          source: "bound-tools",
        });
      }
    }
    model.knowledge = mergeKnowledge(knowledgeGroups);
    model.memory = mergeMemory(memoryParts);

    if (index.likelyMonorepo && model.instructions.length === 0 && model.tools.length === 0) {
      warnings.push("Low coverage on a large tree is expected — paste the agent prompt or point at its subdirectory.");
      model.metadata.warnings = warnings;
    }

    const coverage = buildCoverage(model, index.scoped.length, loaded.size);
    return { model, coverage };
  },
};
