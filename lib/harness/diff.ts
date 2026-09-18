/**
 * Version comparison — instruction-level content diff, findings churn, score delta.
 * Pure functions. No I/O.
 */

import type { Finding, Instruction } from "@/lib/types";
import type { AnalysisRecord, HarnessVersionRecord } from "@/lib/db";
import {
  findingFingerprint,
  findingsFromAnalysis,
  instructionNumber,
  instructionsFromAnalysis,
  normalizeText,
} from "./report";

export type InstructionChange =
  | { kind: "added"; next: Instruction }
  | { kind: "removed"; prev: Instruction }
  | { kind: "modified"; prev: Instruction; next: Instruction }
  | { kind: "unchanged"; prev: Instruction; next: Instruction };

export type FindingChange = {
  status: "new" | "resolved" | "persisted";
  finding: Finding;
  /** Present for persisted findings (the prior-version copy). */
  previous?: Finding;
};

export type ScoreDelta = {
  from: number;
  to: number;
  delta: number;
  direction: "up" | "down" | "unchanged";
  headline: string;
  reason: string;
  impact: string;
};

export type VersionDiff = {
  fromVersion: { id: string; number: number };
  toVersion: { id: string; number: number };
  instructions: InstructionChange[];
  findings: {
    new: FindingChange[];
    resolved: FindingChange[];
    persisted: FindingChange[];
  };
  score: ScoreDelta;
};

const MODIFIED_THRESHOLD = 0.55;

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (left === right) return 1;
  const max = Math.max(left.length, right.length);
  if (max === 0) return 1;
  return 1 - levenshtein(left, right) / max;
}

export function diffInstructions(prev: Instruction[], next: Instruction[]): InstructionChange[] {
  const prevUnused = new Map(prev.map((ins, i) => [i, ins]));
  const nextUnused = new Map(next.map((ins, i) => [i, ins]));
  const changes: InstructionChange[] = [];

  for (const [pi, p] of [...prevUnused.entries()]) {
    for (const [ni, n] of [...nextUnused.entries()]) {
      if (normalizeText(p.text) === normalizeText(n.text)) {
        changes.push({ kind: "unchanged", prev: p, next: n });
        prevUnused.delete(pi);
        nextUnused.delete(ni);
        break;
      }
    }
  }

  type Pair = { pi: number; ni: number; score: number };
  const pairs: Pair[] = [];
  for (const [pi, p] of prevUnused.entries()) {
    for (const [ni, n] of nextUnused.entries()) {
      const score = similarity(p.text, n.text);
      if (score >= MODIFIED_THRESHOLD) pairs.push({ pi, ni, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedPrev = new Set<number>();
  const usedNext = new Set<number>();
  for (const pair of pairs) {
    if (usedPrev.has(pair.pi) || usedNext.has(pair.ni)) continue;
    const p = prevUnused.get(pair.pi);
    const n = nextUnused.get(pair.ni);
    if (!p || !n) continue;
    usedPrev.add(pair.pi);
    usedNext.add(pair.ni);
    prevUnused.delete(pair.pi);
    nextUnused.delete(pair.ni);
    changes.push({ kind: "modified", prev: p, next: n });
  }

  for (const p of prevUnused.values()) changes.push({ kind: "removed", prev: p });
  for (const n of nextUnused.values()) changes.push({ kind: "added", next: n });

  const rank = { removed: 0, modified: 1, added: 2, unchanged: 3 };
  return changes.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

export function diffFindings(prev: Finding[], next: Finding[]): VersionDiff["findings"] {
  const prevByKey = new Map(prev.map((f) => [findingFingerprint(f), f]));
  const nextByKey = new Map(next.map((f) => [findingFingerprint(f), f]));

  const neu: FindingChange[] = [];
  const resolved: FindingChange[] = [];
  const persisted: FindingChange[] = [];

  for (const [key, finding] of nextByKey) {
    const previous = prevByKey.get(key);
    if (previous) persisted.push({ status: "persisted", finding, previous });
    else neu.push({ status: "new", finding });
  }
  for (const [key, finding] of prevByKey) {
    if (!nextByKey.has(key)) resolved.push({ status: "resolved", finding });
  }

  const sev = { critical: 0, warning: 1, info: 2 };
  const bySev = (a: FindingChange, b: FindingChange) =>
    sev[a.finding.severity] - sev[b.finding.severity];
  neu.sort(bySev);
  resolved.sort(bySev);
  persisted.sort(bySev);
  return { new: neu, resolved, persisted };
}

function countWord(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function scoreReason(
  findings: VersionDiff["findings"],
  nextInstructions: Instruction[]
): string {
  const newestCritical = findings.new.find((c) => c.finding.severity === "critical");
  if (newestCritical) {
    const refs = instructionRefs(newestCritical.finding, nextInstructions);
    if (refs.length >= 2) {
      return `New critical finding: instruction ${refs[0]} conflicts with instruction ${refs[1]}.`;
    }
    if (refs.length === 1) {
      return `New critical finding: ${newestCritical.finding.title} (${refs[0]}).`;
    }
    return `New critical finding: ${newestCritical.finding.title}.`;
  }
  const newest = findings.new[0];
  if (newest) return `New finding: ${newest.finding.title}.`;
  if (findings.resolved.length > 0) {
    return `Resolved ${countWord(findings.resolved.length, "finding")}: ${findings.resolved[0].finding.title}.`;
  }
  if (findings.persisted.length > 0) {
    return `${countWord(findings.persisted.length, "finding")} still present.`;
  }
  return "No findings changed.";
}

function instructionRefs(finding: Finding, instructions: Instruction[]): string[] {
  const haystack = [finding.affectedElement, ...(finding.evidence ?? [])].map(normalizeText);
  const refs: string[] = [];
  for (const ins of instructions) {
    const text = normalizeText(ins.text);
    if (!text) continue;
    if (haystack.some((h) => h.includes(text) || text.includes(h))) {
      refs.push(instructionNumber(ins.id));
    }
  }
  return refs;
}

export function impactSentence(findings: VersionDiff["findings"], from: number, to: number): string {
  const scorePart = `Net score: ${from} → ${to}.`;
  const nNew = findings.new.length;
  const nResolved = findings.resolved.length;
  if (nNew === 0 && nResolved === 0) {
    return `No change to findings. ${scorePart}`;
  }
  const resolvedBit = nResolved > 0 ? `resolved ${countWord(nResolved, "finding")}` : "";
  const newBit =
    nNew > 0
      ? `introduced ${nNew} new ${nNew === 1 ? findingKind(findings.new[0].finding) : "findings"}`
      : "";
  if (resolvedBit && newBit) {
    return `Your change ${resolvedBit} but ${newBit}. ${scorePart}`;
  }
  if (resolvedBit) return `Your change ${resolvedBit}. ${scorePart}`;
  return `Your change ${newBit}. ${scorePart}`;
}

function findingKind(finding: Finding): string {
  if (finding.category === "contradiction") return "conflict";
  return "finding";
}

export function scoreDelta(
  from: number,
  to: number,
  findings: VersionDiff["findings"],
  nextInstructions: Instruction[]
): ScoreDelta {
  const delta = to - from;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "unchanged";
  const abs = Math.abs(delta);
  const headline =
    direction === "unchanged"
      ? `${from} → ${to} (unchanged)`
      : `${from} → ${to} (${direction} ${abs})`;
  return {
    from,
    to,
    delta,
    direction,
    headline,
    reason: scoreReason(findings, nextInstructions),
    impact: impactSentence(findings, from, to),
  };
}

export function diffAnalyses(previous: AnalysisRecord, current: AnalysisRecord): VersionDiff["findings"] {
  return diffFindings(findingsFromAnalysis(previous), findingsFromAnalysis(current));
}

export function diffVersions(
  fromVersion: HarnessVersionRecord,
  fromAnalysis: AnalysisRecord,
  toVersion: HarnessVersionRecord,
  toAnalysis: AnalysisRecord
): VersionDiff {
  const prevIns = instructionsFromAnalysis(fromAnalysis);
  const nextIns = instructionsFromAnalysis(toAnalysis);
  const findings = diffFindings(findingsFromAnalysis(fromAnalysis), findingsFromAnalysis(toAnalysis));
  return {
    fromVersion: { id: fromVersion.id, number: fromVersion.versionNumber },
    toVersion: { id: toVersion.id, number: toVersion.versionNumber },
    instructions: diffInstructions(prevIns, nextIns),
    findings,
    score: scoreDelta(fromAnalysis.overallScore, toAnalysis.overallScore, findings, nextIns),
  };
}

export function changeSummaryLine(diff: VersionDiff): string {
  const added = diff.instructions.filter((c) => c.kind === "added").length;
  const removed = diff.instructions.filter((c) => c.kind === "removed").length;
  const modified = diff.instructions.filter((c) => c.kind === "modified").length;
  const bits: string[] = [];
  if (added) bits.push(`added ${countWord(added, "instruction")}`);
  if (removed) bits.push(`removed ${countWord(removed, "instruction")}`);
  if (modified) bits.push(`modified ${countWord(modified, "instruction")}`);
  if (diff.findings.new.length) bits.push(`${diff.findings.new.length} new finding${diff.findings.new.length === 1 ? "" : "s"}`);
  if (diff.findings.resolved.length) bits.push(`${diff.findings.resolved.length} resolved`);
  if (bits.length === 0) return "No instruction or finding changes.";
  return bits.join(", ") + ".";
}
