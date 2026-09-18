import { describe, expect, it } from "vitest";
import { analyzeHarness } from "@/lib/analysis/engine";
import { findContradictions } from "@/lib/analysis/passes/contradictions";
import { INCOMPLETE_ANALYSIS_CAP } from "@/lib/analysis/scoring";
import { runStructuralAnalysis } from "@/lib/analysis/structural";
import { analysisIncomplete } from "@/lib/format";
import { assemblePrompt } from "@/lib/ingest/assemble";
import { emptyModel } from "@/lib/ingest/coverage";
import { MemoryRepo } from "@/lib/ingest/files";
import {
  ingestRepo,
  IngestUserError,
  NO_ANALYZABLE_HARNESS_CODE,
  NO_ANALYZABLE_HARNESS_MESSAGE,
} from "@/lib/ingest/ingest";
import { loadUploadedFiles } from "@/lib/ingest/upload";
import {
  HEALTHCARE_CLEAN_PROMPT,
  KNOWN_BAD_PROMPT,
  KNOWN_DISASTER_C_PROMPT,
  KNOWN_GOOD_PROMPT,
  MEDIOCRE_STYLE_COLLISION_PROMPT,
} from "./fixtures";

const OFFLINE = { modelAvailable: false as const };
const source = { kind: "memory" as const, label: "fixture" };

function allFindings(report: Awaited<ReturnType<typeof analyzeHarness>>) {
  return report.components.flatMap((c) => c.findings);
}

describe("integrity fail-closed", () => {
  it("ingesting a repo or upload with no extractable prompt returns no analyzable harness and no score", async () => {
    const repoFiles = new MemoryRepo({ "main.py": "print('hello')\n" });
    const preview = await ingestRepo({ files: repoFiles, source, analyze: false });
    expect(preview.prompt).toBe("");
    expect(preview.prompt).not.toMatch(/Ballast repo ingestion|No system prompt was extracted|Add the agent's instructions/i);
    expect(preview.report).toBeUndefined();

    const toolsOnly = emptyModel("python", "generic", "Unknown", "fixture");
    toolsOnly.tools = [
      { name: "delete_records", permissions: ["delete"], exercised: "unknown", source: "main.py" },
    ];
    const assembled = assemblePrompt(toolsOnly);
    expect(assembled).toBe("");
    expect(assembled).not.toMatch(/delete_records|You have access to the following tools/i);

    await expect(
      ingestRepo({ files: repoFiles, source, analyze: true, analyzeOptions: OFFLINE })
    ).rejects.toMatchObject({
      name: "IngestUserError",
      code: NO_ANALYZABLE_HARNESS_CODE,
      message: NO_ANALYZABLE_HARNESS_MESSAGE,
    });

    const uploaded = loadUploadedFiles([{ path: "readme.md", contents: "hello from an upload\n" }]);
    const uploadPreview = await ingestRepo({
      files: uploaded.repo,
      source: uploaded.source,
      analyze: false,
    });
    expect(uploadPreview.prompt).toBe("");
    expect(uploadPreview.report).toBeUndefined();
    await expect(
      ingestRepo({
        files: uploaded.repo,
        source: uploaded.source,
        analyze: true,
        analyzeOptions: OFFLINE,
      })
    ).rejects.toBeInstanceOf(IngestUserError);
    await expect(
      ingestRepo({
        files: uploaded.repo,
        source: uploaded.source,
        analyze: true,
        analyzeOptions: OFFLINE,
      })
    ).rejects.toMatchObject({
      code: NO_ANALYZABLE_HARNESS_CODE,
      message: NO_ANALYZABLE_HARNESS_MESSAGE,
    });
  });

  it("a repo with tools that have no governing rules produces tool-mismatch findings", async () => {
    const files = new MemoryRepo({
      "agent.py": `from langchain_core.tools import tool

@tool
def delete_records(table: str) -> str:
    """Delete rows from a table."""
    return "ok"

SYSTEM_PROMPT = """You are a research assistant. Answer questions using retrieved context. Be concise and cite sources when you have them. Never invent citations."""
`,
    });
    const result = await ingestRepo({
      files,
      source,
      analyze: true,
      analyzeOptions: OFFLINE,
    });
    expect(result.prompt).not.toMatch(/delete_records|You have access to the following tools/i);
    expect(result.report).toBeDefined();
    const findings = allFindings(result.report!);
    const mismatch = findings.filter((f) => f.category === "tool-mismatch");
    expect(mismatch.some((f) => /delete_records/i.test(`${f.title} ${f.affectedElement}`))).toBe(true);
    const tools = result.report!.components.find((c) => c.component === "tools");
    expect(tools?.healthScore).toBeLessThan(100);
  });

  it("a failed model pass is never ok and caps overall below the clean band as incomplete", async () => {
    const report = await analyzeHarness(KNOWN_GOOD_PROMPT, undefined, {
      modelAvailable: true,
      callModel: async () => {
        throw new Error("model down");
      },
    });
    const panel = report.passes.filter((p) => p.pass !== "structural");
    expect(panel.length).toBeGreaterThan(0);
    expect(panel.every((p) => p.status === "error" || p.status === "partial")).toBe(true);
    expect(panel.every((p) => p.status !== "ok")).toBe(true);
    expect(panel.some((p) => p.status === "error" || p.status === "partial")).toBe(true);
    expect(analysisIncomplete(report)).toBe(true);
    expect(report.overallHealthScore).toBeLessThanOrEqual(INCOMPLETE_ANALYSIS_CAP);
    expect(report.overallHealthScore).toBeLessThan(90);
  });

  it("verifier failure keeps known-bad lexical contradictions", async () => {
    const structural = runStructuralAnalysis(KNOWN_BAD_PROMPT);
    const base = {
      instructions: structural.instructions,
      tools: structural.tools,
      rawPrompt: KNOWN_BAD_PROMPT,
      modelAvailable: true as const,
    };

    const garbage = await findContradictions({
      ...base,
      callModel: async (pass) => {
        if (pass.includes("verify")) return "not-json";
        return JSON.stringify({ candidates: [] });
      },
    });
    const rejected = await findContradictions({
      ...base,
      callModel: async (pass) => {
        if (pass.includes("verify")) {
          return JSON.stringify({ verdict: "rejected", explanation: "fine", recommendation: "" });
        }
        return JSON.stringify({ candidates: [] });
      },
    });

    for (const result of [garbage, rejected]) {
      const conciseVsThorough = result.findings.some(
        (f) =>
          f.category === "contradiction" &&
          (f.evidence ?? []).some((e) => /concise/i.test(e)) &&
          (f.evidence ?? []).some((e) => /thorough|detailed/i.test(e))
      );
      expect(conciseVsThorough).toBe(true);
    }
  });

  it("known-prompt fixtures still land in their expected score bands", async () => {
    const healthcare = await analyzeHarness(HEALTHCARE_CLEAN_PROMPT, undefined, OFFLINE);
    const knownGood = await analyzeHarness(KNOWN_GOOD_PROMPT, undefined, OFFLINE);
    const knownBad = await analyzeHarness(KNOWN_BAD_PROMPT, undefined, OFFLINE);
    const disasterC = await analyzeHarness(KNOWN_DISASTER_C_PROMPT, undefined, OFFLINE);
    const styleCollision = await analyzeHarness(MEDIOCRE_STYLE_COLLISION_PROMPT, undefined, OFFLINE);

    expect(healthcare.overallHealthScore).toBeGreaterThanOrEqual(79);
    expect(healthcare.overallHealthScore).toBeLessThanOrEqual(90);
    expect(knownGood.overallHealthScore).toBeGreaterThanOrEqual(79);
    expect(knownGood.overallHealthScore).toBeLessThanOrEqual(90);
    expect(knownBad.overallHealthScore).toBeLessThan(45);
    expect(disasterC.overallHealthScore).toBeLessThan(45);
    expect(styleCollision.overallHealthScore).toBeLessThanOrEqual(90);
  });
});
