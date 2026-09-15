/**
 * Layer B used to live here as a single conflict pass that swallowed errors
 * and returned []. That is what produced "0 conflicts, score 95."
 *
 * Conflict detection now lives in lib/analysis/passes/contradictions.ts and
 * is orchestrated by lib/analysis/engine.ts. This file keeps the JSON helper
 * export so existing smoke tests keep working.
 */

export { extractJson } from "@/lib/analysis/model";
export { findContradictions as findVerifiedConflicts } from "@/lib/analysis/passes/contradictions";
export { isModelAvailable as isConflictAnalysisAvailable } from "@/lib/analysis/model";
