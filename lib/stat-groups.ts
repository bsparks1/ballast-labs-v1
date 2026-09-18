/**
 * Headline stat groupings on the report overview.
 * Each tile opens a dedicated drill-down of the matching instructions or findings.
 */

import type { Finding, HarnessReport, Instruction } from "@/lib/types";

export type StatGroupId =
  | "instructions"
  | "absolute-rules"
  | "fossils"
  | "verified-conflicts"
  | "critical-findings";

export type StatGroupKind = "instructions" | "findings";

export type StatGroupDef = {
  id: StatGroupId;
  href: string;
  label: string;
  title: string;
  description: string;
  kind: StatGroupKind;
  empty: string;
};

export const STAT_GROUPS: Record<StatGroupId, StatGroupDef> = {
  instructions: {
    id: "instructions",
    href: "/report/group/instructions",
    label: "Instructions",
    title: "Instructions",
    description: "Every atomic instruction extracted from the system prompt, with type and fossil markers.",
    kind: "instructions",
    empty: "No instructions were extracted from this prompt.",
  },
  "absolute-rules": {
    id: "absolute-rules",
    href: "/report/group/absolute-rules",
    label: "Absolute rules",
    title: "Absolute rules",
    description: "Unconditional always / never / must rules. These are the instructions that cannot yield.",
    kind: "instructions",
    empty: "No absolute rules were found in this prompt.",
  },
  fossils: {
    id: "fossils",
    href: "/report/group/fossils",
    label: "Fossils",
    title: "Fossil instructions",
    description:
      "Dead scaffolding that does not change modern-model behavior — quoted from the prompt so you can delete it.",
    kind: "instructions",
    empty: "No fossil scaffolding was found in this prompt.",
  },
  "verified-conflicts": {
    id: "verified-conflicts",
    href: "/report/group/verified-conflicts",
    label: "Verified conflicts",
    title: "Verified conflicts",
    description: "Pairs of instructions that demand incompatible actions under a realistic trigger, with both rules quoted.",
    kind: "findings",
    empty: "No verified instruction conflicts were found.",
  },
  "critical-findings": {
    id: "critical-findings",
    href: "/report/group/critical-findings",
    label: "Critical findings",
    title: "Critical findings",
    description:
      "Every critical finding across the harness, with the component it belongs to, the audit that produced it, and the quoted reference.",
    kind: "findings",
    empty: "No critical findings in this analysis.",
  },
};

export const STAT_GROUP_IDS = Object.keys(STAT_GROUPS) as StatGroupId[];

export function isStatGroupId(value: string): value is StatGroupId {
  return value in STAT_GROUPS;
}

export function reportInstructions(report: HarnessReport): Instruction[] {
  return report.components.find((c) => c.component === "instructions")?.instructions ?? [];
}

export function reportFindings(report: HarnessReport): Finding[] {
  return report.components.flatMap((c) => c.findings);
}

export function instructionsForGroup(report: HarnessReport, id: StatGroupId): Instruction[] {
  const all = reportInstructions(report);
  if (id === "absolute-rules") return all.filter((i) => i.type === "absolute");
  if (id === "fossils") return all.filter((i) => i.isFossil);
  if (id === "instructions") return all;
  return [];
}

export function findingsForGroup(report: HarnessReport, id: StatGroupId): Finding[] {
  const all = reportFindings(report);
  if (id === "verified-conflicts") return all.filter((f) => f.category === "contradiction");
  if (id === "critical-findings") return all.filter((f) => f.severity === "critical");
  return [];
}

export function relatedFindings(findings: Finding[], instruction: Instruction): Finding[] {
  const text = instruction.text.toLowerCase();
  const id = instruction.id.toLowerCase();
  return findings.filter((f) => {
    if (f.affectedElement.toLowerCase().includes(id)) return true;
    if (f.affectedElement.toLowerCase().includes(text)) return true;
    return (f.evidence ?? []).some((e) => e.toLowerCase().includes(text) || e.toLowerCase().includes(id));
  });
}
