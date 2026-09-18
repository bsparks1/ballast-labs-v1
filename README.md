# Ballast — Agent Harness Audit

Ballast audits the **harness** of an AI agent — the configuration that controls what the agent is allowed to do: its system prompt, tool permissions, memory settings, guardrails, and delegation rules.

Paste an agent's system prompt, or point Ballast at a public GitHub repo (or upload the files). Ballast extracts what it can of the six-component harness, analyzes it, and renders a health dashboard with specific, evidence-backed findings.

V2 keeps that audit and wraps it in a **system of record**: named harnesses, immutable versions, diffs of what each change did to findings and score, a timeline, and on-demand re-analysis. Repo ingestion plus versioning is the audit trail of the real harness over time.

## Quick start

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY, DATABASE_URL, SESSION_SECRET
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). One-off audits still work from the home page. Sign in (or **Continue as demo user**) and open **My Harnesses** to save a named harness.

Without an `ANTHROPIC_API_KEY`, analysis will not run. SQLite lives at `prisma/dev.db` (prototype storage; swap the data-access layer in `lib/db` for Postgres later).

To seed a demo harness with three versions (clean → conflicted → restored) without live model calls:

```bash
npx tsx scripts/seed-v2.ts
```

Then sign in with **Continue as demo user** and open My Harnesses.

## Architecture

The analysis engine is unchanged. Persistence and repo ingestion wrap it.

- **Ingestion adapters** (`lib/ingest`): `RepoFileAccess` → framework adapter → canonical `HarnessModel` + `CoverageReport` → assembled prompt/config for the existing engine. `LangGraphAdapter` covers LangChain/LangGraph (Python and TypeScript). Other frameworks register the same way; unmatched repos fall through to `GenericAdapter`.
- **Layer A — deterministic** (`lib/analysis/structural.ts`): instruction extraction, fossils, tool grants, structural findings.
- **Layer B — model-graded** (`lib/analysis/conflicts.ts` and the pass panel): contradiction, injection, tool-mismatch, ambiguity, missing-constraint passes.
- **Scoring** (`lib/analysis/scoring.ts`): severity-weighted, deterministic.
- **Storage** (`lib/db`): Prisma + SQLite behind a `DataStore` interface. `User`, `Harness`, `HarnessVersion` (immutable snapshots), `AnalysisResult` (engine output).
- **Version diff** (`lib/harness/diff.ts`): instruction-level content diff, findings new/resolved/persisted, score delta copy.

One-off audits still live in `sessionStorage` (`lib/report-store.ts`). Named harnesses are stored on the server.

## Views

- `/` — one-off input: paste a prompt **or** ingest a public GitHub repo / zip
- `/report` — session analysis dashboard, coverage report for repo ingests, option to save as a named harness
- `/harnesses` — My Harnesses: name, current score, last updated, finding count
- `/harnesses/new` — create Version 1 from paste or repo extraction
- `/harnesses/[id]` — stored analysis for a version (includes extraction coverage when ingested from a repo)
- `/harnesses/[id]/edit` — save a new immutable version (including re-ingest from the same repo) and land on the diff
- `/harnesses/[id]/diff` — instruction diff, findings churn, score delta
- `/harnesses/[id]/timeline` — chronological change log, exportable as markdown
- `/debug` — raw `HarnessReport` JSON
