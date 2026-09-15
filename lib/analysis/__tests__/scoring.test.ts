import { describe, expect, it } from "vitest";
import {
  scoreComponent,
  scoreOverall,
  SINGLE_CRITICAL_CAP,
  MULTI_CRITICAL_CAP,
  OVERALL_CRITICAL_CAP,
} from "@/lib/analysis/scoring";
import type { ComponentReport, Finding, HarnessComponent } from "@/lib/types";
import { reportBand, scoreBand, verdictLine } from "@/lib/format";

function finding(severity: Finding["severity"], overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f",
    component: "instructions",
    category: "contradiction",
    severity,
    title: "t",
    description: "d",
    affectedElement: "e",
    recommendation: "r",
    ...overrides,
  };
}

function component(
  score: number,
  findings: Finding[] = [],
  status: ComponentReport["status"] = "scored",
  name: HarnessComponent = "instructions"
): ComponentReport {
  return { component: name, status, healthScore: score, findings };
}

describe("scoreComponent", () => {
  it("starts at 100 with no findings", () => {
    expect(scoreComponent([])).toBe(100);
  });

  it("caps at 40 for a single critical, regardless of other math", () => {
    expect(scoreComponent([finding("critical")])).toBe(SINGLE_CRITICAL_CAP);
  });

  it("caps at 25 for two or more criticals", () => {
    expect(scoreComponent([finding("critical"), finding("critical")])).toBe(MULTI_CRITICAL_CAP);
  });

  it("subtracts 15 per warning and 5 per info, floored at 0", () => {
    expect(scoreComponent([finding("warning")])).toBe(85);
    expect(scoreComponent([finding("warning"), finding("warning")])).toBe(70);
    expect(scoreComponent([finding("warning"), finding("warning"), finding("warning")])).toBe(55);
    expect(scoreComponent([finding("info")])).toBe(95);
    expect(scoreComponent(Array.from({ length: 8 }, () => finding("warning")))).toBe(0);
  });
});

describe("scoreOverall", () => {
  it("excludes not-applicable components instead of treating them as 100", () => {
    const components = [
      component(70, [finding("warning")], "scored", "instructions"),
      component(0, [], "not_applicable", "knowledge"),
      component(0, [], "not_applicable", "memory"),
      component(0, [], "not_applicable", "delegation"),
    ];
    expect(scoreOverall(components, { criticalCount: 0 })).toBeLessThan(80);
    expect(scoreOverall(components, { criticalCount: 0 })).toBeGreaterThanOrEqual(70);
  });

  it("is pulled toward the worst present component, not a flat average", () => {
    const components = [
      component(90, [], "scored", "instructions"),
      component(40, [finding("critical")], "scored", "tools"),
      component(80, [finding("warning")], "scored", "guardrails"),
    ];
    const overall = scoreOverall(components, { criticalCount: 1 });
    expect(overall).toBeLessThanOrEqual(OVERALL_CRITICAL_CAP);
    expect(overall).toBeLessThan(70);
  });

  it("caps overall at 50 when any critical exists even if components are high", () => {
    const components = [component(90), component(88, [finding("critical")])];
    expect(scoreOverall(components, { criticalCount: 1 })).toBe(OVERALL_CRITICAL_CAP);
  });

  it("does not let a single warning hide in the 90s", () => {
    const components = [
      component(100, [], "scored", "instructions"),
      component(100, [], "scored", "tools"),
      component(100, [], "scored", "guardrails"),
      component(100, [], "scored", "delegation"),
      component(100, [], "scored", "knowledge"),
      component(85, [finding("warning")], "scored", "memory"),
    ];
    const overall = scoreOverall(components, { criticalCount: 0 });
    expect(overall).toBeLessThan(90);
    expect(overall).toBeGreaterThanOrEqual(79);
  });
});

describe("verdict bands", () => {
  it("labels 0–40 as serious issues and never calls a critical prompt healthy", () => {
    expect(scoreBand(25)).toBe("serious");
    expect(scoreBand(50)).toBe("gaps");
    expect(scoreBand(70)).toBe("functional");
    expect(scoreBand(84)).toBe("minor");
    expect(scoreBand(92)).toBe("clean");
    expect(
      reportBand({
        overallHealthScore: 95,
        components: [],
        passes: [{ pass: "contradictions", label: "c", status: "skipped", findingCount: 0 }],
        meta: {
          instructionCount: 1,
          absoluteRuleCount: 0,
          fossilCount: 0,
          verifiedConflictCount: 0,
          criticalFindingCount: 0,
          createdAt: new Date().toISOString(),
        },
      })
    ).toBe("minor");
    const report = {
      overallHealthScore: 25,
      components: [
        {
          component: "instructions" as const,
          status: "scored" as const,
          healthScore: 25,
          findings: [finding("critical")],
        },
      ],
      passes: [],
      meta: {
        instructionCount: 10,
        absoluteRuleCount: 8,
        fossilCount: 2,
        verifiedConflictCount: 3,
        criticalFindingCount: 1,
        createdAt: new Date().toISOString(),
      },
    };
    const line = verdictLine(report);
    expect(line.toLowerCase()).toMatch(/serious issues/);
    expect(line.toLowerCase()).not.toMatch(/good shape|in good shape|healthy/);
  });
});
