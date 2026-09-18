/**
 * langgraph.json manifest parsing. Present in roughly half of real LangGraph
 * repos; when missing, the adapter continues with convention-based discovery.
 */

import { normalizePath, parentDir, posixJoin } from "../files";

export type ManifestGraph = {
  name: string;
  file: string;
  symbol: string;
  description?: string;
};

export type LangGraphManifest = {
  path: string;
  pythonVersion?: string;
  nodeVersion?: string;
  dependencies: string[];
  env?: string | Record<string, string>;
  graphs: ManifestGraph[];
};

function parseGraphRef(raw: string, manifestDir: string): { file: string; symbol: string } | null {
  const trimmed = raw.trim();
  const colon = trimmed.lastIndexOf(":");
  if (colon <= 0) return null;
  const filePart = trimmed.slice(0, colon).trim();
  const symbol = trimmed.slice(colon + 1).trim();
  if (!filePart || !symbol) return null;
  const resolved = filePart.startsWith("/")
    ? normalizePath(filePart)
    : normalizePath(posixJoin(manifestDir, filePart));
  return { file: resolved, symbol };
}

export function parseLangGraphManifest(path: string, raw: string): LangGraphManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const graphsRaw = obj.graphs;
  if (graphsRaw === null || typeof graphsRaw !== "object" || Array.isArray(graphsRaw)) return null;

  const manifestDir = parentDir(path);
  const graphs: ManifestGraph[] = [];
  for (const [name, value] of Object.entries(graphsRaw as Record<string, unknown>)) {
    let ref: string | null = null;
    let description: string | undefined;
    if (typeof value === "string") ref = value;
    else if (value && typeof value === "object") {
      const rec = value as Record<string, unknown>;
      if (typeof rec.path === "string") ref = rec.path;
      if (typeof rec.description === "string") description = rec.description;
    }
    if (!ref) continue;
    const parsedRef = parseGraphRef(ref, manifestDir);
    if (!parsedRef) continue;
    graphs.push({ name, file: parsedRef.file, symbol: parsedRef.symbol, description });
  }

  const dependencies = Array.isArray(obj.dependencies)
    ? obj.dependencies.filter((d): d is string => typeof d === "string")
    : [];

  return {
    path: normalizePath(path),
    pythonVersion: typeof obj.python_version === "string" ? obj.python_version : undefined,
    nodeVersion: typeof obj.node_version === "string" ? obj.node_version : undefined,
    dependencies,
    env: typeof obj.env === "string" || (obj.env && typeof obj.env === "object") ? (obj.env as string | Record<string, string>) : undefined,
    graphs,
  };
}

export function pickManifest(manifests: LangGraphManifest[], subdir?: string): LangGraphManifest | null {
  if (manifests.length === 0) return null;
  if (subdir) {
    const prefix = normalizePath(subdir);
    const scoped = manifests.filter((m) => m.path === prefix || m.path.startsWith(`${prefix}/`) || prefix.startsWith(parentDir(m.path)));
    if (scoped.length > 0) {
      return scoped.sort((a, b) => a.path.length - b.path.length)[0];
    }
  }
  return [...manifests].sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))[0];
}
