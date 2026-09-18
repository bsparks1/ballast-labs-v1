import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../files";
import { ingestRepo } from "../ingest";
import { detectFramework } from "../registry";
import { parseGitHubUrl } from "../github";
import { assembleHarness, attachIngestionMeta, parseBallastMeta } from "../assemble";
import { loadUploadedFiles } from "../upload";
import { zipSync } from "fflate";
import {
  AGENT_SERVICE_TOOLKIT,
  COOKBOOK_PARTIAL,
  HIA_NO_MANIFEST,
  LARGE_MONOREPO,
  MINIMAL_HOMEGROWN,
  NOTEBOOK_AGENT,
  PDF_CHATBOT_TS,
} from "./fixtures";

const source = { kind: "memory" as const, label: "fixture" };

describe("parseGitHubUrl", () => {
  it("parses owner/repo, tree URLs, and subdirs", () => {
    expect(parseGitHubUrl("https://github.com/acme/agent")).toMatchObject({ owner: "acme", repo: "agent" });
    expect(parseGitHubUrl("acme/agent")).toMatchObject({ owner: "acme", repo: "agent" });
    expect(parseGitHubUrl("https://github.com/acme/agent/tree/main/backend")).toMatchObject({
      owner: "acme",
      repo: "agent",
      ref: "main",
      subdir: "backend",
    });
  });
});

describe("detectFramework", () => {
  it("selects LangGraph when langgraph.json is present", async () => {
    const { adapter, score } = await detectFramework(new MemoryRepo(AGENT_SERVICE_TOOLKIT));
    expect(adapter.id).toBe("langgraph");
    expect(score).toBe(1);
  });

  it("selects LangGraph from langchain/langgraph dependencies without a manifest", async () => {
    const { adapter } = await detectFramework(new MemoryRepo(HIA_NO_MANIFEST));
    expect(adapter.id).toBe("langgraph");
  });

  it("falls back to generic for homegrown agents", async () => {
    const { adapter } = await detectFramework(new MemoryRepo(MINIMAL_HOMEGROWN));
    expect(adapter.id).toBe("generic");
  });
});

describe("LangGraph adapter — Python", () => {
  it("extracts prompts, tools, graphs, knowledge, and memory from an agent-service-toolkit-style repo", async () => {
    const result = await ingestRepo({ files: new MemoryRepo(AGENT_SERVICE_TOOLKIT), source, analyze: false });
    expect(result.model.metadata.adapter).toBe("langgraph");
    expect(result.model.instructions.length).toBeGreaterThanOrEqual(2);
    expect(result.model.instructions.some((p) => /research assistant/i.test(p.text))).toBe(true);
    expect(result.model.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["web_search", "fetch_url", "delete_index", "Calculator"])
    );
    expect(result.model.tools.find((t) => t.name === "web_search")?.description).toMatch(/search the public web/i);
    expect(result.model.delegation?.graphs.map((g) => g.name)).toEqual(
      expect.arrayContaining(["research_assistant", "supervisor"])
    );
    expect(result.model.knowledge.map((k) => k.name)).toEqual(
      expect.arrayContaining(["OpenAI", "Tavily", "Pinecone", "LangSmith"])
    );
    expect(result.model.memory?.checkpointer).toBe("MemorySaver");
    expect(result.model.memory?.model).toBe("gpt-4o");

    const byComp = Object.fromEntries(result.coverage.components.map((c) => [c.component, c.status]));
    expect(byComp.instructions).toBe("extracted");
    expect(byComp.tools).toBe("extracted");
    expect(byComp.delegation).toBe("extracted");
    expect(byComp.knowledge).toMatch(/extracted|partial/);
    expect(result.coverage.summary).toMatch(/extracted/i);
    expect(result.prompt).toMatch(/research assistant/i);
    const config = JSON.parse(result.config);
    expect(config.tools.some((t: { name: string }) => t.name === "delete_index")).toBe(true);
    expect(parseBallastMeta(result.config)?.adapter).toBe("langgraph");
  });

  it("extracts from a no-manifest LangGraph repo (hia-style)", async () => {
    const result = await ingestRepo({ files: new MemoryRepo(HIA_NO_MANIFEST), source, analyze: false });
    expect(result.model.metadata.adapter).toBe("langgraph");
    expect(result.model.instructions.some((p) => /HIA/i.test(p.text))).toBe(true);
    expect(result.model.tools.map((t) => t.name)).toContain("send_email");
    expect(result.coverage.components.find((c) => c.component === "delegation")?.status).not.toBe("extracted");
  });
});

describe("LangGraph adapter — TypeScript", () => {
  it("extracts prompts, tools, and retrievers from a LangGraph.js repo", async () => {
    const result = await ingestRepo({ files: new MemoryRepo(PDF_CHATBOT_TS), source, analyze: false });
    expect(result.model.metadata.adapter).toBe("langgraph");
    expect(result.model.metadata.language).toMatch(/typescript|mixed/);
    expect(result.model.instructions.some((p) => /PDF research assistant/i.test(p.text))).toBe(true);
    expect(result.model.tools.map((t) => t.name)).toContain("searchDocs");
    expect(result.model.knowledge.some((k) => /pinecone/i.test(k.name))).toBe(true);
    expect(result.model.memory?.checkpointer).toBe("MemorySaver");
    expect(result.model.delegation?.graphs[0]?.name).toBe("agent");
  });
});

describe("graceful degradation", () => {
  it("treats a notebook agent as partial, not a crash", async () => {
    const result = await ingestRepo({ files: new MemoryRepo(NOTEBOOK_AGENT), source, analyze: false });
    expect(result.model.instructions.some((p) => /financial research/i.test(p.text))).toBe(true);
    expect(result.model.tools.map((t) => t.name)).toContain("get_price");
  });

  it("reports mostly missing coverage on a homegrown agent", async () => {
    const result = await ingestRepo({ files: new MemoryRepo(MINIMAL_HOMEGROWN), source, analyze: false });
    expect(result.model.metadata.adapter).toBe("generic");
    const extracted = result.coverage.components.filter((c) => c.status === "extracted");
    expect(extracted.length).toBeLessThanOrEqual(1);
    expect(result.coverage.summary).toMatch(/could not automatically extract|weren't found|wasn't found/i);
  });

  it("does not hang on a large monorepo and reports low coverage", async () => {
    const started = Date.now();
    const result = await ingestRepo({ files: new MemoryRepo(LARGE_MONOREPO), source, analyze: false });
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(result.coverage.warnings.join(" ")).toMatch(/monorepo|large tree|subdirectory/i);
    expect(result.model.instructions).toHaveLength(0);
    expect(result.coverage.components.every((c) => c.status !== "extracted" || c.component === "instructions")).toBe(true);
  });

  it("handles a cookbook-style partial repo", async () => {
    const result = await ingestRepo({ files: new MemoryRepo(COOKBOOK_PARTIAL), source, analyze: false });
    expect(result.coverage.components.find((c) => c.component === "tools")?.status).toBe("not_found");
  });
});

describe("assemble + analysis plumbing", () => {
  it("keeps extraction metadata on the config so re-analysis can reattach coverage", async () => {
    const extracted = await ingestRepo({ files: new MemoryRepo(AGENT_SERVICE_TOOLKIT), source, analyze: false });
    const assembled = assembleHarness(extracted.model, source, extracted.coverage);
    const fakeReport = {
      overallHealthScore: 50,
      components: [],
      passes: [],
      meta: {
        instructionCount: 1,
        absoluteRuleCount: 0,
        fossilCount: 0,
        verifiedConflictCount: 0,
        criticalFindingCount: 0,
        createdAt: "2026-09-16T00:00:00.000Z",
      },
    };
    const attached = attachIngestionMeta(fakeReport, assembled.config);
    expect(attached.meta.ingestion?.coverage.adapter).toBe("langgraph");
    expect(attached.meta.ingestion?.source.label).toBe("fixture");
  });
});

describe("upload zip", () => {
  it("unzips into a MemoryRepo and strips a common root folder", async () => {
    const zipped = zipSync({
      "repo/langgraph.json": new TextEncoder().encode(AGENT_SERVICE_TOOLKIT["langgraph.json"]),
      "repo/src/tools.py": new TextEncoder().encode(AGENT_SERVICE_TOOLKIT["src/tools.py"]),
    });
    const { repo } = loadUploadedFiles([{ path: "agent.zip", contents: zipped }]);
    const listed = await repo.listFiles();
    expect(listed).toEqual(expect.arrayContaining(["langgraph.json", "src/tools.py"]));
  });
});

describe("analysis must not score a placeholder or assembled tool list", () => {
  it("refuses to analyze when no system prompt was extracted", async () => {
    await expect(
      ingestRepo({
        files: new MemoryRepo({ "main.py": "print('hello')\n" }),
        source,
        analyze: true,
        analyzeOptions: { modelAvailable: false },
      })
    ).rejects.toMatchObject({
      name: "IngestUserError",
      message: expect.stringMatching(/couldn't find an agent configuration/i),
    });
  });

  it("does not treat extracted tool lists as instruction-level governance", async () => {
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
      analyzeOptions: { modelAvailable: false },
    });
    expect(result.prompt).not.toMatch(/delete_records/);
    const blob = (result.report?.components ?? [])
      .flatMap((c) => c.findings)
      .map((f) => `${f.title} ${f.affectedElement}`)
      .join("\n");
    expect(blob).toMatch(/delete_records/);
  });
});
