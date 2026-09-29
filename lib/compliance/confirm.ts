/**
 * Turns a reviewed draft into the record that gets saved.
 * Status is always draft. The engine never sees a policy at this step.
 *
 * Extension point for the next build: conflict-check and dry-run run after
 * the author confirms the draft and before the policy can become active.
 */

import type { CreatePolicyInput } from "@/lib/db/types";
import type { HarnessComponent, Severity } from "@/lib/types";
import { HARNESS_COMPONENTS } from "@/lib/types";
import { isUsableCheckableIntent } from "./draft-guard";
import { asPrinciple } from "./principles";

export class UnconfirmedPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnconfirmedPolicyError";
  }
}

export type ConfirmGeneratedInput = {
  userId: string;
  name: string;
  statement: string;
  checkableIntent: string;
  severity: Severity;
  principle: string;
  components: HarnessComponent[];
  frameworks: string[];
  confidence: "high" | "low";
  generationNote?: string;
  /** Required when the draft is low confidence. High-confidence drafts omit it. */
  uncertaintyAccepted?: boolean;
};

const SEVERITIES = new Set<Severity>(["critical", "warning", "info"]);

export function buildConfirmedPolicyInput(input: ConfirmGeneratedInput): CreatePolicyInput {
  const name = input.name.replace(/\s+/g, " ").trim();
  const statement = input.statement.trim();
  const checkableIntent = input.checkableIntent.trim();
  const principle = asPrinciple(input.principle);
  const severity = SEVERITIES.has(input.severity) ? input.severity : null;
  const components = input.components.filter((component) => HARNESS_COMPONENTS.includes(component));
  const frameworks = input.frameworks.map((item) => item.trim()).filter(Boolean);
  const generationNote = input.generationNote?.trim() ?? "";
  const confidence: "high" | "low" = input.confidence === "high" && generationNote === "" ? "high" : "low";

  if (!name) throw new UnconfirmedPolicyError("Name the policy before saving.");
  if (!statement) throw new UnconfirmedPolicyError("The statement is required.");
  if (!isUsableCheckableIntent(checkableIntent)) {
    throw new UnconfirmedPolicyError("Write a checkable condition before saving.");
  }
  if (!principle) throw new UnconfirmedPolicyError("Choose a category before saving.");
  if (!severity) throw new UnconfirmedPolicyError("Severity must be critical, warning, or info.");
  if (components.length === 0) throw new UnconfirmedPolicyError("Choose at least one harness component.");
  if (confidence === "low" && input.uncertaintyAccepted !== true) {
    throw new UnconfirmedPolicyError(
      "This draft is uncertain. Accept the warning, or make the policy more specific, before saving."
    );
  }

  // TODO(next): run conflict-check against active policies and offer dry-run preview before activation
  return {
    userId: input.userId,
    code: `G-${Date.now().toString(36)}`,
    principle,
    name,
    statement,
    checkableIntent,
    components,
    frameworks,
    severity,
    source: "generated",
    checker: null,
    createdBy: input.userId,
    status: "draft",
    note: confidence === "low" ? "Generated draft; uncertainty accepted" : "Generated draft",
    confidence,
    generationNote,
  };
}
