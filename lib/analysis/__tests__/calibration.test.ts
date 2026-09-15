import { describe, expect, it } from "vitest";
import { analyzeHarness } from "@/lib/analysis/engine";
import { scoreBand } from "@/lib/format";
import {
  HEALTHCARE_CLEAN_PROMPT,
  KNOWN_BAD_PROMPT,
  KNOWN_DISASTER_C_PROMPT,
  KNOWN_GOOD_PROMPT,
  MEDIOCRE_DENSITY_PROMPT,
  MEDIOCRE_HEAVY_VAGUE_PROMPT,
  MEDIOCRE_LIGHT_PROMPT,
  MEDIOCRE_STYLE_COLLISION_PROMPT,
  MEDIOCRE_WRITE_NO_HANDOFF_PROMPT,
  MEDIOCRE_WRITE_STALE_PROMPT,
} from "./fixtures";

const OFFLINE = { modelAvailable: false as const };

type Scored = {
  name: string;
  score: number;
  band: ReturnType<typeof scoreBand>;
  criticals: number;
  warnings: number;
  infos: number;
  na: string[];
  scored: string[];
};

async function scorePrompt(name: string, prompt: string): Promise<Scored> {
  const report = await analyzeHarness(prompt, undefined, OFFLINE);
  const findings = report.components.flatMap((c) => c.findings);
  return {
    name,
    score: report.overallHealthScore,
    band: scoreBand(report.overallHealthScore),
    criticals: findings.filter((f) => f.severity === "critical").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
    na: report.components.filter((c) => c.status === "not_applicable").map((c) => c.component),
    scored: report.components
      .filter((c) => c.status === "scored")
      .map((c) => `${c.component}:${c.healthScore}`),
  };
}

function dump(rows: Scored[]) {
  return rows
    .map(
      (r) =>
        `${r.name}: ${r.score} (${r.band}) crit=${r.criticals} warn=${r.warnings} info=${r.infos} scored=[${r.scored.join(", ")}] na=[${r.na.join(", ")}]`
    )
    .join("\n");
}

describe("5-prompt regression bands", () => {
  it("spreads clean, disasters, and known-good into the right bands", async () => {
    const rows = await Promise.all([
      scorePrompt("A healthcare", HEALTHCARE_CLEAN_PROMPT),
      scorePrompt("B disaster", KNOWN_BAD_PROMPT),
      scorePrompt("C disaster", KNOWN_DISASTER_C_PROMPT),
      scorePrompt("D known-good", KNOWN_GOOD_PROMPT),
      scorePrompt("E mediocre-light", MEDIOCRE_LIGHT_PROMPT),
    ]);

    const a = rows[0];
    const b = rows[1];
    const c = rows[2];
    const d = rows[3];
    const e = rows[4];

    expect(a.score, dump(rows)).toBeGreaterThanOrEqual(79);
    expect(a.score, dump(rows)).toBeLessThanOrEqual(90);
    expect(a.criticals, dump(rows)).toBe(0);
    expect(a.na, dump(rows)).toEqual(expect.arrayContaining(["knowledge", "memory"]));
    expect(a.scored.some((s) => s.startsWith("guardrails:100")), dump(rows)).toBe(true);

    expect(b.score, dump(rows)).toBeLessThan(45);
    expect(c.score, dump(rows)).toBeLessThan(45);

    expect(d.score, dump(rows)).toBeGreaterThanOrEqual(79);
    expect(d.score, dump(rows)).toBeLessThanOrEqual(90);
    expect(d.criticals, dump(rows)).toBe(0);

    expect(e.criticals, dump(rows)).toBe(0);
    expect(e.score, dump(rows)).toBeGreaterThanOrEqual(55);
    expect(e.score, dump(rows)).toBeLessThanOrEqual(89);
  });
});

describe("mediocre prompt spread", () => {
  it("scores 5–6 flawed-but-not-critical prompts across 55–78 instead of clustering", async () => {
    const rows = await Promise.all([
      scorePrompt("light", MEDIOCRE_LIGHT_PROMPT),
      scorePrompt("density", MEDIOCRE_DENSITY_PROMPT),
      scorePrompt("write-stale", MEDIOCRE_WRITE_STALE_PROMPT),
      scorePrompt("style-collision", MEDIOCRE_STYLE_COLLISION_PROMPT),
      scorePrompt("heavy-vague", MEDIOCRE_HEAVY_VAGUE_PROMPT),
      scorePrompt("write-no-handoff", MEDIOCRE_WRITE_NO_HANDOFF_PROMPT),
    ]);

    for (const row of rows) {
      expect(row.criticals, dump(rows)).toBe(0);
    }

    const inBand = rows.filter((r) => r.score >= 55 && r.score <= 78);
    expect(inBand.length, dump(rows)).toBeGreaterThanOrEqual(5);

    const scores = rows.map((r) => r.score).sort((a, b) => a - b);
    const spread = scores[scores.length - 1] - scores[0];
    expect(spread, dump(rows)).toBeGreaterThanOrEqual(10);

    // Three different mediocre prompts must not sit within 3 points of each other
    // at the same number — if the tightest trio is that close, deductions are flat.
    let tightTrios = 0;
    for (let i = 0; i < scores.length - 2; i++) {
      if (scores[i + 2] - scores[i] <= 3) tightTrios += 1;
    }
    expect(tightTrios, dump(rows)).toBe(0);
  });
});

describe("hand-ranking gut check", () => {
  it("ranks five prompts the same way a human would", async () => {
    // Predicted order, best → worst, before looking at scores:
    // 1. healthcare clean — governed tools, guardrails, escalation, no fossils
    // 2. mediocre light — same bones plus fossils / vague style
    // 3. style collision — plus a concise-vs-thorough contradiction
    // 4. write-no-handoff — write access, no escalation, stale knowledge
    // 5. known-bad — critical contradictions, injection, ungoverned destroy tools
    const rows = await Promise.all([
      scorePrompt("healthcare", HEALTHCARE_CLEAN_PROMPT),
      scorePrompt("light", MEDIOCRE_LIGHT_PROMPT),
      scorePrompt("style-collision", MEDIOCRE_STYLE_COLLISION_PROMPT),
      scorePrompt("write-no-handoff", MEDIOCRE_WRITE_NO_HANDOFF_PROMPT),
      scorePrompt("known-bad", KNOWN_BAD_PROMPT),
    ]);

    const byName = Object.fromEntries(rows.map((r) => [r.name, r.score]));
    expect(byName.healthcare, dump(rows)).toBeGreaterThan(byName.light);
    expect(byName.light, dump(rows)).toBeGreaterThan(byName["style-collision"]);
    expect(byName["style-collision"], dump(rows)).toBeGreaterThan(byName["write-no-handoff"]);
    expect(byName["write-no-handoff"], dump(rows)).toBeGreaterThan(byName["known-bad"]);
  });
});
