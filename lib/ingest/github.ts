/**
 * Parse a public GitHub URL (or owner/repo shorthand) and load it as RepoFileAccess.
 * Private repos / GitHub App auth are explicitly out of scope.
 *
 * File contents are read from raw.githubusercontent.com so they don't burn the
 * REST API quota. If the tree API is rate-limited, we fall back to the public
 * zip archive (still public-repos only).
 */

import { filesFromZip } from "./upload";
import {
  MAX_FILE_BYTES,
  MAX_READ_FILES,
  clipFileContents,
  isSkippedPath,
  normalizePath,
  underSubdir,
} from "./files";
import type { IngestionSource } from "./types";

export type GitHubRef = {
  owner: string;
  repo: string;
  ref?: string;
  subdir?: string;
};

export class GitHubIngestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GitHubIngestError";
    this.status = status;
  }
}

const GITHUB_HOST = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i;
const GITHUB_FETCH_MS = 20_000;
const GITHUB_ARCHIVE_MS = 30_000;

export function parseGitHubUrl(input: string): GitHubRef {
  const raw = input.trim();
  if (!raw) throw new GitHubIngestError("A GitHub URL is required.");

  let owner = "";
  let repo = "";
  let ref: string | undefined;
  let subdir: string | undefined;

  if (!GITHUB_HOST.test(raw) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw.replace(/\.git$/, ""))) {
    const [o, r] = raw.replace(/\.git$/, "").split("/");
    owner = o;
    repo = r;
  } else {
    let url: URL;
    try {
      url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    } catch {
      throw new GitHubIngestError("That doesn't look like a GitHub URL. Use https://github.com/owner/repo.");
    }
    if (!/github\.com$/i.test(url.hostname)) {
      throw new GitHubIngestError("Only public GitHub repositories are supported.");
    }
    const parts = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/").filter(Boolean);
    owner = parts[0] ?? "";
    repo = parts[1] ?? "";
    if (parts[2] === "tree" && parts[3]) {
      ref = parts[3];
      if (parts.length > 4) subdir = parts.slice(4).join("/");
    } else if (parts[2] === "blob" && parts[3]) {
      ref = parts[3];
      if (parts.length > 5) subdir = parts.slice(4, -1).join("/");
    }
  }

  if (!owner || !repo) {
    throw new GitHubIngestError("Could not parse owner/repo from that URL.");
  }
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);
  return { owner, repo, ref, subdir: subdir ? normalizePath(subdir) : undefined };
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Ballast-Labs-Harness-Ingest",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function asTimeoutError(): GitHubIngestError {
  return new GitHubIngestError("GitHub timed out. Try again, or upload the agent directory instead.", 504);
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name: unknown }).name) : "";
  return name === "TimeoutError" || name === "AbortError";
}

async function githubJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: githubHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(GITHUB_FETCH_MS),
    });
  } catch (err) {
    if (isAbortError(err)) throw asTimeoutError();
    throw err;
  }
  if (res.status === 404) {
    throw new GitHubIngestError(
      "Repo not found or private. Ballast currently supports public GitHub repos and file uploads.",
      404
    );
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitHubIngestError(
      "GitHub rate-limited this request. Add a GITHUB_TOKEN to .env.local for a higher quota, or upload the files instead.",
      429
    );
  }
  if (!res.ok) {
    throw new GitHubIngestError(`GitHub API error (${res.status}).`, res.status);
  }
  return (await res.json()) as T;
}

type RepoInfo = { default_branch: string; size: number; full_name: string; private: boolean };
type TreeResponse = {
  truncated: boolean;
  tree: { path: string; type: string; size?: number }[];
};

const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;

async function downloadPublicArchive(owner: string, repo: string, ref: string): Promise<Record<string, string>> {
  const urls = [
    `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(ref)}`,
    `https://codeload.github.com/${owner}/${repo}/zip/${encodeURIComponent(ref)}`,
    `https://github.com/${owner}/${repo}/archive/refs/heads/${encodeURIComponent(ref)}.zip`,
  ];
  let lastStatus = 0;
  for (const url of urls) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "Ballast-Labs-Harness-Ingest" },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(GITHUB_ARCHIVE_MS),
      });
    } catch (err) {
      if (isAbortError(err)) throw asTimeoutError();
      continue;
    }
    lastStatus = res.status;
    if (res.status === 404) continue;
    if (!res.ok) continue;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_ARCHIVE_BYTES) {
      throw new GitHubIngestError(
        "This repo archive is too large to download. Point at the agent subdirectory or upload just those files.",
        413
      );
    }
    return filesFromZip(buf);
  }
  if (lastStatus === 404) {
    throw new GitHubIngestError(
      "Repo not found or private. Ballast currently supports public GitHub repos and file uploads.",
      404
    );
  }
  throw new GitHubIngestError("Could not download the public repo archive. Upload the agent directory instead.", 502);
}

export class GitHubRepo implements RepoFileAccess {
  readonly source: IngestionSource;
  private tree: string[] | null = null;
  private readonly cache = new Map<string, string | null>();
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly subdir?: string;
  truncated = false;
  repoSizeKb = 0;

  constructor(ref: GitHubRef & { ref: string }, preload?: Record<string, string>) {
    this.owner = ref.owner;
    this.repo = ref.repo;
    this.ref = ref.ref;
    this.subdir = ref.subdir;
    this.source = {
      kind: "github",
      label: `github.com/${ref.owner}/${ref.repo}${ref.subdir ? `/${ref.subdir}` : ""}`,
      url: `https://github.com/${ref.owner}/${ref.repo}`,
      owner: ref.owner,
      repo: ref.repo,
      ref: ref.ref,
      subdir: ref.subdir,
    };
    if (preload) {
      const scoped: string[] = [];
      for (const [path, contents] of Object.entries(preload)) {
        const n = normalizePath(path);
        if (!n || isSkippedPath(n) || !underSubdir(n, this.subdir)) continue;
        this.cache.set(n, clipFileContents(contents));
        scoped.push(n);
      }
      this.tree = scoped;
    }
  }

  async listFiles(): Promise<string[]> {
    if (this.tree) return this.tree;
    const data = await githubJson<TreeResponse>(
      `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${encodeURIComponent(this.ref)}?recursive=1`
    );
    this.truncated = data.truncated;
    const paths: string[] = [];
    for (const entry of data.tree) {
      if (entry.type !== "blob" || !entry.path) continue;
      const path = normalizePath(entry.path);
      if (isSkippedPath(path)) continue;
      if (!underSubdir(path, this.subdir)) continue;
      paths.push(path);
    }
    this.tree = paths;
    return paths;
  }

  async readFile(path: string): Promise<string | null> {
    const n = normalizePath(path);
    if (this.cache.has(n)) return this.cache.get(n) ?? null;
    if (this.cache.size >= MAX_READ_FILES) return null;
    const rawUrl = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${encodeURIComponent(this.ref)}/${n
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    let res: Response;
    try {
      res = await fetch(rawUrl, {
        headers: { "User-Agent": "Ballast-Labs-Harness-Ingest" },
        cache: "no-store",
        signal: AbortSignal.timeout(GITHUB_FETCH_MS),
      });
    } catch (err) {
      if (isAbortError(err)) throw asTimeoutError();
      this.cache.set(n, null);
      return null;
    }
    if (res.status === 404) {
      this.cache.set(n, null);
      return null;
    }
    if (res.status === 403 || res.status === 429) {
      throw new GitHubIngestError(
        "GitHub rate-limited file reads. Add a GITHUB_TOKEN or upload a zip of the agent directory.",
        429
      );
    }
    if (!res.ok) {
      this.cache.set(n, null);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_FILE_BYTES * 4) {
      this.cache.set(n, null);
      return null;
    }
    const text = clipFileContents(new TextDecoder("utf-8", { fatal: false }).decode(buf));
    this.cache.set(n, text);
    return text;
  }
}

async function loadFromArchive(ref: GitHubRef & { ref: string }): Promise<GitHubRepo> {
  const files = await downloadPublicArchive(ref.owner, ref.repo, ref.ref);
  const repo = new GitHubRepo(ref, files);
  repo.source.warnings = [
    ...(repo.source.warnings ?? []),
    "Loaded via public archive because the GitHub API quota was exhausted.",
  ];
  return repo;
}

export async function loadGitHubRepo(input: string, subdirOverride?: string): Promise<GitHubRepo> {
  const parsed = parseGitHubUrl(input);
  const subdir = subdirOverride ? normalizePath(subdirOverride) : parsed.subdir;
  try {
    const info = await githubJson<RepoInfo>(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
    if (info.private) {
      throw new GitHubIngestError("Private repos are not supported yet. Upload the files instead.", 403);
    }
    const ref = parsed.ref ?? info.default_branch;
    const repo = new GitHubRepo({ ...parsed, ref, subdir });
    repo.repoSizeKb = info.size;
    return repo;
  } catch (err) {
    if (err instanceof GitHubIngestError) {
      if (err.status === 403 && /private repos are not supported/i.test(err.message)) throw err;
      if (err.status !== 429 && err.status !== 403) throw err;
    }
    const guesses = parsed.ref ? [parsed.ref] : ["main", "master"];
    let last: unknown = err;
    for (const ref of guesses) {
      try {
        return await loadFromArchive({ ...parsed, ref, subdir });
      } catch (inner) {
        last = inner;
      }
    }
    throw last instanceof Error ? last : err;
  }
}

export function githubSourceFromRepo(repo: GitHubRepo): IngestionSource {
  return repo.source;
}
