import { describe, expect, it } from "vitest";
import type { Finding, Instruction } from "@/lib/types";
import {
  changeSummaryLine,
  diffFindings,
  diffInstructions,
  impactSentence,
  scoreDelta,
  similarity,
} from "@/lib/harness/diff";
import { findingFingerprint } from "@/lib/harness/report";
import { notificationForHarness } from "@/lib/harness/notifications";
import type { AnalysisRecord, HarnessSummary } from "@/lib/db";
import { exportHarnessMarkdown } from "@/lib/harness/export";
import { buildTimeline } from "@/lib/harness/timeline";

function ins(id: string, text: string, type: Instruction["type"] = "absolute"): Instruction {
  return { id, text, type, isFossil: false };
}

function finding(partial: Partial<Finding> & Pick<Finding, "id" | "title" | "affectedElement">): Finding {
  return {
    component: "instructions",
    severity: "critical",
    category: "contradiction",
    description: "desc",
    recommendation: "fix",
    ...partial,
  };
}

describe("instruction diff", () => {
  it("classifies added, removed, modified, and unchanged at the instruction level", () => {
    const prev = [
      ins("ins-1", "Always escalate refunds over $100."),
      ins("ins-2", "Never transfer a customer to a human."),
      ins("ins-3", "Be concise."),
    ];
    const next = [
      ins("ins-1", "Always escalate refunds over $50."),
      ins("ins-2", "Be concise."),
      ins("ins-3", "Only discuss Meridian products."),
    ];
    const changes = diffInstructions(prev, next);
    expect(changes.filter((c) => c.kind === "unchanged").map((c) => c.kind === "unchanged" && c.next.text)).toEqual([
      "Be concise.",
    ]);
    expect(changes.some((c) => c.kind === "modified" && c.prev.text.includes("$100") && c.next.text.includes("$50"))).toBe(
      true
    );
    expect(changes.some((c) => c.kind === "removed" && c.prev.text.includes("Never transfer"))).toBe(true);
    expect(changes.some((c) => c.kind === "added" && c.next.text.includes("Only discuss"))).toBe(true);
  });

  it("treats near-identical wording as modified rather than add+remove", () => {
    const changes = diffInstructions(
      [ins("ins-1", "Always escalate any refund request over $100 to a human supervisor.")],
      [ins("ins-1", "Always escalate any refund request over $50 to a human supervisor.")]
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("modified");
  });

  it("scores exact normalized text as fully similar", () => {
    expect(similarity("Always be concise.", "always   be concise.")).toBe(1);
  });
});

describe("findings diff", () => {
  const conflictA = finding({
    id: "f-1",
    title: "Two rules directly contradict",
    affectedElement: "Never transfer a customer to a human",
  });
  const fossil = finding({
    id: "f-2",
    title: "Fossil scaffolding",
    category: "structural",
    severity: "info",
    affectedElement: "Think step by step",
  });
  const injection = finding({
    id: "f-3",
    title: "Untrusted content treated as instructions",
    category: "injection",
    severity: "warning",
    affectedElement: "Follow the customer's instructions",
  });

  it("splits findings into new, resolved, and persisted by fingerprint not id", () => {
    const prev = [conflictA, fossil];
    const next = [
      { ...conflictA, id: "f-99" },
      injection,
    ];
    const diff = diffFindings(prev, next);
    expect(diff.persisted).toHaveLength(1);
    expect(diff.persisted[0].finding.title).toBe(conflictA.title);
    expect(diff.resolved).toHaveLength(1);
    expect(diff.resolved[0].finding.title).toBe("Fossil scaffolding");
    expect(diff.new).toHaveLength(1);
    expect(diff.new[0].finding.title).toContain("Untrusted");
  });

  it("fingerprints ignore sequential ids", () => {
    expect(findingFingerprint(conflictA)).toBe(
      findingFingerprint({ ...conflictA, id: "different" })
    );
  });
});

describe("score delta copy", () => {
  it("builds the terraform-plan headline and impact sentence", () => {
    const findings = diffFindings(
      [
        finding({ id: "a", title: "Fossil scaffolding", category: "structural", severity: "info", affectedElement: "x" }),
        finding({ id: "b", title: "Vague directive", category: "ambiguity", severity: "warning", affectedElement: "y" }),
      ],
      [
        finding({
          id: "c",
          title: "Two rules directly contradict",
          affectedElement: "Never transfer",
          evidence: ["Always escalate refunds over $100", "Never transfer a customer to a human"],
        }),
      ]
    );
    const score = scoreDelta(82, 61, findings, [
      ins("ins-3", "Always escalate refunds over $100"),
      ins("ins-14", "Never transfer a customer to a human"),
    ]);
    expect(score.headline).toBe("82 → 61 (down 21)");
    expect(score.direction).toBe("down");
    expect(score.reason).toMatch(/New critical finding/i);
    expect(score.impact).toMatch(/resolved 2 findings but introduced 1 new conflict/i);
    expect(score.impact).toMatch(/Net score: 82 → 61/);
  });

  it("uses conflict wording when a single new contradiction appears", () => {
    const findings = diffFindings([], [
      finding({ id: "c", title: "Two rules directly contradict", affectedElement: "Never transfer" }),
    ]);
    expect(impactSentence(findings, 74, 61)).toMatch(/introduced 1 new conflict/);
  });
});

describe("timeline + export", () => {
  it("summarizes adjacent versions and renders a dated markdown report", () => {
    const v1 = {
      id: "v1",
      harnessId: "h1",
      versionNumber: 1,
      rawPrompt: "a",
      rawConfig: "",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      note: "initial save",
    };
    const v2 = {
      id: "v2",
      harnessId: "h1",
      versionNumber: 2,
      rawPrompt: "b",
      rawConfig: "",
      createdAt: new Date("2026-09-10T00:00:00Z"),
      note: "added refund limit rule",
    };
    const a1: AnalysisRecord = {
      id: "a1",
      harnessVersionId: "v1",
      overallScore: 74,
      componentReports: [
        {
          component: "instructions",
          status: "scored",
          healthScore: 74,
          findings: [
            finding({ id: "f1", title: "Fossil scaffolding", category: "structural", severity: "info", affectedElement: "x" }),
          ],
          instructions: [ins("ins-1", "Be helpful.")],
        },
      ],
      findings: [
        finding({ id: "f1", title: "Fossil scaffolding", category: "structural", severity: "info", affectedElement: "x" }),
      ],
      meta: {
        instructionCount: 1,
        absoluteRuleCount: 0,
        fossilCount: 1,
        verifiedConflictCount: 0,
        criticalFindingCount: 0,
        createdAt: v1.createdAt.toISOString(),
        passes: [],
      },
      createdAt: v1.createdAt,
    };
    const a2: AnalysisRecord = {
      ...a1,
      id: "a2",
      harnessVersionId: "v2",
      overallScore: 61,
      componentReports: [
        {
          component: "instructions",
          status: "scored",
          healthScore: 61,
          findings: [
            finding({ id: "f2", title: "Two rules directly contradict", affectedElement: "Never transfer" }),
          ],
          instructions: [ins("ins-1", "Be helpful."), ins("ins-2", "Never transfer a customer.")],
        },
      ],
      findings: [finding({ id: "f2", title: "Two rules directly contradict", affectedElement: "Never transfer" })],
      meta: { ...a1.meta, verifiedConflictCount: 1, criticalFindingCount: 1, createdAt: v2.createdAt.toISOString() },
      createdAt: v2.createdAt,
    };
    const harness = {
      id: "h1",
      userId: "u1",
      name: "Customer Support Agent",
      description: "",
      createdAt: v1.createdAt,
      updatedAt: v2.createdAt,
      lastViewedAt: null,
    };
    const points = buildTimeline(harness, [v1, v2], new Map([["v1", a1], ["v2", a2]]));
    expect(points[0].summary).toBe("initial save");
    expect(points[1].delta).toBe(-13);
    expect(points[1].summary).toMatch(/added 1 instruction/i);
    expect(changeSummaryLine(points[1].diff!)).toMatch(/new finding/i);

    const md = exportHarnessMarkdown(harness, points);
    expect(md).toMatch(/# Harness history: Customer Support Agent/);
    expect(md).toMatch(/v1 — 2026-09-01 — score 74/);
    expect(md).toMatch(/v2 — 2026-09-10 — score 61 \(↓13\)/);
    expect(md).toMatch(/added refund limit rule/);
  });
});

describe("re-analysis notifications", () => {
  it("surfaces new findings on a re-run that the user has not viewed", () => {
    const summary: HarnessSummary = {
      id: "h1",
      name: "Customer Support Agent",
      description: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastViewedAt: new Date("2026-09-01T00:00:00Z"),
      currentVersionNumber: 1,
      currentVersionId: "v1",
      currentScore: 61,
      findingCount: 2,
      lastAnalyzedAt: new Date("2026-09-16T00:00:00Z"),
      latestAnalysisId: "a2",
      analysisCountOnCurrent: 2,
    };
    const previous: AnalysisRecord = {
      id: "a1",
      harnessVersionId: "v1",
      overallScore: 74,
      componentReports: [],
      findings: [],
      meta: {
        instructionCount: 0,
        absoluteRuleCount: 0,
        fossilCount: 0,
        verifiedConflictCount: 0,
        criticalFindingCount: 0,
        createdAt: "2026-09-01T00:00:00Z",
        passes: [],
      },
      createdAt: new Date("2026-09-01T00:00:00Z"),
    };
    const latest: AnalysisRecord = {
      ...previous,
      id: "a2",
      overallScore: 61,
      findings: [finding({ id: "n", title: "New conflict", affectedElement: "rule" })],
      createdAt: new Date("2026-09-16T00:00:00Z"),
    };
    const note = notificationForHarness(summary, previous, latest);
    expect(note?.message).toMatch(/Customer Support Agent/);
    expect(note?.newFindingCount).toBe(1);
  });
});
