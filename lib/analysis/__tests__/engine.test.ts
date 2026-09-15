import { describe, expect, it } from "vitest";
import { analyzeHarness } from "@/lib/analysis/engine";
import { scoreBand, verdictLine } from "@/lib/format";
import { KNOWN_BAD_PROMPT, KNOWN_GOOD_PROMPT } from "./fixtures";

const OFFLINE = { modelAvailable: false as const };

function allFindings(report: Awaited<ReturnType<typeof analyzeHarness>>) {
  return report.components.flatMap((c) => c.findings);
}

describe("known-bad prompt regression", () => {
  it("finds the planted failures and scores under 40 with a serious-issues verdict", async () => {
    const report = await analyzeHarness(KNOWN_BAD_PROMPT, undefined, OFFLINE);
    const findings = allFindings(report);
    const blob = findings
      .map((f) => `${f.title} ${f.description} ${(f.evidence ?? []).join(" ")} ${f.affectedElement}`)
      .join("\n")
      .toLowerCase();

    const conciseVsThorough = findings.some(
      (f) =>
        f.category === "contradiction" &&
        (f.evidence ?? []).some((e) => /concise/i.test(e)) &&
        (f.evidence ?? []).some((e) => /thorough|detailed/i.test(e))
    );
    expect(conciseVsThorough, "must find concise vs thorough contradiction").toBe(true);

    const escalationConflicts = findings.filter((f) => {
      if (f.category !== "contradiction") return false;
      const ev = (f.evidence ?? []).join(" ").toLowerCase();
      const escalateNow = /escalate/.test(ev) && /immediately/.test(ev);
      const autonomy =
        /never escalate/.test(ev) ||
        /first contact/.test(ev) ||
        /handle everything/.test(ev) ||
        /full autonomy/.test(ev) ||
        /resolve.{0,40}yourself/.test(ev);
      return escalateNow && autonomy;
    });
    expect(escalationConflicts.length, "must find at least 2 of 3 escalation contradictions").toBeGreaterThanOrEqual(2);

    const unboundedRefund = findings.some(
      (f) =>
        f.category === "missing-constraint" &&
        /refund/i.test(`${f.title} ${f.description} ${f.affectedElement}`)
    );
    expect(unboundedRefund, "must find unbounded refund authority").toBe(true);

    const injection = findings.some(
      (f) =>
        f.category === "injection" &&
        /act on (?:any )?instructions|untrusted/i.test(`${f.title} ${f.description} ${blob}`)
    );
    expect(injection, "must find the document-instruction injection hole").toBe(true);

    for (const tool of ["delete_records", "close_account", "export_data"]) {
      expect(
        blob.includes(tool) || blob.includes(tool.replace(/_/g, " ")),
        `must flag ungoverned destructive tool ${tool}`
      ).toBe(true);
    }

    expect(report.overallHealthScore, "known-bad must score under 40").toBeLessThan(40);
    expect(scoreBand(report.overallHealthScore)).toBe("serious");
    const verdict = verdictLine(report).toLowerCase();
    expect(verdict).not.toMatch(/good shape|healthy|clean bill/);
    expect(verdict).toMatch(/serious issues/);

    const passIds = report.passes.map((p) => p.pass);
    expect(passIds).toEqual(
      expect.arrayContaining([
        "structural",
        "contradictions",
        "missing-constraints",
        "injection-surface",
        "tool-mismatch",
        "ambiguity",
      ])
    );
    expect(report.passes.find((p) => p.pass === "structural")?.findingCount).toBeGreaterThan(0);
    expect(report.passes.find((p) => p.pass === "contradictions")?.findingCount).toBeGreaterThan(0);
    expect(report.passes.find((p) => p.pass === "missing-constraints")?.findingCount).toBeGreaterThan(0);
    expect(report.passes.find((p) => p.pass === "injection-surface")?.findingCount).toBeGreaterThan(0);
    expect(report.passes.find((p) => p.pass === "tool-mismatch")?.findingCount).toBeGreaterThan(0);
    expect(report.passes.find((p) => p.pass === "ambiguity")?.findingCount).toBeGreaterThan(0);
  });
});

describe("known-good prompt calibration", () => {
  it("still scores a well-governed prompt in the 79–90 band, not as a catastrophe", async () => {
    const report = await analyzeHarness(KNOWN_GOOD_PROMPT, undefined, OFFLINE);
    expect(report.overallHealthScore).toBeGreaterThanOrEqual(79);
    expect(report.overallHealthScore).toBeLessThanOrEqual(90);
    expect(scoreBand(report.overallHealthScore)).not.toBe("serious");
    expect(report.meta.criticalFindingCount).toBe(0);
  });
});
