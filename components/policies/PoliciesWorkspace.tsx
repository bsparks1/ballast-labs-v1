"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { POLICY_PRINCIPLES } from "@/lib/compliance/principles";
import type { PolicyLifecycle } from "@/lib/types";
import { CustomPolicyPanel } from "./CustomPolicyPanel";
import { LibraryCard } from "./LibraryCard";
import { PolicyCard } from "./PolicyCard";
import { StatusDot } from "./StatusDot";
import type { LibraryListItem, PolicyListItem } from "./types";

const STATUS_ORDER: PolicyLifecycle[] = ["active", "paused", "draft"];

const STATUS_NOTE: Record<PolicyLifecycle, string> = {
  active: "Checked against your harnesses.",
  paused: "Kept in your pack. Not evaluated.",
  draft: "Not evaluated until you set them to Active.",
};

export function PoliciesWorkspace({
  policies,
  library,
  harnessName,
}: {
  policies: PolicyListItem[];
  library: LibraryListItem[];
  harnessName: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"mine" | "discover">("mine");
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PolicyLifecycle | null>(null);
  const [statusOverride, setStatusOverride] = useState<Record<string, PolicyLifecycle>>({});

  useEffect(() => {
    setStatusOverride((current) => {
      let changed = false;
      const next = { ...current };
      for (const [id, status] of Object.entries(current)) {
        const policy = policies.find((item) => item.id === id);
        if (!policy || policy.status === status) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [policies]);

  const displayed = useMemo(
    () => policies.map((policy) => ({ ...policy, status: statusOverride[policy.id] ?? policy.status })),
    [policies, statusOverride]
  );

  const counts = useMemo(() => {
    return {
      active: displayed.filter((policy) => policy.status === "active").length,
      paused: displayed.filter((policy) => policy.status === "paused").length,
      draft: displayed.filter((policy) => policy.status === "draft").length,
    };
  }, [displayed]);

  const categorySet = useMemo(() => new Set(categories), [categories]);

  function matchesCategory(principle: string) {
    return categorySet.size === 0 || categorySet.has(principle);
  }

  function toggleCategory(principle: string) {
    setCategories((current) =>
      current.includes(principle) ? current.filter((item) => item !== principle) : [...current, principle]
    );
  }

  const closeBuilder = useCallback(() => setCreating(false), []);

  function openMine(policyId: string) {
    setCreating(false);
    setTab("mine");
    setCategories([]);
    setFocusId(policyId);
  }

  function onCreated(policyId: string) {
    openMine(policyId);
    router.refresh();
  }

  function onTabKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = tab === "mine" ? "discover" : "mine";
    setCreating(false);
    setTab(next);
    document.getElementById(next === "mine" ? "policies-tab-mine" : "policies-tab-discover")?.focus();
  }

  const hasVerdicts = policies.some((policy) => policy.verdict);
  const visibleMine = displayed.filter(
    (policy) => matchesCategory(policy.principle) && (statusFilter === null || policy.status === statusFilter),
  );

  function selectStatus(status: PolicyLifecycle) {
    setStatusFilter((current) => (current === status ? null : status));
  }
  const visibleLibrary = library.filter((policy) => matchesCategory(policy.principle));

  return (
    <div>
      <div className="border-b border-edge pb-8">
        <p className="eyebrow">Policies</p>
        <h1 className="display-md mt-3">What’s protecting you</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Only Active policies are checked against your harnesses. Paused and draft policies stay here and are never
          evaluated.
        </p>
      </div>

      <section aria-live="polite" className="mt-0 flex flex-wrap items-center justify-between gap-4 border-b border-edge bg-surface px-4 py-4">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {STATUS_ORDER.map((status) => (
            <Count
              key={status}
              status={status}
              count={counts[status]}
              selected={statusFilter === status}
              onSelect={() => selectStatus(status)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setTab("discover");
            }}
            className="btn btn-secondary btn-sm"
          >
            Browse policy library
          </button>
          <button
            type="button"
            onClick={() => setCreating((current) => !current)}
            className="btn btn-primary"
          >
            {creating ? "Close builder" : "Build a custom policy"}
          </button>
        </div>
      </section>

      {hasVerdicts && harnessName && (
        <p className="mt-2 text-xs text-faint">Last verdicts are from {harnessName}.</p>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-edge">
        <div role="tablist" aria-label="Policy views" className="flex gap-1" onKeyDown={onTabKeyDown}>
          <TabButton id="policies-tab-mine" selected={tab === "mine" && !creating} controls="policies-panel" onSelect={() => { setCreating(false); setTab("mine"); }}>
            My Policies
          </TabButton>
          <TabButton id="policies-tab-discover" selected={tab === "discover" && !creating} controls="policies-panel" onSelect={() => { setCreating(false); setTab("discover"); }}>
            Discover
          </TabButton>
        </div>
      </div>

      <CategoryFilter selected={categorySet} onClear={() => setCategories([])} onToggle={toggleCategory} />

      <div id="policies-panel" role="tabpanel" aria-labelledby={tab === "mine" ? "policies-tab-mine" : "policies-tab-discover"} className="mt-4">
        {creating ? (
          <CustomPolicyPanel onClose={closeBuilder} onCreated={onCreated} />
        ) : tab === "mine" ? (
          <MineView policies={visibleMine} total={policies.length} focusId={focusId} harnessName={harnessName} onStatusChanged={(id, status) => setStatusOverride((current) => ({ ...current, [id]: status }))} onBrowse={() => setTab("discover")} onBuild={() => setCreating(true)} />
        ) : (
          <DiscoverView policies={visibleLibrary} onAdopted={onCreated} onOpenMine={openMine} />
        )}
      </div>
    </div>
  );
}

function Count({
  status,
  count,
  selected,
  onSelect,
}: {
  status: PolicyLifecycle;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`inline-flex items-center gap-2 rounded-sm px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? "bg-background ring-1 ring-edge-strong" : "hover:bg-background"
      }`}
    >
      <StatusDot status={status} size={selected ? "md" : "sm"} quiet={!selected} />
      <span className={`font-mono text-sm tabular-nums ${selected ? "text-foreground" : "text-muted"}`}>{count}</span>
    </button>
  );
}

function TabButton({
  id,
  selected,
  controls,
  onSelect,
  children,
}: {
  id: string;
  selected: boolean;
  controls: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`eyebrow px-3 py-2 ${
        selected ? "border-b-2 border-accent-fill text-foreground" : "text-faint hover:text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function CategoryFilter({
  selected,
  onClear,
  onToggle,
}: {
  selected: Set<string>;
  onClear: () => void;
  onToggle: (principle: string) => void;
}) {
  return (
    <div role="group" aria-label="Filter by category" className="mt-3 flex flex-wrap gap-1.5">
      <FilterChip pressed={selected.size === 0} onClick={onClear}>
        All
      </FilterChip>
      {POLICY_PRINCIPLES.map((principle) => (
        <FilterChip key={principle} pressed={selected.has(principle)} onClick={() => onToggle(principle)}>
          {principle}
        </FilterChip>
      ))}
    </div>
  );
}

function FilterChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] ${
        pressed ? "border-edge-strong bg-surface-raised text-foreground" : "border-edge text-faint hover:text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function MineView({
  policies,
  total,
  focusId,
  harnessName,
  onStatusChanged,
  onBrowse,
  onBuild,
}: {
  policies: PolicyListItem[];
  total: number;
  focusId: string | null;
  harnessName: string | null;
  onStatusChanged: (id: string, status: PolicyLifecycle) => void;
  onBrowse: () => void;
  onBuild: () => void;
}) {
  if (total === 0) {
    return (
      <section className="border border-dashed border-edge bg-surface px-6 py-14 text-center">
        <h2 className="text-base font-medium tracking-tight">No policies yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Adopt a starter policy or build your own. New policies begin as drafts. Set one to Active when you want it
          protecting a harness.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onBrowse} className="btn btn-secondary btn-sm">
            Browse policy library
          </button>
          <button type="button" onClick={onBuild} className="btn btn-primary">
            Build a custom policy
          </button>
        </div>
      </section>
    );
  }

  if (policies.length === 0) {
    return <p className="panel px-4 py-6 text-sm text-muted">No policies match this filter.</p>;
  }

  const rows: Array<
    | { type: "status"; status: PolicyLifecycle }
    | { type: "category"; status: PolicyLifecycle; principle: string }
    | { type: "policy"; policy: PolicyListItem }
  > = [];
  for (const status of STATUS_ORDER) {
    const group = policies.filter((policy) => policy.status === status);
    if (group.length === 0) continue;
    rows.push({ type: "status", status });
    const extra = [...new Set(group.map((policy) => policy.principle))].filter(
      (principle) => !(POLICY_PRINCIPLES as readonly string[]).includes(principle)
    );
    const principles = [
      ...POLICY_PRINCIPLES.filter((principle) => group.some((policy) => policy.principle === principle)),
      ...extra,
    ];
    for (const principle of principles) {
      const inCategory = group.filter((policy) => policy.principle === principle);
      if (inCategory.length === 0) continue;
      rows.push({ type: "category", status, principle });
      for (const policy of inCategory) rows.push({ type: "policy", policy });
    }
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        if (row.type === "status") {
          return (
            <div key={row.status} className="pt-4 first:pt-0">
              <h2 className="text-sm font-medium">{row.status === "active" ? "Active" : row.status === "paused" ? "Paused" : "Draft"}</h2>
              <p className="text-xs text-muted">{STATUS_NOTE[row.status]}</p>
            </div>
          );
        }
        if (row.type === "category") {
          return (
            <h3 key={`${row.status}-${row.principle}`} className="pt-2 eyebrow">
              {row.principle}
            </h3>
          );
        }
        return (
          <PolicyCard
            key={row.policy.id}
            policy={row.policy}
            initiallyOpen={focusId === row.policy.id}
            harnessName={harnessName}
            onStatusChanged={(status) => onStatusChanged(row.policy.id, status)}
          />
        );
      })}
    </div>
  );
}

function DiscoverView({
  policies,
  onAdopted,
  onOpenMine,
}: {
  policies: LibraryListItem[];
  onAdopted: (policyId: string) => void;
  onOpenMine: (policyId: string) => void;
}) {
  if (policies.length === 0) {
    return <p className="panel px-4 py-6 text-sm text-muted">No library policies in this category.</p>;
  }

  const principles = POLICY_PRINCIPLES.filter((principle) => policies.some((policy) => policy.principle === principle));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Eighteen starter policies. Adopt copies one into My Policies as a draft. The library original stays unchanged.
      </p>
      {principles.map((principle) => (
        <section key={principle}>
          <h2 className="eyebrow">{principle}</h2>
          <div className="mt-2 space-y-2">
            {policies
              .filter((policy) => policy.principle === principle)
              .map((policy) => (
                <LibraryCard key={policy.id} policy={policy} onAdopted={onAdopted} onOpenMine={onOpenMine} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
