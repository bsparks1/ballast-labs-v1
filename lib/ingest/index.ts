export type { FrameworkAdapter, HarnessModel, CoverageReport, RepoFileAccess, IngestResult, IngestionMeta } from "./types";
export { MemoryRepo } from "./files";
export { detectFramework, registerAdapter, listAdapters } from "./registry";
export { ingestRepo } from "./ingest";
export { assembleHarness, assemblePrompt, assembleConfig, attachIngestionMeta, parseBallastMeta } from "./assemble";
export { parseGitHubUrl, loadGitHubRepo, GitHubIngestError } from "./github";
export { loadUploadedFiles, UploadIngestError } from "./upload";
