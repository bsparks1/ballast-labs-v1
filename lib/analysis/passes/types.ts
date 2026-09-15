import type { Finding, Instruction, ToolGrant } from "@/lib/types";
import type { ModelCaller } from "@/lib/analysis/model";

export type PassContext = {
  instructions: Instruction[];
  tools: ToolGrant[];
  rawPrompt: string;
  callModel: ModelCaller;
  modelAvailable: boolean;
};

/**
 * A pass either completes (`incomplete` unset) or records why it did not.
 * Findings gathered before failure are still returned — but the engine must
 * never treat an incomplete pass as a clean empty result.
 */
export type PassOutput = {
  findings: Finding[];
  incomplete?: {
    status: "error" | "skipped" | "partial";
    note: string;
  };
};

export type AnalysisPass = (ctx: PassContext) => Promise<PassOutput>;
