import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { harnessSnapshotSchema } from "@/lib/snapshot/schema";
import { snapshotCoverage } from "@/lib/snapshot/types";

const fixturesDir = path.resolve(__dirname, "../../../schemas/fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"));
}

describe("HarnessSnapshot contract", () => {
  it("accepts the committed observed fixture", () => {
    const raw = loadFixture("snapshot.observed.json");
    const parsed = harnessSnapshotSchema.parse(raw);
    expect(parsed.snapshot_id).toBe("fixture-observed-001");
    expect(parsed.source).toBe("sdk");
    expect(parsed.tools.bound_tools).toHaveLength(2);
    expect(parsed.tools.bound_tools.some((t) => t.invoked)).toBe(true);
    expect(parsed.tools.bound_tools.some((t) => !t.invoked)).toBe(true);
    const cov = snapshotCoverage(parsed);
    for (const status of Object.values(cov)) {
      expect(status).toBe("observed");
    }
  });

  it("accepts the partial fixture and keeps not_observed distinct", () => {
    const raw = loadFixture("snapshot.partial.json");
    const parsed = harnessSnapshotSchema.parse(raw);
    const cov = snapshotCoverage(parsed);
    expect(cov.instructions).toBe("observed");
    expect(cov.tools).toBe("not_observed");
    expect(cov.memory).toBe("not_observed");
    expect(cov.guardrails).toBe("not_observed");
    expect(cov.not_observed as unknown).toBeUndefined();
    for (const [key, status] of Object.entries(cov)) {
      if (key === "instructions") continue;
      expect(status).toBe("not_observed");
      expect(status).not.toBe("observed");
      expect(status).not.toBe("absent");
    }
  });

  it("rejects payloads missing required status (fail closed)", () => {
    const raw = loadFixture("snapshot.observed.json") as Record<string, unknown>;
    const broken = {
      ...raw,
      memory: { store: "redis", keys_read: [] },
    };
    const result = harnessSnapshotSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("never treats not_observed as a clean default when status omitted on root component", () => {
    const result = harnessSnapshotSchema.safeParse({
      snapshot_id: "x",
      agent_id: "a",
      captured_at: "2026-09-29T20:00:00Z",
      source: "sdk",
      instructions: { status: "observed" },
      tools: { status: "observed", bound_tools: [] },
      knowledge: { status: "observed", sources_hit: [], retrieval_config: {} },
      memory: {},
      guardrails: { status: "absent" },
      delegation: { status: "not_observed" },
    });
    expect(result.success).toBe(false);
  });
});
