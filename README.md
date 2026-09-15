# Ballast — Agent Harness Audit

Ballast audits the **harness** of an AI agent — the configuration that controls what the agent is allowed to do: its system prompt, tool permissions, memory settings, guardrails, and delegation rules.

Paste an agent's system prompt (and optionally a tool config in JSON/YAML). Ballast decomposes it, analyzes it, and renders a health dashboard with specific, evidence-backed findings — e.g. *"Your agent has 47 instructions. 3 directly contradict each other. 6 do nothing. It holds write access to 5 tools it has never used."*

## Quick start

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click one of the "Try" sample buttons — the bundled samples demo every finding type with zero prep.

Without an `ANTHROPIC_API_KEY`, everything still works except model-graded conflict detection; reports ship with the deterministic findings only.

## Architecture

Two strictly separated analysis layers, both behind one API route (`app/api/analyze`):

- **Layer A — deterministic** (`lib/analysis/structural.ts`): pure TypeScript, no model calls. Instruction extraction and classification (absolute / conditional / vague), fossil detection, tool-grant scanning (prose + structured config), and structural findings.
- **Layer B — model-graded** (`lib/analysis/conflicts.ts`): server-side Anthropic calls. Pass 1 finds candidate instruction conflicts under a strict rubric; pass 2 independently re-verifies each candidate. Only verified conflicts become findings, with both rules quoted as evidence. Any failure degrades gracefully to Layer A results.
- **Scoring** (`lib/analysis/scoring.ts`): each component starts at 100 and loses severity-weighted points per finding; the overall score is a weighted aggregate. Deterministic and explainable.

The central data model lives in `lib/types.ts` (`HarnessReport`, `ComponentReport`, `Finding`, `Instruction`, `ToolGrant`). Everything reads from it.

V1 stores nothing server-side; the report lives in `sessionStorage` (`lib/report-store.ts` is the seam for adding a database later).

## Views

- `/` — input screen with sample prompts and the analyzing animation
- `/report` — overall health score, headline stats, six component cards
- `/report/[component]` — severity-sorted findings with evidence (side-by-side quoted rules for conflicts), plus the full instruction decomposition and parsed tool grants
- `/debug` — raw `HarnessReport` JSON, for development
