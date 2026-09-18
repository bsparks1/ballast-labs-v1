import { NextResponse } from "next/server";
import { isModelAvailable } from "@/lib/analysis/model";
import { GitHubIngestError, loadGitHubRepo } from "@/lib/ingest/github";
import { ingestRepo, IngestUserError } from "@/lib/ingest/ingest";
import { loadUploadedFiles, MAX_UPLOAD_BYTES, UploadIngestError } from "@/lib/ingest/upload";
import type { IngestionSource, RepoFileAccess } from "@/lib/ingest/types";

export const maxDuration = 300;

const MAX_BODY = 20 * 1024 * 1024;

async function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

async function ingestFromParts(input: {
  url?: string;
  subdir?: string;
  analyze: boolean;
  supplemental?: string;
  uploads?: { path: string; contents: Uint8Array }[];
}) {
  let files: RepoFileAccess;
  let source: IngestionSource;

  if (input.uploads && input.uploads.length > 0) {
    const loaded = loadUploadedFiles(input.uploads, input.subdir);
    files = loaded.repo;
    source = loaded.source;
    if (input.url) source.url = input.url;
  } else if (input.url) {
    const repo = await loadGitHubRepo(input.url, input.subdir);
    files = repo;
    source = repo.source;
    const listed = await repo.listFiles();
    const warnings: string[] = [];
    if (repo.truncated) {
      warnings.push("GitHub truncated the file tree. Point at the agent subdirectory.");
    }
    if (repo.repoSizeKb > 80_000) {
      warnings.push("This repository is large. Extraction is convention-based and may be incomplete.");
    }
    if (listed.length === 0) {
      throw new GitHubIngestError("No readable files under that path. Check the subdirectory.", 404);
    }
    source = { ...source, warnings };
  } else {
    throw new UploadIngestError("Provide a GitHub URL or upload files.");
  }

  return ingestRepo({
    files,
    source,
    supplemental: input.supplemental,
    analyze: input.analyze,
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const url = String(form.get("url") ?? "").trim() || undefined;
      const subdir = String(form.get("subdir") ?? "").trim() || undefined;
      const supplemental = String(form.get("supplemental") ?? "").trim() || undefined;
      const analyze = String(form.get("analyze") ?? "true") !== "false";
      const uploads: { path: string; contents: Uint8Array }[] = [];
      let uploadBytes = 0;
      for (const [key, value] of form.entries()) {
        if (key !== "files" && key !== "file") continue;
        if (typeof value === "string") continue;
        const file = value as File;
        uploadBytes += file.size;
        if (uploadBytes > MAX_UPLOAD_BYTES) {
          return jsonError("Upload is too large (max 15 MB). Zip just the agent directory.", 413);
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        const path = file.webkitRelativePath || file.name;
        uploads.push({ path, contents: buf });
      }
      if (analyze && !isModelAvailable()) {
        return jsonError(
          "ANTHROPIC_API_KEY is required to finish analysis. Add it to .env.local and restart the dev server — Ballast will not return a partial report.",
          503
        );
      }
      const result = await ingestFromParts({ url, subdir, analyze, supplemental, uploads: uploads.length ? uploads : undefined });
      return NextResponse.json({
        prompt: result.prompt,
        config: result.config,
        coverage: result.coverage,
        adapter: result.model.metadata.adapter,
        framework: result.model.metadata.framework,
        language: result.model.metadata.language,
        report: result.report,
      });
    }

    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY) return jsonError("Request is too large.", 413);
    let body: { url?: unknown; subdir?: unknown; analyze?: unknown; supplemental?: unknown };
    try {
      body = JSON.parse(new TextDecoder().decode(raw)) as typeof body;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const subdir = typeof body.subdir === "string" ? body.subdir.trim() : undefined;
    const supplemental = typeof body.supplemental === "string" ? body.supplemental : undefined;
    const analyze = body.analyze !== false;
    if (!url) return jsonError("url is required", 400);
    if (analyze && !isModelAvailable()) {
      return jsonError(
        "ANTHROPIC_API_KEY is required to finish analysis. Add it to .env.local and restart the dev server — Ballast will not return a partial report.",
        503
      );
    }
    const result = await ingestFromParts({ url, subdir, analyze, supplemental });
    return NextResponse.json({
      prompt: result.prompt,
      config: result.config,
      coverage: result.coverage,
      adapter: result.model.metadata.adapter,
      framework: result.model.metadata.framework,
      language: result.model.metadata.language,
      report: result.report,
    });
  } catch (err) {
    if (err instanceof GitHubIngestError || err instanceof UploadIngestError || err instanceof IngestUserError) {
      return jsonError(err.message, err.status, "code" in err && err.code ? { code: err.code } : undefined);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ballast:ingest] failed", err);
    return jsonError(`Ingestion failed: ${message}`, 502);
  }
}
