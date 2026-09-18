import { describe, expect, it } from "vitest";
import { analyzeHarness } from "@/lib/analysis/engine";
import { KNOWN_BAD_PROMPT } from "./fixtures";
import {
  findingsForGroup,
  instructionsForGroup,
  reportFindings,
} from "@/lib/stat-groups";

const OFFLINE = { modelAvailable: false as const };

describe("stat group drill-downs", () => {
  it("splits the known-bad report into the same counts as the overview tiles", async () => {
    const report = await analyzeHarness(KNOWN_BAD_PROMPT, undefined, OFFLINE);
    const instructions = instructionsForGroup(report, "instructions");
    const absolutes = instructionsForGroup(report, "absolute-rules");
    const fossils = instructionsForGroup(report, "fossils");
    const conflicts = findingsForGroup(report, "verified-conflicts");
    const criticals = findingsForGroup(report, "critical-findings");

    expect(instructions.length).toBe(report.meta.instructionCount);
    expect(absolutes.length).toBe(report.meta.absoluteRuleCount);
    expect(fossils.length).toBe(report.meta.fossilCount);
    expect(conflicts.length).toBe(report.meta.verifiedConflictCount);
    expect(criticals.length).toBe(report.meta.criticalFindingCount);
    expect(criticals.length).toBeGreaterThan(0);
    expect(criticals.every((f) => f.severity === "critical")).toBe(true);
    expect(conflicts.every((f) => f.category === "contradiction")).toBe(true);
    expect(fossils.every((f) => f.isFossil)).toBe(true);
    expect(absolutes.every((f) => f.type === "absolute")).toBe(true);
    expect(reportFindings(report).length).toBeGreaterThan(criticals.length);
  });
});
