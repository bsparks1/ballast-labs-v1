/** Category headings for the policy library. Order is the display order. */
export const POLICY_PRINCIPLES = [
  "Tools & Permissions",
  "Financial Authority",
  "Human Oversight",
  "Data Handling",
  "Injection",
  "Delegation",
  "Instruction Integrity",
] as const;

export type PolicyPrinciple = (typeof POLICY_PRINCIPLES)[number];

export function asPrinciple(value: unknown): PolicyPrinciple | null {
  return typeof value === "string" && (POLICY_PRINCIPLES as readonly string[]).includes(value)
    ? (value as PolicyPrinciple)
    : null;
}
