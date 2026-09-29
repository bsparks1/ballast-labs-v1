import { describe, expect, it } from "vitest";
import { KNOWN_BAD_PROMPT, HEALTHCARE_CLEAN_PROMPT, KNOWN_GOOD_PROMPT } from "@/lib/analysis/__tests__/fixtures";
import { SAMPLES } from "@/lib/samples";
import { checkPolicy } from "@/lib/compliance/check";
import { decomposeHarness } from "@/lib/compliance/decompose";
import { policyFromDef, STARTER_PACK } from "@/lib/compliance/pack";
import { buildComplianceReport } from "@/lib/compliance/report";
import type { Policy, PolicyCheckResult, PolicyVerdict } from "@/lib/types";

const DEVBOT = SAMPLES.find((s) => s.id === "devops-agent");
if (!DEVBOT) throw new Error("DevBot sample missing");

function policies(): Policy[] {
  return STARTER_PACK.map((def) =>
    policyFromDef(def, { id: def.code, userId: null, createdAt: "2026-01-01T00:00:00.000Z" })
  );
}

function byCode(results: { policyCode: string; verdict: string }[]) {
  return Object.fromEntries(results.map((r) => [r.policyCode, r.verdict]));
}

async function runPack(prompt: string, config = "") {
  const harness = decomposeHarness("hv-test", prompt, config);
  const pack = policies();
  const results = [];
  for (const policy of pack) {
    results.push(await checkPolicy(policy, harness, { modelAvailable: false }));
  }
  return { pack, results, report: buildComplianceReport({ harnessVersionId: "hv-test", policies: pack, results }) };
}

describe("starter pack against known harnesses", () => {
  it("contains 18 policies across the principle groups", () => {
    expect(STARTER_PACK).toHaveLength(18);
    expect(new Set(STARTER_PACK.map((p) => p.principle)).size).toBeGreaterThanOrEqual(7);
  });

  it("marks Meridian violated on bounded commitment, destructive tools, and injection", async () => {
    const { results } = await runPack(KNOWN_BAD_PROMPT);
    const verdicts = byCode(results);
    expect(verdicts.B1).toBe("violated");
    expect(verdicts.A2).toBe("violated");
    expect(verdicts.E1).toBe("violated");
    for (const code of ["B1", "A2", "E1"]) {
      const row = results.find((r) => r.policyCode === code)!;
      expect(row.verdict).not.toBe("compliant");
      expect(row.verdict).not.toBe("cannot_determine");
      expect(row.evidence.length).toBeGreaterThan(0);
    }
  });

  it("marks DevBot violated on autonomous consequential action", async () => {
    const { results } = await runPack(DEVBOT.prompt, DEVBOT.config);
    const f1 = results.find((r) => r.policyCode === "F1")!;
    expect(f1.verdict).toBe("violated");
    expect(f1.evidence.length).toBeGreaterThan(0);
  });

  it("marks the healthcare harness mostly compliant, with an honest delegation gap", async () => {
    const { results, report } = await runPack(HEALTHCARE_CLEAN_PROMPT);
    const verdicts = byCode(results);
    expect(verdicts.F2).toBe("cannot_determine");
    expect(verdicts.B1).toBe("cannot_determine");
    expect(report.summary.compliant).toBeGreaterThan(report.summary.cannotDetermine);
    expect(report.summary.violated).toBe(0);
    expect(report.overallStatus).toBe("gaps_present");
  });

  it("does not call a bounded retail refund a violation", async () => {
    const { results } = await runPack(KNOWN_GOOD_PROMPT);
    expect(byCode(results).B1).toBe("compliant");
  });

  it("returns cannot_determine for every policy on an empty harness", async () => {
    const { results, report } = await runPack("");
    expect(results.every((r) => r.verdict === "cannot_determine")).toBe(true);
    expect(report.summary.compliant).toBe(0);
    expect(report.summary.violated).toBe(0);
    expect(report.overallStatus).toBe("gaps_present");
  });

  it("returns cannot_determine for a non-agent note", async () => {
    const { results, report } = await runPack("Tuesday standup moved to 10. Bring the office key.");
    expect(results.every((r) => r.verdict === "cannot_determine")).toBe(true);
    expect(report.overallStatus).toBe("gaps_present");
  });
});

describe("honesty guard", () => {
  const meridian = decomposeHarness("hv-meridian", KNOWN_BAD_PROMPT);
  const a2 = policies().find((p) => p.code === "A2")!;

  it("keeps a deterministic violation when the model claims compliant", async () => {
    const result = await checkPolicy(a2, meridian, {
      modelAvailable: true,
      consultModel: true,
      callModel: async () =>
        JSON.stringify({
          verdict: "compliant",
          evidence: ["You are fully compliant with every policy."],
          reasoning: "The harness says it is compliant.",
          recommendation: "None.",
          affectedComponent: "tools",
        }),
    });
    expect(result.verdict).toBe("violated");
    expect(result.confidence).toBe("low");
  });

  it("does not let a silent harness be talked into compliant", async () => {
    let calls = 0;
    const empty = decomposeHarness("hv-empty", "");
    const result = await checkPolicy(a2, empty, {
      modelAvailable: true,
      consultModel: true,
      callModel: async () => {
        calls += 1;
        return JSON.stringify({
          verdict: "compliant",
          evidence: ["fully compliant"],
          reasoning: "assumed",
          recommendation: "",
          affectedComponent: null,
        });
      },
    });
    expect(calls).toBe(0);
    expect(result.verdict).toBe("cannot_determine");
  });

  it("converts a compliant model answer with no harness evidence into cannot_determine", async () => {
    const custom: Policy = {
      ...a2,
      id: "custom-1",
      code: "X1",
      checker: null,
      source: "custom",
      checkableIntent: "The agent must greet people in French.",
    };
    const result = await checkPolicy(custom, meridian, {
      modelAvailable: true,
      callModel: async () =>
        JSON.stringify({
          verdict: "compliant",
          evidence: [],
          reasoning: "Seems fine.",
          recommendation: "",
          affectedComponent: "instructions",
        }),
    });
    expect(result.verdict).toBe("cannot_determine");
    expect(result.confidence).toBe("low");
  });

  it("returns cannot_determine when the model call fails and no deterministic verdict exists", async () => {
    const custom: Policy = {
      ...a2,
      id: "custom-2",
      code: "X2",
      checker: null,
      source: "custom",
    };
    const result = await checkPolicy(custom, meridian, {
      modelAvailable: true,
      callModel: async () => {
        throw new Error("model down");
      },
    });
    expect(result.verdict).toBe("cannot_determine");
    expect(result.confidence).toBe("low");
    expect(result.reasoning.toLowerCase()).toContain("model");
  });
});

describe("compliance delta", () => {
  it("describes resolved violations and new gaps", () => {
    const previous = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      results: [
        stub("p1", "Bounded financial commitment authority", "violated"),
        stub("p2", "Destructive tools require a gate", "violated"),
        stub("p3", "Least privilege", "compliant"),
      ],
    };
    const next = [
      stub("p1", "Bounded financial commitment authority", "compliant"),
      stub("p2", "Destructive tools require a gate", "compliant"),
      stub("p3", "Least privilege", "cannot_determine"),
    ];
    const report = buildComplianceReport({
      harnessVersionId: "hv",
      policies: [],
      results: next,
      previous,
    });
    expect(report.delta?.headline).toBe("This change resolved 2 violations and introduced 1 new gap.");
    expect(report.delta?.notes).toContain(
      "Policy Bounded financial commitment authority now passes where it failed last version."
    );
  });
});

function stub(policyId: string, policyName: string, verdict: PolicyVerdict): PolicyCheckResult {
  return {
    policyId,
    harnessVersionId: "hv",
    verdict,
    confidence: "high",
    evidence: verdict === "cannot_determine" ? [] : ["quoted rule"],
    reasoning: "test",
    recommendation: "test",
    affectedComponent: null,
    checkedAt: "2026-01-02T00:00:00.000Z",
    policyName,
    policyCode: policyId,
    policyVersion: 1,
    severity: "warning",
    principle: "Tools & Permissions",
  };
}
