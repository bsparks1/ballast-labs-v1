/**
 * In-memory repo access plus shared file-selection limits.
 * Adapters and source loaders both use these conventions so a 50k-file
 * monorepo cannot hang the ingest path.
 */

import type { RepoFileAccess } from "./types";

export const MAX_LISTED_FILES = 8_000;
export const MAX_READ_FILES = 80;
export const MAX_FILE_BYTES = 200_000;
export const MONOREPO_FILE_THRESHOLD = 800;
export const SHALLOW_DEPTH = 3;

const SKIP_DIR_RE =
  /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|__pycache__|\.venv|venv|\.tox|\.mypy_cache|\.ruff_cache|\.turbo|\.cache|vendor|target|\.yarn|\.pnpm-store|tests|__tests__|e2e|cypress|playwright)(\/|$)/i;

const SKIP_FILE_RE =
  /\.(lock|min\.js|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|pyc|so|dylib|bin|exe|zip|tar|gz|tgz|whl|mp4|mov|wav|mp3)$/i;

const SKIP_NAME_RE =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|uv\.lock|poetry\.lock|Cargo\.lock|composer\.lock|\.DS_Store|test_.+\.(py|ts|js)|.+\.test\.(ts|tsx|js|jsx)|.+\.spec\.(ts|tsx|js|jsx))$/i;

/** Files that are always worth reading when present. */
export const CONVENTION_FILE_RE =
  /(^|\/)(langgraph\.json|\.env\.example|\.env\.sample|\.env\.template|\.env\.local\.example|configuration\.(py|ts|js)|config\.(py|ts|js)|render\.ya?ml|pyproject\.toml|package\.json|requirements\.txt)$/i;

export const PROMPT_FILE_RE = /(^|\/)[^/]*prompt[^/]*\.(py|ts|tsx|js|jsx)$/i;
export const TOOL_FILE_RE = /(^|\/)tools?\.(py|ts|tsx|js|jsx)$/i;
export const TOOL_DIR_RE = /(^|\/)tools\/.+\.(py|ts|tsx|js|jsx)$/i;
export const AGENT_ENTRY_RE =
  /(^|\/)(agent|graph|main|app|index|workflow|supervisor|assistant)\.(py|ts|tsx|js|jsx)$/i;
export const NOTEBOOK_RE = /\.ipynb$/i;
export const SOURCE_RE = /\.(py|ts|tsx|js|jsx|ipynb)$/i;

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\//, "");
}

export function posixJoin(...parts: string[]): string {
  const tokens: string[] = [];
  for (const [i, part] of parts.entries()) {
    const n = part.replace(/\\/g, "/");
    const cleaned = i === 0 ? n.replace(/\/+$/, "") : n.replace(/^\/+|\/+$/g, "");
    for (const token of cleaned.split("/")) {
      if (!token || token === ".") continue;
      if (token === "..") {
        tokens.pop();
        continue;
      }
      tokens.push(token);
    }
  }
  return tokens.join("/");
}

export function parentDir(path: string): string {
  const n = normalizePath(path);
  const i = n.lastIndexOf("/");
  return i === -1 ? "" : n.slice(0, i);
}

export function fileName(path: string): string {
  const n = normalizePath(path);
  const i = n.lastIndexOf("/");
  return i === -1 ? n : n.slice(i + 1);
}

export function depthOf(path: string): number {
  const n = normalizePath(path);
  if (!n) return 0;
  return n.split("/").length - 1;
}

export function isSkippedPath(path: string): boolean {
  const n = normalizePath(path);
  if (SKIP_DIR_RE.test(n) || SKIP_FILE_RE.test(n) || SKIP_NAME_RE.test(n)) return true;
  return false;
}

export function underSubdir(path: string, subdir?: string): boolean {
  if (!subdir) return true;
  const prefix = normalizePath(subdir).replace(/\/+$/, "");
  if (!prefix) return true;
  const n = normalizePath(path);
  return n === prefix || n.startsWith(`${prefix}/`);
}

export function extensionOf(path: string): string {
  const name = fileName(path);
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function isPythonPath(path: string): boolean {
  const ext = extensionOf(path);
  return ext === ".py" || ext === ".ipynb";
}

export function isTypeScriptPath(path: string): boolean {
  return /\.(ts|tsx|js|jsx)$/i.test(path);
}

export type FileIndex = {
  all: string[];
  scoped: string[];
  truncated: boolean;
  likelyMonorepo: boolean;
};

export function indexFiles(paths: string[], subdir?: string): FileIndex {
  const all: string[] = [];
  for (const raw of paths) {
    const path = normalizePath(raw);
    if (!path || isSkippedPath(path)) continue;
    all.push(path);
    if (all.length >= MAX_LISTED_FILES) break;
  }
  const scoped = all.filter((p) => underSubdir(p, subdir));
  const packageManifests = scoped.filter((p) => /(^|\/)(package\.json|pyproject\.toml)$/i.test(p));
  const likelyMonorepo =
    scoped.length >= MONOREPO_FILE_THRESHOLD ||
    packageManifests.length >= 4 ||
    scoped.some((p) => /(^|\/)(packages|apps|services)\//i.test(p) && packageManifests.length >= 2);
  return {
    all,
    scoped,
    truncated: paths.length > MAX_LISTED_FILES,
    likelyMonorepo,
  };
}

export function pickCandidateFiles(scoped: string[], extra: string[] = [], likelyMonorepo = false): string[] {
  const chosen = new Set<string>();
  const add = (path: string) => {
    const n = normalizePath(path);
    if (!n || isSkippedPath(n)) return;
    if (!scoped.includes(n) && !extra.includes(n)) return;
    chosen.add(n);
  };

  for (const path of scoped) {
    if (CONVENTION_FILE_RE.test(path) || PROMPT_FILE_RE.test(path) || TOOL_FILE_RE.test(path) || TOOL_DIR_RE.test(path)) {
      add(path);
    }
  }
  for (const path of extra) add(path);

  const depthCap = likelyMonorepo ? SHALLOW_DEPTH : 6;
  for (const path of scoped) {
    if (chosen.size >= MAX_READ_FILES) break;
    if (depthOf(path) > depthCap) continue;
    if (AGENT_ENTRY_RE.test(path) || NOTEBOOK_RE.test(path)) add(path);
  }

  if (chosen.size < 12) {
    for (const path of scoped) {
      if (chosen.size >= MAX_READ_FILES) break;
      if (depthOf(path) > depthCap) continue;
      if (SOURCE_RE.test(path)) add(path);
    }
  }

  return [...chosen].slice(0, MAX_READ_FILES);
}

export function clipFileContents(contents: string, max = MAX_FILE_BYTES): string {
  if (contents.length <= max) return contents;
  return `${contents.slice(0, max)}\n\n/* ballast: truncated after ${max} bytes */`;
}

export class MemoryRepo implements RepoFileAccess {
  private readonly files: Map<string, string>;

  constructor(files: Record<string, string> | Map<string, string>) {
    this.files = new Map();
    const entries = files instanceof Map ? files.entries() : Object.entries(files);
    for (const [path, contents] of entries) {
      this.files.set(normalizePath(path), contents);
    }
  }

  async listFiles(): Promise<string[]> {
    return [...this.files.keys()].filter((p) => !isSkippedPath(p)).sort();
  }

  async readFile(path: string): Promise<string | null> {
    const contents = this.files.get(normalizePath(path));
    return contents == null ? null : clipFileContents(contents);
  }

  async stat(path: string): Promise<{ path: string; size: number } | null> {
    const contents = this.files.get(normalizePath(path));
    if (contents == null) return null;
    return { path: normalizePath(path), size: contents.length };
  }
}

export async function readMany(
  files: RepoFileAccess,
  paths: string[],
  concurrency = 8
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const limited = paths.slice(0, MAX_READ_FILES);
  for (let i = 0; i < limited.length; i += concurrency) {
    const batch = limited.slice(i, i + concurrency);
    const reads = await Promise.all(
      batch.map(async (path) => {
        const contents = await files.readFile(path);
        return [normalizePath(path), contents] as const;
      })
    );
    for (const [path, contents] of reads) {
      if (contents != null && contents.length > 0) out.set(path, contents);
    }
  }
  return out;
}

export async function findFiles(files: RepoFileAccess, predicate: (path: string) => boolean): Promise<string[]> {
  const listed = await files.listFiles();
  return listed.filter((p) => !isSkippedPath(p) && predicate(p));
}
