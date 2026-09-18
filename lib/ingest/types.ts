/**
 * Canonical harness model and adapter contracts.
 *
 * Adapters read a repo through RepoFileAccess and emit this model plus an
 * honest CoverageReport. The rest of Ballast — analysis, dashboard, persistence —
 * never talks to a framework directly.
 */

import type { HarnessComponent, HarnessReport, ToolGrant } from "@/lib/types";

export type CoverageStatus = "extracted" | "partial" | "not_found" | "not_applicable";

export type SourceKind = "github" | "upload" | "memory";

export type AgentLanguage = "python" | "typescript" | "mixed" | "unknown";

export type ExtractedPrompt = {
  name: string;
  text: string;
  source: string;
};

export type ExtractedTool = ToolGrant & {
  description?: string;
  args?: string[];
  source: string;
};

export type KnowledgeSource = {
  name: string;
  kind: "env" | "vectorstore" | "retriever" | "integration";
  detail?: string;
  source: string;
};

export type MemorySettings = {
  checkpointer?: string;
  store?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  source: string;
  details: string[];
};

export type GraphEntry = {
  name: string;
  file: string;
  symbol: string;
  description?: string;
};

export type DelegationStructure = {
  graphs: GraphEntry[];
  summary: string;
  source: string;
};

export type HarnessMetadata = {
  framework: string;
  adapter: string;
  language: AgentLanguage;
  pythonVersion?: string;
  nodeVersion?: string;
  envFile?: string;
  dependencies: string[];
  sourceKind: SourceKind;
  sourceLabel: string;
  warnings: string[];
};

export type HarnessModel = {
  instructions: ExtractedPrompt[];
  tools: ExtractedTool[];
  knowledge: KnowledgeSource[];
  memory: MemorySettings | null;
  guardrails: ExtractedPrompt[];
  delegation: DelegationStructure | null;
  metadata: HarnessMetadata;
};

export type ComponentCoverage = {
  component: HarnessComponent;
  status: CoverageStatus;
  detail: string;
  sources: string[];
};

export type CoverageReport = {
  adapter: string;
  framework: string;
  language: AgentLanguage;
  components: ComponentCoverage[];
  summary: string;
  warnings: string[];
  filesScanned: number;
  filesRead: number;
};

export type IngestionSource = {
  kind: SourceKind;
  label: string;
  url?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  subdir?: string;
  warnings?: string[];
};

export type IngestionMeta = {
  source: IngestionSource;
  adapter: string;
  framework: string;
  coverage: CoverageReport;
  extractedAt: string;
};

export type AdapterExtractResult = {
  model: HarnessModel;
  coverage: CoverageReport;
};

export type RepoFileInfo = {
  path: string;
  size?: number;
};

/**
 * Framework-agnostic file access. Adapters must not call GitHub (or anything
 * else) directly — they list and read through this interface.
 */
export interface RepoFileAccess {
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string | null>;
  stat?(path: string): Promise<RepoFileInfo | null>;
}

export interface FrameworkAdapter {
  id: string;
  name: string;
  /**
   * Confidence that this adapter owns the repo. 0–1.
   * detectFramework picks the highest score above the match threshold.
   */
  detect(files: RepoFileAccess): Promise<number>;
  extract(files: RepoFileAccess, source: IngestionSource): Promise<AdapterExtractResult>;
}

export type AssembledHarness = {
  prompt: string;
  config: string;
  model: HarnessModel;
  coverage: CoverageReport;
};

export type IngestResult = AssembledHarness & {
  report?: HarnessReport;
};

export const BALLAST_CONFIG_KEY = "_ballast";

export type BallastConfigMeta = {
  source: IngestionSource;
  adapter: string;
  framework: string;
  coverage: CoverageReport;
};
