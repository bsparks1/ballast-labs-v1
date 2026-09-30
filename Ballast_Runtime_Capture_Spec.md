# Ballast Labs — Runtime Harness Capture (SDK + OTel Consumer)
## Cursor Build Spec — V2 (decisions locked 2026-09-29)

> **Purpose.** Add a second ingestion path to Ballast that captures the *effective, deployed* harness at runtime — not the aspirational harness in a repo. This closes the gap on the components static analysis physically cannot see: **Memory**, **Knowledge**, and **Guardrails**, which are runtime state, not source code.
>
> **Scope discipline.** This is schema-first. The `HarnessSnapshot` data model is the asset; the SDK and OTel consumer are two disposable ways to populate it. One language (Python), the Next.js app as collector, dogfooded against an in-repo agent. No multi-tenant auth, no hosted collector, no other-language SDKs, no CI-gate, no drift-over-time. Those are real and all premature.

---

## LOCKED DECISIONS — read before building

These resolve the two architecture questions raised against the repo (single Next.js app on Prisma + SQLite; six harness components already exist as analysis types with a `extracted / not_found / not_applicable` vocabulary; no `ObservationStatus`, no Python, no agent in-tree).

**Decision 1 — collector shape: Next.js is the collector (option B).**
- **One and only one DB writer: the Next.js app.** SQLite punishes concurrent writers; a FastAPI sidecar or a forwarding service earns no product benefit at this stage.
- The Python package ships **schema + SDK only**. The SDK POSTs JSON to a Next.js route `POST /api/v1/snapshots`; Next validates and performs the single write. No FastAPI, no Prisma Python client, no second process to run in dev.

**Decision 2 — dogfood target: minimal in-repo agent (option B), then real agent (A) as the next step.**
- Ship a committed dogfood agent script that uses the SDK end to end, so `git clone` → one command → a real snapshot flows through. It is a permanent integration test.
- Instrumenting the real OpenClaw/NemoClaw procurement agent is the immediate follow-on **after** the in-repo agent proves the mechanism — do NOT pull that agent into this repo now.

**Three conditions that are part of the spec (non-negotiable):**

1. **JSON Schema is the source-of-truth contract.** The schema lives in two languages (Pydantic for the SDK, Zod/TS for Next validation) — accepted deliberately, because the alternative (a shared writer process) is operationally worse. Mitigation: generate a JSON Schema from the Pydantic model, commit it, validate the Zod side against it, and add **one contract test that round-trips a fixture snapshot through both validators** so they cannot silently diverge. The wire format is the contract; both bindings conform to it.
2. **Snapshots are a NEW parallel table** — never stuffed into `AnalysisResult`.
3. **Keep the two vocabularies separate.** Runtime uses `observed / not_observed / absent`; static keeps its existing `extracted / not_found / not_applicable`. Do NOT unify them into one enum now — that is premature abstraction that quietly corrupts the fail-closed semantics. Map both to a shared *display* layer later. And enforce end to end: `not_observed` must never render or score as clean/compliant — it renders as **"Not observed — connect runtime to govern this component."**

---

## 0. Grounding facts (verified 2026-09-29 — do not skip)

The OpenTelemetry GenAI semantic conventions were re-homed to `open-telemetry/semantic-conventions-genai` and **every `gen_ai.*` span and attribute is at `Development` stability** — they can change between releases with no deprecation window.

**Consequences this spec enforces:**

1. **We never treat OTel spans as our source of truth.** We map them into our own stable `HarnessSnapshot` at ingest. Pin the instrumentation library version; treat inbound attributes as best-effort.
2. **OTel is strong on Instructions/Tools/Delegation, weak-to-absent on Knowledge/Memory/Guardrails.** Retrieval currently borrows `db.*` conventions; there is no stable memory attribute set; there is no guardrail span at all. Our schema defines these as first-class regardless, and we fail closed (`not_observed`) where the runtime gives us nothing.

**OTel operation → harness component mapping (build the consumer against this table):**

| OTel operation | Span name format | Harness component | Key attributes to read |
|---|---|---|---|
| `chat`, `text_completion`, `generate_content` | `{op} {request.model}` | Instructions | `gen_ai.system_instructions`, `gen_ai.request.model`, `gen_ai.request.temperature`, `gen_ai.usage.*` |
| `execute_tool` | `execute_tool {tool.name}` | Tools | `gen_ai.tool.name`, `gen_ai.tool.type`, `gen_ai.tool.call.id`, `gen_ai.tool.definitions` |
| `invoke_agent`, `create_agent`, `plan` | `{op} {agent.name}` | Delegation | `gen_ai.agent.name`, `gen_ai.agent.id`, `gen_ai.agent.version` |
| `retrieval` | `{op} {data_source.id}` | Knowledge | `db.system`, `db.operation.name`, `db.vector.top_k`, data_source id (best-effort) |
| memory ops | `{op}` | Memory | none standard yet — capture via SDK, fail closed on OTel |
| (none) | — | Guardrails | no OTel representation — SDK-only |

Session correlation: there is **no** standard `gen_ai.conversation.id`. Use `session.id` / `user.id` as span attributes and carry them onto our snapshot as `session_id`.

---

## 1. The `HarnessSnapshot` schema (build this FIRST — lock it before any capture code)

One canonical object representing the resolved harness for **one agent invocation**. This is the SAME canonical model the existing repo-scrape path targets — populated from runtime instead of static source. One model, two ingestion paths. Do not fork the schema.

Use Pydantic v2. Every field that a given ingestion path cannot populate is explicitly `ObservationStatus.NOT_OBSERVED`, never silently null and never defaulted to a "clean" value.

```python
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime

class ObservationStatus(str, Enum):
    OBSERVED = "observed"          # we captured real data
    NOT_OBSERVED = "not_observed"  # this ingestion path cannot see it — NOT the same as "absent" or "clean"
    ABSENT = "absent"              # observed to be genuinely not present (e.g. no guardrail ran)

class IngestionSource(str, Enum):
    STATIC_REPO = "static_repo"
    SDK = "sdk"
    OTEL = "otel"

# --- Six harness components, each a discrete observable ---

class InstructionsObservation(BaseModel):
    status: ObservationStatus
    resolved_prompt: str | None = None      # the ACTUAL string sent, post-template-resolution
    model: str | None = None
    temperature: float | None = None
    prompt_source: str | None = None         # e.g. "langfuse:prompt/agent-v3", "inline", "db"

class ToolObservation(BaseModel):
    name: str
    type: str | None = None                  # function | extension | datastore | mcp
    definition_hash: str | None = None       # hash of the resolved tool schema
    invoked: bool = False                     # was it actually called this invocation

class ToolsObservation(BaseModel):
    status: ObservationStatus
    bound_tools: list[ToolObservation] = Field(default_factory=list)  # what was AVAILABLE
    # note: bound != invoked. Governance cares about the permission surface, not just usage.

class KnowledgeObservation(BaseModel):
    status: ObservationStatus
    sources_hit: list[str] = Field(default_factory=list)   # data_source ids / vector index names
    retrieval_config: dict = Field(default_factory=dict)   # top_k, filters, embedding model

class MemoryObservation(BaseModel):
    status: ObservationStatus
    store: str | None = None                 # redis | mem0 | zep | custom
    keys_read: list[str] = Field(default_factory=list)
    keys_written: list[str] = Field(default_factory=list)
    # governance cares: what memory can this agent read/write, and did it persist anything cross-session

class GuardrailObservation(BaseModel):
    status: ObservationStatus
    guardrails_invoked: list[str] = Field(default_factory=list)  # name of each guard that ran
    blocked: bool = False
    # no OTel representation — SDK-only. If OTEL source: status = NOT_OBSERVED, always.

class DelegationObservation(BaseModel):
    status: ObservationStatus
    agent_name: str | None = None
    agent_version: str | None = None
    delegated_to: list[str] = Field(default_factory=list)  # sub-agents/agents this one can invoke

# --- The snapshot ---

class HarnessSnapshot(BaseModel):
    snapshot_id: str
    agent_id: str
    session_id: str | None = None
    captured_at: datetime
    source: IngestionSource                  # which path produced this — critical for fidelity display

    instructions: InstructionsObservation
    tools: ToolsObservation
    knowledge: KnowledgeObservation
    memory: MemoryObservation
    guardrails: GuardrailObservation
    delegation: DelegationObservation

    def coverage(self) -> dict[str, ObservationStatus]:
        """Per-component observation status — drives the 'not observed → connect runtime' UX."""
        return {c: getattr(self, c).status for c in
                ["instructions","tools","knowledge","memory","guardrails","delegation"]}
```

**Non-negotiable rule for scoring/UI (carry the fail-closed discipline from the analysis engine):**
`NOT_OBSERVED` must NEVER render or score as compliant/clean. It renders as an explicit empty state: **"Not observed — connect runtime to govern this component."** That empty state is the upsell, not a defect. `ABSENT` (we looked and it genuinely wasn't there) is different and may be fine. Keep the three states distinct end to end — same rule we hold in the analysis reports.

---

## 2. Python SDK (populate `HarnessSnapshot` from SDK source)

A thin decorator + context managers. No cloud, no auth. Emits one `HarnessSnapshot` per invocation to the local collector.

```python
import ballast

ballast.init(collector_url="http://localhost:8787", agent_id="procurement-agent")

@ballast.track(agent_id="procurement-agent")
def run_agent(user_input: str):
    # inside the invocation, the SDK records what actually resolves:
    ballast.instructions(resolved_prompt=system_prompt, model="claude-opus-4-8",
                         prompt_source="inline")
    ballast.tools(bound=[{"name": "search_vendors", "type": "function"},
                         {"name": "create_po", "type": "function"}])
    ballast.knowledge(sources_hit=["vendor-index"], retrieval_config={"top_k": 5})
    ballast.memory(store="redis", keys_read=["prefs:acme"], keys_written=["last_po:acme"])
    ballast.guardrail(name="pii_filter", invoked=True, blocked=False)
    ballast.delegation(agent_name="procurement-agent", delegated_to=["approval-agent"])
    ...
```

Requirements:
- `@ballast.track` opens an invocation context, assembles a `HarnessSnapshot`, POSTs it on exit (success or exception — capture partial harness on failure too).
- Component recorders (`ballast.tools(...)` etc.) set `status=OBSERVED` for whatever they populate. Anything not called during the invocation stays `NOT_OBSERVED`.
- Zero hard dependency on the agent framework. Pure functions the developer calls. (Auto-instrumentation wrappers for LangGraph/etc. are a later nicety, not V1.)
- Fully offline-safe: if the collector is unreachable, buffer to a local JSONL file, never crash the host agent. **The SDK must never take down the agent it observes.**

---

## 3. Local collector (one endpoint, existing store)

A FastAPI service. Writes `HarnessSnapshot` rows into the existing Prisma/SQLite DB the V1 app already uses. Reuse the app's DB, don't stand up a new one.

- `POST /v1/snapshots` — accepts a `HarnessSnapshot` JSON, validates against the Pydantic model, persists. Reject malformed payloads with a clear 422 (fail closed — a snapshot that doesn't validate is not stored as a partial "clean" record).
- `GET /v1/agents/{agent_id}/snapshots` — list for the dashboard.
- Persist `source` on every row so the UI can badge fidelity (static vs sdk vs otel).

---

## 4. OTel consumer (populate the SAME schema from OTel spans)

A second populator. Ingests OpenTelemetry GenAI spans and maps them into `HarnessSnapshot` using the table in §0. This is the strategically important half: it plugs into infra teams already emitting OTel without asking them to adopt our SDK.

- Implement as an OTLP receiver (accept OTLP/HTTP protobuf or JSON) OR, simplest for V1, a small span-batch endpoint that accepts exported spans. Prefer consuming a standard OTLP export so we're compatible with any OTel SDK/collector.
- Group spans by trace/session into one logical invocation, then map:
  - `chat` span → `InstructionsObservation` (+ model/temp)
  - each `execute_tool` span → a `ToolObservation` (invoked=True)
  - `invoke_agent`/`create_agent` → `DelegationObservation`
  - `retrieval` (or `db.*` vector spans) → `KnowledgeObservation`
  - memory: **`NOT_OBSERVED`** unless a custom span carries it (no standard exists — do not fabricate)
  - guardrails: **always `NOT_OBSERVED`** from OTel (no representation exists)
- **Version-pin and defensively parse.** Attributes are `Development`-stage; a missing/renamed attribute must degrade to `NOT_OBSERVED`, never throw, never guess.
- Tag every produced snapshot `source=OTEL`.

---

## 5. Dogfood (the actual point of building this pre-customer)

Instrument **one of our own real agents** — the procurement agent (OpenClaw/NemoClaw) or the deal-sourcing agent — with the SDK. Capture real snapshots. Render them in the existing dashboard next to the repo-scrape view of the same agent.

**Success criterion for V1:** looking at our own agent's captured Memory + Knowledge + Tools next to its resolved prompt, we can answer within a day: *is the `HarnessSnapshot` schema right?* If a real component doesn't fit the model, the model changes — that's the entire pre-customer value of this build. We become user #1 and find the schema's flaws against ground truth we control.

---

## 6. Explicitly OUT of scope for V1 (do not let Cursor wander here)

- Multi-tenant auth / API keys / hosted collector
- SDKs in languages other than Python
- Auto-instrumentation of specific frameworks
- Drift detection / diffing snapshots over time
- The CI/CD merge gate
- Any dashboard work beyond rendering a single agent's snapshots with per-component coverage badges

---

## Build order (enforce this sequence)

1. `HarnessSnapshot` schema + `ObservationStatus`/`IngestionSource` enums, with unit tests asserting `NOT_OBSERVED` never coerces to clean.
2. Local collector (`POST /v1/snapshots`, validation, persistence to existing DB).
3. Python SDK (`init`, `@track`, component recorders, offline buffer).
4. Dogfood the SDK against one real agent; capture snapshots; render coverage badges.
5. OTel consumer mapping spans → snapshot, version-pinned and defensive.
6. Dogfood the OTel path (point any OTel-instrumented run at the consumer) and reconcile with the SDK snapshot of the same agent.

Ship 1–4 first and stop to review before 5. The SDK path proves the schema; the OTel path proves the wedge.
```
