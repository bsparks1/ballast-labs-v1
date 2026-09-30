/**
 * Runtime harness snapshot types — wire format is snake_case (shared with Python SDK).
 * Do NOT conflate ObservationStatus with static CoverageStatus (extracted/not_found/…).
 */

export type ObservationStatus = "observed" | "not_observed" | "absent";

export type SnapshotIngestionSource = "static_repo" | "sdk" | "otel";

export type InstructionsObservation = {
  status: ObservationStatus;
  resolved_prompt?: string | null;
  model?: string | null;
  temperature?: number | null;
  prompt_source?: string | null;
};

export type ToolObservation = {
  name: string;
  type?: string | null;
  definition_hash?: string | null;
  invoked?: boolean;
};

export type ToolsObservation = {
  status: ObservationStatus;
  bound_tools?: ToolObservation[];
};

export type KnowledgeObservation = {
  status: ObservationStatus;
  sources_hit?: string[];
  retrieval_config?: Record<string, unknown>;
};

export type MemoryObservation = {
  status: ObservationStatus;
  store?: string | null;
  keys_read?: string[];
  keys_written?: string[];
};

export type GuardrailObservation = {
  status: ObservationStatus;
  guardrails_invoked?: string[];
  blocked?: boolean;
};

export type DelegationObservation = {
  status: ObservationStatus;
  agent_name?: string | null;
  agent_version?: string | null;
  delegated_to?: string[];
};

export type HarnessSnapshotWire = {
  snapshot_id: string;
  agent_id: string;
  session_id?: string | null;
  captured_at: string;
  source: SnapshotIngestionSource;
  instructions: InstructionsObservation;
  tools: ToolsObservation;
  knowledge: KnowledgeObservation;
  memory: MemoryObservation;
  guardrails: GuardrailObservation;
  delegation: DelegationObservation;
};

export const SNAPSHOT_COMPONENTS = [
  "instructions",
  "tools",
  "knowledge",
  "memory",
  "guardrails",
  "delegation",
] as const;

export type SnapshotComponent = (typeof SNAPSHOT_COMPONENTS)[number];

export function snapshotCoverage(
  snap: Pick<
    HarnessSnapshotWire,
    "instructions" | "tools" | "knowledge" | "memory" | "guardrails" | "delegation"
  >
): Record<SnapshotComponent, ObservationStatus> {
  return {
    instructions: snap.instructions.status,
    tools: snap.tools.status,
    knowledge: snap.knowledge.status,
    memory: snap.memory.status,
    guardrails: snap.guardrails.status,
    delegation: snap.delegation.status,
  };
}
