/**
 * Read the existing structural decomposition. This does not change how
 * instructions or tools are extracted — it calls the same function the
 * analysis engine uses.
 */

import { runStructuralAnalysis } from "@/lib/analysis/structural";
import type { HarnessComponent, Instruction, ToolGrant } from "@/lib/types";

export type DecomposedHarness = {
  harnessVersionId: string;
  rawPrompt: string;
  rawConfig: string;
  instructions: Instruction[];
  tools: ToolGrant[];
  present: Record<HarnessComponent, boolean>;
  summaries: Partial<Record<HarnessComponent, string>>;
};

export function decomposeHarness(
  harnessVersionId: string,
  rawPrompt: string,
  rawConfig = ""
): DecomposedHarness {
  const structural = runStructuralAnalysis(rawPrompt, rawConfig);
  return {
    harnessVersionId,
    rawPrompt,
    rawConfig,
    instructions: structural.instructions,
    tools: structural.tools,
    present: structural.present,
    summaries: structural.summaries,
  };
}

/** No instructions and no tools: there is nothing a policy can pass against. */
export function isSilentHarness(harness: DecomposedHarness): boolean {
  return (
    harness.rawPrompt.trim().length === 0 &&
    harness.rawConfig.trim().length === 0
  ) || (
    harness.instructions.length === 0 &&
    harness.tools.length === 0 &&
    harness.rawConfig.trim().length === 0
  );
}
