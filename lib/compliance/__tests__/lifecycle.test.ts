import { describe, expect, it } from "vitest";
import { complianceReportCoversActive, selectPoliciesForAnalysis } from "@/lib/compliance/lifecycle";

describe("selectPoliciesForAnalysis", () => {
  it("keeps only active policies", () => {
    const selected = selectPoliciesForAnalysis([
      { id: "a", status: "active" },
      { id: "p", status: "paused" },
      { id: "d", status: "draft" },
    ]);
    expect(selected.map((policy) => policy.id)).toEqual(["a"]);
  });

  it("returns nothing when every policy is paused or draft", () => {
    expect(
      selectPoliciesForAnalysis([
        { status: "paused" },
        { status: "draft" },
      ])
    ).toEqual([]);
  });
});

describe("complianceReportCoversActive", () => {
  it("matches when the report checked the same active policies at the same versions", () => {
    expect(
      complianceReportCoversActive(
        [
          { policyId: "a", policyVersion: 2 },
          { policyId: "b", policyVersion: 1 },
        ],
        [
          { id: "b", version: 1 },
          { id: "a", version: 2 },
        ]
      )
    ).toBe(true);
  });

  it("rejects a report that still includes a paused or draft policy", () => {
    expect(
      complianceReportCoversActive(
        [
          { policyId: "a", policyVersion: 1 },
          { policyId: "paused", policyVersion: 1 },
        ],
        [{ id: "a", version: 1 }]
      )
    ).toBe(false);
  });

  it("rejects a report from an older version of an active policy", () => {
    expect(
      complianceReportCoversActive([{ policyId: "a", policyVersion: 1 }], [{ id: "a", version: 2 }])
    ).toBe(false);
  });
});
