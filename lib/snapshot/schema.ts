import { z } from "zod";

const observationStatus = z.enum(["observed", "not_observed", "absent"]);
const ingestionSource = z.enum(["static_repo", "sdk", "otel"]);

const instructionsObservation = z
  .object({
    status: observationStatus,
    resolved_prompt: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    temperature: z.number().nullable().optional(),
    prompt_source: z.string().nullable().optional(),
  })
  .strict();

const toolObservation = z
  .object({
    name: z.string().min(1),
    type: z.string().nullable().optional(),
    definition_hash: z.string().nullable().optional(),
    invoked: z.boolean().optional().default(false),
  })
  .strict();

const toolsObservation = z
  .object({
    status: observationStatus,
    bound_tools: z.array(toolObservation).optional().default([]),
  })
  .strict();

const knowledgeObservation = z
  .object({
    status: observationStatus,
    sources_hit: z.array(z.string()).optional().default([]),
    retrieval_config: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .strict();

const memoryObservation = z
  .object({
    status: observationStatus,
    store: z.string().nullable().optional(),
    keys_read: z.array(z.string()).optional().default([]),
    keys_written: z.array(z.string()).optional().default([]),
  })
  .strict();

const guardrailObservation = z
  .object({
    status: observationStatus,
    guardrails_invoked: z.array(z.string()).optional().default([]),
    blocked: z.boolean().optional().default(false),
  })
  .strict();

const delegationObservation = z
  .object({
    status: observationStatus,
    agent_name: z.string().nullable().optional(),
    agent_version: z.string().nullable().optional(),
    delegated_to: z.array(z.string()).optional().default([]),
  })
  .strict();

/** Wire-format HarnessSnapshot — snake_case, fail closed on extra keys. */
export const harnessSnapshotSchema = z
  .object({
    snapshot_id: z.string().min(1),
    agent_id: z.string().min(1),
    session_id: z.string().nullable().optional(),
    captured_at: z.string().min(1),
    source: ingestionSource,
    instructions: instructionsObservation,
    tools: toolsObservation,
    knowledge: knowledgeObservation,
    memory: memoryObservation,
    guardrails: guardrailObservation,
    delegation: delegationObservation,
  })
  .strict();

export type HarnessSnapshotParsed = z.infer<typeof harnessSnapshotSchema>;
