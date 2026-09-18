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
 * A pass always returns findings. The engine marks the pass `partial` or
 * `error` when the model path throws — callers must not treat an empty
 * finding set as a completed clean audit.
 */
export type PassOutput = {
  findings: Finding[];
  incomplete?: {
    status: "error" | "skipped" | "partial";
    note: string;
  };
};

export type AnalysisPass = (ctx: PassContext) => Promise<PassOutput>;
