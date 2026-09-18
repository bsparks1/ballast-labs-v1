import { findMatchingParen, scanStringLiterals } from "./text";
import type { ExtractedTool } from "../types";

const PERMISSION_VERBS: { permission: string; pattern: RegExp }[] = [
  { permission: "read", pattern: /\b(read|view|look ?up|query|search|fetch|retrieve|access|check|consult|list)\b/i },
  { permission: "write", pattern: /\b(write|update|create|modify|edit|insert|post|send|add|log|record|save|store)\b/i },
  { permission: "delete", pattern: /\b(delete|remove|drop|purge|erase|wipe|destroy)\b/i },
  { permission: "execute", pattern: /\b(execute|run|invoke|trigger|issue|process)\b/i },
  { permission: "deploy", pattern: /\b(deploy|release|publish|roll ?out|promote)\b/i },
  { permission: "admin", pattern: /\b(admin(?:ister|istrative)?|full access|unrestricted|manage|configure|grant|revoke)\b/i },
  { permission: "export", pattern: /\b(export|download)\b/i },
];

export function inferPermissions(name: string, description = ""): string[] {
  const text = `${name.replace(/[_-]/g, " ")} ${description}`;
  const perms: string[] = [];
  for (const { permission, pattern } of PERMISSION_VERBS) {
    if (pattern.test(text)) perms.push(permission);
  }
  if (/\b(close|cancel|terminate|refund)\b/i.test(text) && !perms.includes("execute")) perms.push("execute");
  return perms.length > 0 ? perms : ["read"];
}

function docstringAfter(source: string, defEnd: number): string | undefined {
  let i = defEnd;
  while (i < source.length && /[\s:]/.test(source[i])) i += 1;
  if (source.slice(i, i + 3) === '"""' || source.slice(i, i + 3) === "'''") {
    const q = source.slice(i, i + 3);
    const end = source.indexOf(q, i + 3);
    if (end > i) return source.slice(i + 3, end).trim();
  }
  if (source.slice(i, i + 1) === '"' || source.slice(i, i + 1) === "'") {
    const q = source[i];
    const end = source.indexOf(q, i + 1);
    if (end > i) return source.slice(i + 1, end).trim();
  }
  return undefined;
}

function argsFromSignature(sig: string): string[] {
  return sig
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split("=")[0].split(":")[0].trim())
    .filter((name) => name && name !== "self" && name !== "cls" && !name.startsWith("*"));
}

export function extractPythonTools(path: string, source: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  const seen = new Set<string>();
  const decoRe = /@tool(?:\s*\(([^)]*)\))?\s*(?:@[^\n]+\s*)*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)(?:\s*->[^:]*)?/g;
  let match: RegExpExecArray | null;
  while ((match = decoRe.exec(source))) {
    const decoArgs = match[1] ?? "";
    const fnName = match[2];
    const sig = match[3] ?? "";
    const nameLit = decoArgs.match(/["']([A-Za-z_][A-Za-z0-9_]*)["']/);
    const descLit = decoArgs.match(/description\s*=\s*["']([^"']+)["']/);
    const name = nameLit?.[1] ?? fnName;
    if (seen.has(name)) continue;
    seen.add(name);
    const description = descLit?.[1] ?? docstringAfter(source, match.index + match[0].length);
    tools.push({
      name,
      description,
      args: argsFromSignature(sig),
      permissions: inferPermissions(name, description),
      exercised: "unknown",
      source: path,
    });
  }

  // tool(fn) wrapping: calculator: BaseTool = tool(calculator_func)
  const wrapRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=\n]+)?=\s*tool\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
  while ((match = wrapRe.exec(source))) {
    const ident = match[1];
    const fnName = match[2];
    const renamed = source.match(new RegExp(`\\b${ident}\\.name\\s*=\\s*["']([^"']+)["']`))?.[1];
    const name = renamed ?? ident;
    if (seen.has(name)) continue;
    seen.add(name);
    const def = source.match(new RegExp(`(?:async\\s+)?def\\s+${fnName}\\s*\\(([^)]*)\\)(?:\\s*->[^:]*)?:`));
    const description = def ? docstringAfter(source, (def.index ?? 0) + def[0].length) : undefined;
    tools.push({
      name,
      description,
      args: def ? argsFromSignature(def[1] ?? "") : undefined,
      permissions: inferPermissions(name, description),
      exercised: "unknown",
      source: path,
    });
  }

  // Instantiated community tools: DuckDuckGoSearchResults(name="WebSearch")
  const namedCtor = /\b([A-Z][A-Za-z0-9_]*)\s*\(\s*name\s*=\s*["']([^"']+)["']/g;
  while ((match = namedCtor.exec(source))) {
    const ctor = match[1];
    const name = match[2];
    if (seen.has(name) || ctor === "BaseTool") continue;
    if (!/Tool|Search|Run|Retriever|Query/i.test(ctor) && !/Tool|Search|Weather|Calculator/i.test(name)) continue;
    seen.add(name);
    tools.push({
      name,
      description: `${ctor} integration`,
      permissions: inferPermissions(name, ctor),
      exercised: "unknown",
      source: path,
    });
  }

  const fromFn = /(?:StructuredTool\.from_function|Tool\.from_function)\s*\(/g;
  while ((match = fromFn.exec(source))) {
    const open = source.indexOf("(", match.index);
    const close = findMatchingParen(source, open);
    if (close < 0) continue;
    const inside = source.slice(open, close);
    const name = inside.match(/\bname\s*=\s*["']([^"']+)["']/)?.[1];
    const description = inside.match(/\bdescription\s*=\s*["']([^"']+)["']/)?.[1];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    tools.push({
      name,
      description,
      permissions: inferPermissions(name, description),
      exercised: "unknown",
      source: path,
    });
  }

  return tools;
}

function objectProp(source: string, start: number, end: number, key: string): string | undefined {
  const slice = source.slice(start, end);
  const re = new RegExp(`\\b${key}\\s*:\\s*`);
  const m = re.exec(slice);
  if (!m) return undefined;
  const abs = start + m.index + m[0].length;
  const lits = scanStringLiterals(source).filter((l) => l.start >= abs - 1 && l.start < end);
  return lits[0]?.value;
}

export function extractTypeScriptTools(path: string, source: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  const seen = new Set<string>();

  const toolCall = /\btool\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = toolCall.exec(source))) {
    const open = match.index + match[0].length - 1;
    const close = findMatchingParen(source, open);
    if (close < 0) continue;
    const name = objectProp(source, open, close, "name");
    const description = objectProp(source, open, close, "description");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    tools.push({
      name,
      description,
      permissions: inferPermissions(name, description),
      exercised: "unknown",
      source: path,
    });
  }

  const dyn = /new\s+DynamicTool\s*\(/g;
  while ((match = dyn.exec(source))) {
    const open = source.indexOf("(", match.index);
    const close = findMatchingParen(source, open);
    if (close < 0) continue;
    const name = objectProp(source, open, close, "name");
    const description = objectProp(source, open, close, "description");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    tools.push({
      name,
      description,
      permissions: inferPermissions(name, description),
      exercised: "unknown",
      source: path,
    });
  }

  return tools;
}

const BIND_RE =
  /(?:create_react_agent|createReactAgent|\.bind_tools|\.bindTools)\s*\(/g;

export function extractBoundToolNames(source: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = BIND_RE.exec(source))) {
    const open = source.indexOf("(", match.index);
    const close = findMatchingParen(source, open);
    if (close < 0) continue;
    const inside = source.slice(open, close);
    const toolsArg = inside.match(/\btools\s*[:=]\s*\[([^\]]*)\]/);
    const list = toolsArg ? toolsArg[1] : inside.match(/\[([^\]]*)\]/)?.[1];
    if (!list) continue;
    for (const ident of list.split(",")) {
      const name = ident.trim().replace(/['"]/g, "");
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && name !== "tools") names.push(name);
    }
  }
  return names;
}

export function mergeTools(groups: ExtractedTool[][]): ExtractedTool[] {
  const byName = new Map<string, ExtractedTool>();
  for (const group of groups) {
    for (const tool of group) {
      const key = tool.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, tool);
        continue;
      }
      byName.set(key, {
        ...existing,
        description: existing.description || tool.description,
        args: existing.args && existing.args.length > 0 ? existing.args : tool.args,
        permissions: existing.permissions.length >= tool.permissions.length ? existing.permissions : tool.permissions,
        source: existing.source,
      });
    }
  }
  return [...byName.values()];
}
