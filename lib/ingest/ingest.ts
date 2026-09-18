/**
 * Ingest orchestrator: source → detectFramework → adapter.extract → assemble.
 * Analysis is optional so the editor can preview coverage before saving.
 */

import { analyzeHarness, type AnalyzeOptions } from "@/lib/analysis/engine";
import { attachIngestionMeta, assembleHarness } from "./assemble";
import { detectFramework } from "./registry";
import type { IngestResult, IngestionSource, RepoFileAccess } from "./types";

export const NO_ANALYZABLE_HARNESS_CODE = "no_analyzable_harness";
export const NO_ANALYZABLE_HARNESS_MESSAGE =
  "We couldn't find an agent configuration in this repo. Point us at the agent's directory, or paste the system prompt directly.";

export class IngestUserError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 422, code?: string) {
    super(message);
    this.name = "IngestUserError";
    this.status = status;
    this.code = code;
  }
}

export type IngestOptions = {
  files: RepoFileAccess;
  source: IngestionSource;
  supplemental?: string;
  analyze?: boolean;
  analyzeOptions?: AnalyzeOptions;
};

export async function ingestRepo(options: IngestOptions): Promise<IngestResult> {
  const { adapter } = await detectFramework(options.files);
  const { model, coverage } = await adapter.extract(options.files, options.source);
  model.metadata.adapter = adapter.id;
  model.metadata.framework = adapter.name;
  coverage.adapter = adapter.id;
  coverage.framework = adapter.name;

  const assembled = assembleHarness(model, options.source, coverage, options.supplemental);
  if (!options.analyze) return assembled;

  const hasPrompt = model.instructions.length > 0 || Boolean(options.supplemental?.trim());
  if (!hasPrompt) {
    throw new IngestUserError(NO_ANALYZABLE_HARNESS_MESSAGE, 422, NO_ANALYZABLE_HARNESS_CODE);
  }

  const report = attachIngestionMeta(
    await analyzeHarness(assembled.prompt, assembled.config, options.analyzeOptions),
    assembled.config
  );
  return { ...assembled, report };
}
