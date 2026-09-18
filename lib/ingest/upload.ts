/**
 * Turn an uploaded zip or file list into a MemoryRepo.
 */

import { unzipSync } from "fflate";
import { MemoryRepo, isSkippedPath, normalizePath } from "./files";
import type { IngestionSource } from "./types";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_FILES = 2_000;
const MAX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;
const MAX_ZIP_FILE_BYTES = 800_000;

export class UploadIngestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadIngestError";
    this.status = status;
  }
}

export type UploadedFile = {
  path: string;
  contents: Uint8Array | string;
};

function decodeText(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  // skip obvious binaries
  const sample = bytes.subarray(0, Math.min(bytes.length, 800));
  let nul = 0;
  for (const b of sample) if (b === 0) nul += 1;
  if (nul > 2) return null;
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function stripCommonRoot(paths: string[]): string {
  if (paths.length === 0) return "";
  const split = paths.map((p) => p.split("/").filter(Boolean));
  const first = split[0];
  let i = 0;
  while (i < first.length - 1 && split.every((p) => p[i] === first[i])) i += 1;
  return i > 0 ? first.slice(0, i).join("/") : "";
}

export function filesFromZip(bytes: Uint8Array): Record<string, string> {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch {
    throw new UploadIngestError("Could not read that zip file.");
  }
  const names = Object.keys(unzipped).filter((n) => !n.endsWith("/") && !isSkippedPath(n));
  const root = stripCommonRoot(names.map(normalizePath));
  const files: Record<string, string> = {};
  let uncompressed = 0;
  for (const [rawName, data] of Object.entries(unzipped)) {
    if (rawName.endsWith("/")) continue;
    uncompressed += data.byteLength;
    if (uncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new UploadIngestError("Unzipped contents are too large. Zip just the agent directory.");
    }
    if (data.byteLength > MAX_ZIP_FILE_BYTES) continue;
    let path = normalizePath(rawName);
    if (root && path === root) continue;
    if (root && path.startsWith(`${root}/`)) path = path.slice(root.length + 1);
    if (!path || isSkippedPath(path)) continue;
    const text = decodeText(data);
    if (text == null) continue;
    files[path] = text;
    if (Object.keys(files).length >= MAX_UPLOAD_FILES) break;
  }
  return files;
}

export function loadUploadedFiles(uploads: UploadedFile[], subdir?: string): { repo: MemoryRepo; source: IngestionSource } {
  const files: Record<string, string> = {};
  let total = 0;
  for (const file of uploads) {
    const path = normalizePath(file.path);
    if (!path) continue;
    const bytes = typeof file.contents === "string" ? new TextEncoder().encode(file.contents) : file.contents;
    total += bytes.byteLength;
    if (total > MAX_UPLOAD_BYTES) {
      throw new UploadIngestError("Upload is too large (max 15 MB). Zip just the agent directory.");
    }
    if (path.toLowerCase().endsWith(".zip")) {
      Object.assign(files, filesFromZip(bytes));
      continue;
    }
    if (isSkippedPath(path)) continue;
    const text = decodeText(bytes);
    if (text == null) continue;
    files[path] = text;
  }
  if (Object.keys(files).length === 0) {
    throw new UploadIngestError("No readable source files in that upload.");
  }
  return {
    repo: new MemoryRepo(files),
    source: {
      kind: "upload",
      label: `upload (${Object.keys(files).length} files)`,
      subdir: subdir ? normalizePath(subdir) : undefined,
    },
  };
}
