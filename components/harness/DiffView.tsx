"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FindingChange, InstructionChange, VersionDiff } from "@/lib/harness/diff";
import { FindingCard } from "@/components/FindingCard";
import { InstructionItem } from "@/components/InstructionItem";
import { ReportLinksProvider } from "@/components/report/ReportLinks";

type VersionOption = { number: number; score: number | null };

export function DiffView({
  harnessId,
  harnessName,
  fromNumber,
  toNumber,
  versions,
  diff,
}: {
  harnessId: string;
  harnessName: string;
  fromNumber: number;
  toNumber: number;
  versions: VersionOption[];
  diff: VersionDiff | null;
}) {
  const same = fromNumber === toNumber;
  return (
    <ReportLinksProvider base={{ kind: "harness", harnessId }}>
      <div className="space-y-6">
        <VersionPicker
          harnessId={harnessId}
          versions={versions}
          fromNumber={fromNumber}
          toNumber={toNumber}
        />
        {same || !diff ? (
          <section className="rounded-md border border-edge bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              {same
                ? "Save a new version to see what the change did to risk posture."
                : "Both versions need a stored analysis before they can be compared."}
            </p>
          </section>
        ) : (
          <>
            <ScoreHero diff={diff} harnessName={harnessName} />
            <FindingsDiff diff={diff} />
            <InstructionDiff diff={diff} />
          </>
        )}
      </div>
    </ReportLinksProvider>
  );
}

function VersionPicker({
  harnessId,
  versions,
  fromNumber,
  toNumber,
}: {
  harnessId: string;
  versions: VersionOption[];
  fromNumber: number;
  toNumber: number;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(String(fromNumber));
  const [to, setTo] = useState(String(toNumber));

  function go(nextFrom: string, nextTo: string) {
    router.push(`/harnesses/${harnessId}/diff?from=${nextFrom}&to=${nextTo}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">Compare</span>
      <select
        className="rounded-sm border border-edge bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
        value={from}
        onChange={(e) => {
          setFrom(e.target.value);
          go(e.target.value, to);
        }}
      >
        {versions.map((v) => (
          <option key={v.number} value={v.number}>
            v{v.number}
            {v.score !== null ? ` (${v.score})` : ""}
          </option>
        ))}
      </select>
      <span className="text-faint">→</span>
      <select
        className="rounded-sm border border-edge bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
        value={to}
        onChange={(e) => {
          setTo(e.target.value);
          go(from, e.target.value);
        }}
      >
        {versions.map((v) => (
          <option key={v.number} value={v.number}>
            v{v.number}
            {v.score !== null ? ` (${v.score})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function ScoreHero({ diff, harnessName }: { diff: VersionDiff; harnessName: string }) {
  const { score } = diff;
  const color =
    score.direction === "down" ? "text-critical" : score.direction === "up" ? "text-healthy" : "text-muted";
  const arrow = score.direction === "down" ? "↓" : score.direction === "up" ? "↑" : "→";

  return (
    <section className="rounded-md border border-edge bg-surface p-6 sm:p-8">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
        Risk posture · {harnessName}
      </p>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <span className="text-4xl font-semibold tabular-nums sm:text-5xl">{score.from}</span>
        <span className={`text-2xl font-semibold ${color}`}>{arrow}</span>
        <span className={`text-4xl font-semibold tabular-nums sm:text-5xl ${color}`}>{score.to}</span>
        <span className={`font-mono text-sm ${color}`}>{score.headline.replace(/^\d+\s*→\s*\d+\s*/, "")}</span>
      </div>
      <p className="mt-4 text-base font-medium leading-relaxed sm:text-lg">{score.impact}</p>
      <p className="mt-2 text-sm text-muted">{score.reason}</p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-faint">
        v{diff.fromVersion.number} → v{diff.toVersion.number}
      </p>
    </section>
  );
}

function FindingsDiff({ diff }: { diff: VersionDiff }) {
  const { new: neu, resolved, persisted } = diff.findings;
  const [showPersisted, setShowPersisted] = useState(false);

  return (
    <section className="space-y-4">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">Findings diff</h2>
      <div className="grid grid-cols-3 gap-3">
        <CountTile label="New" value={neu.length} tone="critical" />
        <CountTile label="Resolved" value={resolved.length} tone="healthy" />
        <CountTile label="Persisted" value={persisted.length} tone="muted" />
      </div>

      <FindingSection
        title="New"
        empty="No new findings in this version."
        items={neu}
        badge="NEW"
        badgeClass="bg-critical-dim text-critical"
      />
      <FindingSection
        title="Resolved"
        empty="Nothing was resolved."
        items={resolved}
        badge="RESOLVED"
        badgeClass="bg-healthy-dim text-healthy"
      />

      <div>
        <button
          type="button"
          className="font-mono text-[11px] uppercase tracking-widest text-faint hover:text-muted"
          onClick={() => setShowPersisted((v) => !v)}
        >
          {showPersisted ? "− Hide" : "+ Show"} {persisted.length} persisted finding
          {persisted.length === 1 ? "" : "s"}
        </button>
        {showPersisted && (
          <div className="mt-3">
            <FindingSection
              title="Persisted"
              empty="No findings carried forward."
              items={persisted}
              badge="PERSIST"
              badgeClass="bg-surface-raised text-muted"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "healthy" | "muted";
}) {
  const color = tone === "critical" ? "text-critical" : tone === "healthy" ? "text-healthy" : "text-foreground";
  return (
    <div className="rounded-md border border-edge bg-surface px-4 py-3">
      <p className={`text-2xl font-semibold tabular-nums ${value > 0 ? color : "text-faint"}`}>{value}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-faint">{label}</p>
    </div>
  );
}

function FindingSection({
  title,
  empty,
  items,
  badge,
  badgeClass,
}: {
  title: string;
  empty: string;
  items: FindingChange[];
  badge: string;
  badgeClass: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
        {title}
        {items.length > 0 ? ` · ${items.length}` : ""}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-faint">{empty}</p>
      ) : (
        items.map((item) => (
          <div key={`${item.status}-${item.finding.id}-${item.finding.title}`} className="relative">
            <span
              className={`absolute right-3 top-3 z-10 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ${badgeClass}`}
            >
              {badge}
            </span>
            <FindingCard finding={item.finding} showComponent />
          </div>
        ))
      )}
    </div>
  );
}

function InstructionDiff({ diff }: { diff: VersionDiff }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const changes = useMemo(
    () => (showUnchanged ? diff.instructions : diff.instructions.filter((c) => c.kind !== "unchanged")),
    [diff.instructions, showUnchanged]
  );
  const unchanged = diff.instructions.filter((c) => c.kind === "unchanged").length;
  const added = diff.instructions.filter((c) => c.kind === "added").length;
  const removed = diff.instructions.filter((c) => c.kind === "removed").length;
  const modified = diff.instructions.filter((c) => c.kind === "modified").length;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
            Instruction diff
          </h2>
          <p className="mt-1 text-xs text-muted">
            {added} added · {removed} removed · {modified} modified · {unchanged} unchanged
          </p>
        </div>
        {unchanged > 0 && (
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-widest text-faint hover:text-muted"
            onClick={() => setShowUnchanged((v) => !v)}
          >
            {showUnchanged ? "Hide" : "Show"} unchanged
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-edge bg-surface">
        {changes.length === 0 ? (
          <p className="p-6 text-center text-sm text-faint">Instructions are identical between these versions.</p>
        ) : (
          changes.map((change, i) => <InstructionDiffRow key={i} change={change} />)
        )}
      </div>
    </section>
  );
}

function InstructionDiffRow({ change }: { change: InstructionChange }) {
  if (change.kind === "added") {
    return (
      <div className="border-b border-edge border-l-2 border-l-healthy bg-healthy-dim/40 px-4 py-3 last:border-b-0">
        <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-healthy">Added</p>
        <InstructionItem instruction={change.next} />
      </div>
    );
  }
  if (change.kind === "removed") {
    return (
      <div className="border-b border-edge border-l-2 border-l-critical bg-critical-dim/50 px-4 py-3 last:border-b-0">
        <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-critical">Removed</p>
        <InstructionItem instruction={change.prev} />
      </div>
    );
  }
  if (change.kind === "modified") {
    return (
      <div className="border-b border-edge border-l-2 border-l-warning bg-warning-dim/30 px-4 py-3 last:border-b-0">
        <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-warning">Modified</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-critical">− previous</p>
            <InstructionItem instruction={change.prev} />
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-healthy">+ current</p>
            <InstructionItem instruction={change.next} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-edge px-4 py-3 last:border-b-0 opacity-60">
      <InstructionItem instruction={change.next} />
    </div>
  );
}
