/**
 * Storage-agnostic records. All database access returns these types so the
 * engine (Prisma/SQLite today, Postgres later) can be swapped behind lib/db.
 */

import type {
  ComplianceDelta,
  ComplianceReport,
  ComponentReport,
  Finding,
  HarnessComponent,
  HarnessReport,
  PassStatus,
  PolicyCheckResult,
  PolicyLifecycle,
  PolicySource,
  Severity,
} from "@/lib/types";
import type {
  DelegationObservation,
  GuardrailObservation,
  InstructionsObservation,
  KnowledgeObservation,
  MemoryObservation,
  SnapshotIngestionSource,
  ToolsObservation,
} from "@/lib/snapshot/types";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  sessionVersion: number;
};

export type PublicUser = {
  id: string;
  email: string;
};

export type HarnessRecord = {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  lastViewedAt: Date | null;
};

export type HarnessVersionRecord = {
  id: string;
  harnessId: string;
  versionNumber: number;
  rawPrompt: string;
  rawConfig: string;
  createdAt: Date;
  note: string;
};

export type AnalysisMeta = HarnessReport["meta"] & { passes: PassStatus[] };

export type AnalysisRecord = {
  id: string;
  harnessVersionId: string;
  overallScore: number;
  componentReports: ComponentReport[];
  findings: Finding[];
  meta: AnalysisMeta;
  createdAt: Date;
};

export type HarnessSummary = {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  lastViewedAt: Date | null;
  currentVersionNumber: number | null;
  currentVersionId: string | null;
  currentScore: number | null;
  findingCount: number;
  lastAnalyzedAt: Date | null;
  latestAnalysisId: string | null;
  analysisCountOnCurrent: number;
};

export type CreateHarnessInput = {
  userId: string;
  name: string;
  description?: string;
};

export type CreateVersionInput = {
  harnessId: string;
  rawPrompt: string;
  rawConfig?: string;
  note?: string;
};

export type CreateAnalysisInput = {
  harnessVersionId: string;
  overallScore: number;
  componentReports: ComponentReport[];
  findings: Finding[];
  meta: AnalysisMeta;
};

export type PolicyRecord = {
  id: string;
  userId: string | null;
  code: string;
  principle: string;
  name: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
  source: PolicySource;
  createdBy: string | null;
  /** When the current version was written. */
  createdAt: Date;
  policyCreatedAt: Date;
  version: number;
  versionId: string;
  checker: string | null;
  adoptedFromId: string | null;
  status: PolicyLifecycle;
  deletedAt: Date | null;
  note: string;
  confidence: "high" | "low" | null;
  generationNote: string;
};

export type PolicyVersionRecord = {
  id: string;
  policyId: string;
  versionNumber: number;
  name: string;
  code: string;
  principle: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
  source: PolicySource;
  checker: string | null;
  createdBy: string | null;
  createdAt: Date;
  note: string;
  confidence: "high" | "low" | null;
  generationNote: string;
};

export type StarterPolicySeed = {
  code: string;
  principle: string;
  name: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
};

export type CreatePolicyInput = {
  userId: string;
  code: string;
  principle: string;
  name: string;
  statement: string;
  checkableIntent: string;
  components: HarnessComponent[];
  frameworks: string[];
  severity: Severity;
  source: PolicySource;
  checker: string | null;
  createdBy: string | null;
  adoptedFromId?: string | null;
  /** New user policies start as draft. Existing rows migrated as active. */
  status: PolicyLifecycle;
  note?: string;
  confidence?: "high" | "low" | null;
  generationNote?: string;
};

export type AddPolicyVersionInput = {
  statement: string;
  checkableIntent: string;
  severity: Severity;
  source: PolicySource;
  checker: string | null;
  createdBy: string | null;
  note?: string;
  components?: HarnessComponent[];
  frameworks?: string[];
  name?: string;
  confidence?: "high" | "low" | null;
  generationNote?: string;
};

export type ComplianceReportRecord = {
  id: string;
  harnessVersionId: string;
  policyPackVersion: string;
  results: PolicyCheckResult[];
  summary: ComplianceReport["summary"];
  overallStatus: ComplianceReport["overallStatus"];
  delta: ComplianceDelta | null;
  generatedAt: Date;
};

export type CreateComplianceReportInput = {
  harnessVersionId: string;
  policyPackVersion: string;
  results: PolicyCheckResult[];
  summary: ComplianceReport["summary"];
  overallStatus: ComplianceReport["overallStatus"];
  delta: ComplianceDelta | null;
};

export type HarnessComplianceEntry = {
  report: ComplianceReportRecord;
  versionNumber: number;
};

export type HarnessSnapshotRecord = {
  id: string;
  snapshotId: string;
  agentId: string;
  sessionId: string | null;
  capturedAt: Date;
  source: SnapshotIngestionSource;
  instructions: InstructionsObservation;
  tools: ToolsObservation;
  knowledge: KnowledgeObservation;
  memory: MemoryObservation;
  guardrails: GuardrailObservation;
  delegation: DelegationObservation;
  createdAt: Date;
};

export type CreateHarnessSnapshotInput = {
  snapshotId: string;
  agentId: string;
  sessionId?: string | null;
  capturedAt: Date;
  source: SnapshotIngestionSource;
  instructions: InstructionsObservation;
  tools: ToolsObservation;
  knowledge: KnowledgeObservation;
  memory: MemoryObservation;
  guardrails: GuardrailObservation;
  delegation: DelegationObservation;
};
