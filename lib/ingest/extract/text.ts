/**
 * Lightweight string-literal scanning. Not a full parser — good enough for
 * prompt/tool conventions in Python and TypeScript without hanging on
 * arbitrary source.
 */

export type StringLiteral = {
  start: number;
  end: number;
  value: string;
  quote: "single" | "double" | "triple-single" | "triple-double" | "template";
};

const MAX_SCAN = 400_000;

function isIdentChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function skipWsAndComments(source: string, i: number): number {
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch === "#" && (i === 0 || source[i - 1] === "\n")) {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function decodeEscapes(raw: string, quote: StringLiteral["quote"]): string {
  if (quote === "triple-single" || quote === "triple-double") {
    return raw.replace(/\\("""|'''|\\)/g, "$1");
  }
  return raw.replace(/\\([nrt\\'"0])/g, (_, ch: string) => {
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "\t";
    if (ch === "0") return "\0";
    return ch;
  });
}

export function scanStringLiterals(source: string): StringLiteral[] {
  const text = source.length > MAX_SCAN ? source.slice(0, MAX_SCAN) : source;
  const out: StringLiteral[] = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];

    if (ch === "#" && (i === 0 || text[i - 1] === "\n")) {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      i += 2;
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    // Python string prefixes: f, r, b, u, rf, fr, ...
    let start = i;
    if (/[fFrRbBuU]/.test(ch) && i + 1 < n) {
      let j = i;
      while (j < i + 3 && /[fFrRbBuU]/.test(text[j])) j += 1;
      if (text[j] === "'" || text[j] === '"' || text[j] === "`") {
        start = i;
        i = j;
      }
    }

    const q = text[i];
    if (q !== "'" && q !== '"' && q !== "`") {
      i += 1;
      continue;
    }

    if (q !== "`" && text.slice(i, i + 3) === q + q + q) {
      const quote: StringLiteral["quote"] = q === '"' ? "triple-double" : "triple-single";
      const closer = q + q + q;
      i += 3;
      const contentStart = i;
      while (i + 2 < n && text.slice(i, i + 3) !== closer) i += 1;
      const value = decodeEscapes(text.slice(contentStart, i), quote);
      const end = Math.min(i + 3, n);
      out.push({ start, end, value, quote });
      i = end;
      continue;
    }

    if (q === "`") {
      i += 1;
      const contentStart = i;
      let buf = "";
      while (i < n && text[i] !== "`") {
        if (text[i] === "\\" && i + 1 < n) {
          buf += text[i + 1];
          i += 2;
          continue;
        }
        buf += text[i];
        i += 1;
      }
      out.push({
        start,
        end: Math.min(i + 1, n),
        value: buf,
        quote: "template",
      });
      i += 1;
      continue;
    }

    const quote: StringLiteral["quote"] = q === '"' ? "double" : "single";
    i += 1;
    const contentStart = i;
    while (i < n && text[i] !== q) {
      if (text[i] === "\\" && i + 1 < n) {
        i += 2;
        continue;
      }
      if (text[i] === "\n") break;
      i += 1;
    }
    const raw = text.slice(contentStart, i);
    out.push({ start, end: Math.min(i + 1, n), value: decodeEscapes(raw, quote), quote });
    i += 1;
  }
  return out;
}

/** Identifier immediately to the left of `=` before a string starting at `start`. */
export function assignmentNameBefore(source: string, start: number): string | null {
  let i = start - 1;
  while (i >= 0 && /\s/.test(source[i])) i -= 1;
  if (i < 0 || source[i] !== "=") return null;
  i -= 1;
  while (i >= 0 && /\s/.test(source[i])) i -= 1;
  // skip type annotation `: str`
  if (source[i] && /[A-Za-z0-9_\]>]/.test(source[i])) {
    const end = i;
    while (i >= 0 && (isIdentChar(source[i]) || source[i] === "." || source[i] === "]" || source[i] === "[")) {
      i -= 1;
    }
    const name = source.slice(i + 1, end + 1).trim();
    const ident = name.split(".").pop() ?? name;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) return ident;
  }
  return null;
}

const PROMPT_NAME_RE =
  /^(?:SYSTEM_)?(?:PROMPT|INSTRUCTIONS?|TEMPLATE|SYSTEM_MESSAGE|SYSTEM)$|PROMPT$|INSTRUCTIONS?$|^(?:system(?:Prompt|Message|_prompt|_message)|prompt|template|instructions?)$/i;

export function isPromptLikeName(name: string): boolean {
  return PROMPT_NAME_RE.test(name);
}

export function looksLikePromptText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 40) return false;
  if (trimmed.length > 80) return true;
  return /\b(you are|your role|always|never|must|instructions?|assistant|agent)\b/i.test(trimmed);
}

export type NamedString = {
  name: string;
  text: string;
  index: number;
};

export function extractNamedStringAssignments(source: string): NamedString[] {
  const lits = scanStringLiterals(source);
  const out: NamedString[] = [];
  for (const lit of lits) {
    const name = assignmentNameBefore(source, lit.start);
    if (!name) continue;
    out.push({ name, text: lit.value, index: lit.start });
  }
  return out;
}

/** First string argument (or content=/template= keyword) of a call to `fnName`. */
export function extractCallStringArgs(source: string, fnName: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${fnName}\\s*\\(`, "g");
  const lits = scanStringLiterals(source);
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const open = match.index + match[0].length - 1;
    const close = findMatchingParen(source, open);
    if (close < 0) continue;
    const inside = source.slice(open + 1, close);
    const kw = inside.match(/\b(?:content|template|system|text)\s*=\s*/);
    const regionStart = kw ? open + 1 + (kw.index ?? 0) : open + 1;
    const lit = lits.find((l) => l.start >= regionStart - 2 && l.start < close);
    if (lit && lit.value.trim().length >= 20) out.push(lit.value);
  }
  return out;
}

export function findMatchingParen(source: string, openIndex: number): number {
  const open = source[openIndex];
  const close = open === "(" ? ")" : open === "[" ? "]" : open === "{" ? "}" : "";
  if (!close) return -1;
  let depth = 0;
  let i = openIndex;
  const n = Math.min(source.length, openIndex + 20_000);
  while (i < n) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      if (source.slice(i, i + 3) === ch + ch + ch) {
        i += 3;
        while (i + 2 < n && source.slice(i, i + 3) !== ch + ch + ch) i += 1;
        i += 3;
        continue;
      }
      const q = ch;
      i += 1;
      while (i < n && source[i] !== q) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

export function extractFromMessagesSystemStrings(source: string): string[] {
  const out: string[] = [];
  const callRe = /\.(?:from_messages|fromMessages)\s*\(/g;
  const lits = scanStringLiterals(source);
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(source))) {
    const open = source.indexOf("(", match.index);
    const close = findMatchingParen(source, open);
    if (close < 0) continue;
    const inside = source.slice(open, close);
    // ("system", """...""") or ["system", `...`]
    const roleRe = /["']system["']/gi;
    let role: RegExpExecArray | null;
    while ((role = roleRe.exec(inside))) {
      const abs = open + role.index;
      const lit = lits.find((l) => l.start > abs && l.start < close && l.value.trim().length >= 20);
      if (lit) out.push(lit.value);
    }
  }
  return out;
}

export function uniqueTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    const key = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (key.length < 20 || seen.has(key)) continue;
    seen.add(key);
    out.push(text.trim());
  }
  return out;
}

export { skipWsAndComments };
