import "server-only";
import { Prisma } from "@prisma/client";
import type {
  ComplianceDelta,
  ComplianceReport,
  ComponentReport,
  Finding,
  HarnessComponent,
  PassStatus,
  PolicyCheckResult,
  PolicySource,
  Severity,
} from "@/lib/types";
import { HARNESS_COMPONENTS } from "@/lib/types";
import { prisma } from "./prisma";
import type { DataStore } from "./store";
import type {
  AddPolicyVersionInput,
  AnalysisMeta,
  AnalysisRecord,
  ComplianceReportRecord,
  CreateAnalysisInput,
  CreateComplianceReportInput,
  CreateHarnessInput,
  CreateHarnessSnapshotInput,
  CreatePolicyInput,
  CreateVersionInput,
  HarnessComplianceEntry,
  HarnessRecord,
  HarnessSnapshotRecord,
  HarnessSummary,
  HarnessVersionRecord,
  PolicyRecord,
  PolicyVersionRecord,
  StarterPolicySeed,
  UserRecord,
} from "./types";
import type {
  DelegationObservation,
  GuardrailObservation,
  InstructionsObservation,
  KnowledgeObservation,
  MemoryObservation,
  SnapshotIngestionSource,
  ToolsObservation,
} from "@/lib/snapshot/types";

function mapUser(row: {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  sessionVersion: number;
}): UserRecord {
  return row;
}

function mapHarness(row: {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  lastViewedAt: Date | null;
}): HarnessRecord {
  return row;
}

function mapVersion(row: {
  id: string;
  harnessId: string;
  versionNumber: number;
  rawPrompt: string;
  rawConfig: string;
  createdAt: Date;
  note: string;
}): HarnessVersionRecord {
  return row;
}

function asArray<T>(value: Prisma.JsonValue, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function asMeta(value: Prisma.JsonValue): AnalysisMeta {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const passes = Array.isArray(obj.passes) ? (obj.passes as PassStatus[]) : [];
  return {
    instructionCount: Number(obj.instructionCount ?? 0),
    absoluteRuleCount: Number(obj.absoluteRuleCount ?? 0),
    fossilCount: Number(obj.fossilCount ?? 0),
    verifiedConflictCount: Number(obj.verifiedConflictCount ?? 0),
    criticalFindingCount: Number(obj.criticalFindingCount ?? 0),
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString(),
    passes,
  };
}

function mapAnalysis(row: {
  id: string;
  harnessVersionId: string;
  overallScore: number;
  componentReports: Prisma.JsonValue;
  findings: Prisma.JsonValue;
  meta: Prisma.JsonValue;
  createdAt: Date;
}): AnalysisRecord {
  return {
    id: row.id,
    harnessVersionId: row.harnessVersionId,
    overallScore: row.overallScore,
    componentReports: asArray<ComponentReport>(row.componentReports, []),
    findings: asArray<Finding>(row.findings, []),
    meta: asMeta(row.meta),
    createdAt: row.createdAt,
  };
}

const SEVERITIES = new Set<Severity>(["critical", "warning", "info"]);
const SOURCES = new Set<PolicySource>(["starter", "generated", "custom"]);

function asComponents(value: Prisma.JsonValue): HarnessComponent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is HarnessComponent =>
    typeof item === "string" && HARNESS_COMPONENTS.includes(item as HarnessComponent)
  );
}

function asStringList(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asSeverity(value: string): Severity {
  return SEVERITIES.has(value as Severity) ? (value as Severity) : "warning";
}

function asSource(value: string): PolicySource {
  return SOURCES.has(value as PolicySource) ? (value as PolicySource) : "custom";
}

function asLifecycle(value: string | null | undefined): PolicyRecord["status"] {
  if (value === "paused" || value === "draft" || value === "active") return value;
  return "active";
}

function asConfidence(value: string | null | undefined): "high" | "low" | null {
  if (value === "high" || value === "low") return value;
  return null;
}

type PolicyRow = {
  id: string;
  userId: string | null;
  code: string;
  principle: string;
  name: string;
  adoptedFromId: string | null;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
};

type PolicyVersionRow = {
  id: string;
  policyId: string;
  versionNumber: number;
  statement: string;
  checkableIntent: string;
  components: Prisma.JsonValue;
  frameworks: Prisma.JsonValue;
  severity: string;
  source: string;
  checker: string | null;
  createdBy: string | null;
  createdAt: Date;
  note: string;
  confidence: string;
  generationNote: string;
};

function mapPolicy(policy: PolicyRow, version: PolicyVersionRow): PolicyRecord {
  return {
    id: policy.id,
    userId: policy.userId,
    code: policy.code,
    principle: policy.principle,
    name: policy.name,
    statement: version.statement,
    checkableIntent: version.checkableIntent,
    components: asComponents(version.components),
    frameworks: asStringList(version.frameworks),
    severity: asSeverity(version.severity),
    source: asSource(version.source),
    createdBy: version.createdBy,
    createdAt: version.createdAt,
    policyCreatedAt: policy.createdAt,
    version: version.versionNumber,
    versionId: version.id,
    checker: version.checker,
    adoptedFromId: policy.adoptedFromId,
    status: asLifecycle(policy.status),
    deletedAt: policy.deletedAt,
    note: version.note,
    confidence: asConfidence(version.confidence),
    generationNote: version.generationNote,
  };
}

function mapPolicyVersion(policy: PolicyRow, version: PolicyVersionRow): PolicyVersionRecord {
  const current = mapPolicy(policy, version);
  return {
    id: version.id,
    policyId: policy.id,
    versionNumber: version.versionNumber,
    name: current.name,
    code: current.code,
    principle: current.principle,
    statement: current.statement,
    checkableIntent: current.checkableIntent,
    components: current.components,
    frameworks: current.frameworks,
    severity: current.severity,
    source: current.source,
    checker: current.checker,
    createdBy: current.createdBy,
    createdAt: version.createdAt,
    note: version.note,
    confidence: current.confidence,
    generationNote: current.generationNote,
  };
}

function asResults(value: Prisma.JsonValue): PolicyCheckResult[] {
  return Array.isArray(value) ? (value as PolicyCheckResult[]) : [];
}

function asSummary(value: Prisma.JsonValue): ComplianceReport["summary"] {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    compliant: Number(obj.compliant ?? 0),
    violated: Number(obj.violated ?? 0),
    cannotDetermine: Number(obj.cannotDetermine ?? 0),
  };
}

function asOverall(value: string): ComplianceReport["overallStatus"] {
  if (value === "compliant" || value === "violations_present" || value === "gaps_present") return value;
  return "gaps_present";
}

function asDelta(value: Prisma.JsonValue): ComplianceDelta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const list = (key: string) =>
    Array.isArray(obj[key])
      ? (obj[key] as { policyId?: unknown; name?: unknown }[])
          .filter((item) => typeof item?.policyId === "string" && typeof item?.name === "string")
          .map((item) => ({ policyId: item.policyId as string, name: item.name as string }))
      : [];
  return {
    previousGeneratedAt: typeof obj.previousGeneratedAt === "string" ? obj.previousGeneratedAt : null,
    resolvedViolations: list("resolvedViolations"),
    newViolations: list("newViolations"),
    newGaps: list("newGaps"),
    resolvedGaps: list("resolvedGaps"),
    headline: typeof obj.headline === "string" ? obj.headline : "",
    notes: Array.isArray(obj.notes) ? obj.notes.filter((n): n is string => typeof n === "string") : [],
  };
}

function mapCompliance(row: {
  id: string;
  harnessVersionId: string;
  policyPackVersion: string;
  results: Prisma.JsonValue;
  summary: Prisma.JsonValue;
  overallStatus: string;
  delta: Prisma.JsonValue | null;
  generatedAt: Date;
}): ComplianceReportRecord {
  return {
    id: row.id,
    harnessVersionId: row.harnessVersionId,
    policyPackVersion: row.policyPackVersion,
    results: asResults(row.results),
    summary: asSummary(row.summary),
    overallStatus: asOverall(row.overallStatus),
    delta: row.delta == null ? null : asDelta(row.delta),
    generatedAt: row.generatedAt,
  };
}

function mapHarnessSnapshot(row: {
  id: string;
  snapshotId: string;
  agentId: string;
  sessionId: string | null;
  capturedAt: Date;
  source: string;
  instructions: Prisma.JsonValue;
  tools: Prisma.JsonValue;
  knowledge: Prisma.JsonValue;
  memory: Prisma.JsonValue;
  guardrails: Prisma.JsonValue;
  delegation: Prisma.JsonValue;
  createdAt: Date;
}): HarnessSnapshotRecord {
  return {
    id: row.id,
    snapshotId: row.snapshotId,
    agentId: row.agentId,
    sessionId: row.sessionId,
    capturedAt: row.capturedAt,
    source: row.source as SnapshotIngestionSource,
    instructions: row.instructions as InstructionsObservation,
    tools: row.tools as ToolsObservation,
    knowledge: row.knowledge as KnowledgeObservation,
    memory: row.memory as MemoryObservation,
    guardrails: row.guardrails as GuardrailObservation,
    delegation: row.delegation as DelegationObservation,
    createdAt: row.createdAt,
  };
}

const policyWithCurrent = {
  versions: { orderBy: { versionNumber: "desc" as const }, take: 1 },
};

export const prismaStore: DataStore = {
  async createUser(email, passwordHash) {
    const row = await prisma.user.create({
      data: { email: email.trim().toLowerCase(), passwordHash },
    });
    return mapUser(row);
  },

  async getUserById(id) {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  },

  async getUserByEmail(email) {
    const row = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? mapUser(row) : null;
  },

  async incrementSessionVersion(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  },

  async createHarness(input: CreateHarnessInput) {
    const row = await prisma.harness.create({
      data: {
        userId: input.userId,
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
      },
    });
    return mapHarness(row);
  },

  async getHarness(userId, id) {
    const row = await prisma.harness.findFirst({ where: { id, userId } });
    return row ? mapHarness(row) : null;
  },

  async listHarnesses(userId) {
    const rows = await prisma.harness.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapHarness);
  },

  async updateHarness(userId, id, data) {
    const existing = await prisma.harness.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await prisma.harness.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      },
    });
    return mapHarness(row);
  },

  async markHarnessViewed(userId, id) {
    const existing = await prisma.harness.findFirst({ where: { id, userId } });
    if (!existing) return;
    await prisma.harness.update({
      where: { id },
      data: { lastViewedAt: new Date() },
    });
  },

  async createVersion(input: CreateVersionInput) {
    return prisma.$transaction(async (tx) => {
      const last = await tx.harnessVersion.findFirst({
        where: { harnessId: input.harnessId },
        orderBy: { versionNumber: "desc" },
      });
      const row = await tx.harnessVersion.create({
        data: {
          harnessId: input.harnessId,
          versionNumber: (last?.versionNumber ?? 0) + 1,
          rawPrompt: input.rawPrompt,
          rawConfig: input.rawConfig ?? "",
          note: input.note?.trim() ?? "",
        },
      });
      await tx.harness.update({
        where: { id: input.harnessId },
        data: { updatedAt: new Date() },
      });
      return mapVersion(row);
    });
  },

  async getVersion(id) {
    const row = await prisma.harnessVersion.findUnique({ where: { id } });
    return row ? mapVersion(row) : null;
  },

  async getVersionByNumber(harnessId, versionNumber) {
    const row = await prisma.harnessVersion.findUnique({
      where: { harnessId_versionNumber: { harnessId, versionNumber } },
    });
    return row ? mapVersion(row) : null;
  },

  async listVersions(harnessId) {
    const rows = await prisma.harnessVersion.findMany({
      where: { harnessId },
      orderBy: { versionNumber: "asc" },
    });
    return rows.map(mapVersion);
  },

  async getLatestVersion(harnessId) {
    const row = await prisma.harnessVersion.findFirst({
      where: { harnessId },
      orderBy: { versionNumber: "desc" },
    });
    return row ? mapVersion(row) : null;
  },

  async createAnalysis(input: CreateAnalysisInput) {
    const row = await prisma.analysisResult.create({
      data: {
        harnessVersionId: input.harnessVersionId,
        overallScore: input.overallScore,
        componentReports: input.componentReports as unknown as Prisma.InputJsonValue,
        findings: input.findings as unknown as Prisma.InputJsonValue,
        meta: input.meta as unknown as Prisma.InputJsonValue,
      },
    });
    return mapAnalysis(row);
  },

  async getAnalysis(id) {
    const row = await prisma.analysisResult.findUnique({ where: { id } });
    return row ? mapAnalysis(row) : null;
  },

  async listAnalyses(harnessVersionId) {
    const rows = await prisma.analysisResult.findMany({
      where: { harnessVersionId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapAnalysis);
  },

  async getLatestAnalysis(harnessVersionId) {
    const row = await prisma.analysisResult.findFirst({
      where: { harnessVersionId },
      orderBy: { createdAt: "desc" },
    });
    return row ? mapAnalysis(row) : null;
  },

  async listHarnessSummaries(userId): Promise<HarnessSummary[]> {
    const rows = await prisma.harness.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: {
            analyses: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    return rows.map((h) => {
      const current = h.versions[0] ?? null;
      const latest = current?.analyses[0] ?? null;
      const findings = latest ? asArray<Finding>(latest.findings, []) : [];
      return {
        id: h.id,
        name: h.name,
        description: h.description,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
        lastViewedAt: h.lastViewedAt,
        currentVersionNumber: current?.versionNumber ?? null,
        currentVersionId: current?.id ?? null,
        currentScore: latest?.overallScore ?? null,
        findingCount: findings.length,
        lastAnalyzedAt: latest?.createdAt ?? null,
        latestAnalysisId: latest?.id ?? null,
        analysisCountOnCurrent: current?.analyses.length ?? 0,
      };
    });
  },

  async seedStarterPolicies(seeds: StarterPolicySeed[]) {
    const existing = await prisma.policy.findMany({ where: { userId: null }, select: { code: true } });
    const codes = new Set(existing.map((row) => row.code));
    for (const seed of seeds) {
      if (codes.has(seed.code)) continue;
      await prisma.policy.create({
        data: {
          userId: null,
          code: seed.code,
          principle: seed.principle,
          name: seed.name,
          versions: {
            create: {
              versionNumber: 1,
              statement: seed.statement,
              checkableIntent: seed.checkableIntent,
              components: seed.components,
              frameworks: seed.frameworks,
              severity: seed.severity,
              source: "starter",
              checker: seed.code,
              createdBy: null,
              note: "Starter pack",
            },
          },
        },
      });
    }
  },

  async listStarterPolicies() {
    const rows = await prisma.policy.findMany({
      where: { userId: null, deletedAt: null },
      include: policyWithCurrent,
      orderBy: { code: "asc" },
    });
    return rows.flatMap((row) => (row.versions[0] ? [mapPolicy(row, row.versions[0])] : []));
  },

  async listUserPolicies(userId) {
    const rows = await prisma.policy.findMany({
      where: { userId, deletedAt: null },
      include: policyWithCurrent,
      orderBy: { createdAt: "asc" },
    });
    return rows.flatMap((row) => (row.versions[0] ? [mapPolicy(row, row.versions[0])] : []));
  },

  async getUserPolicy(userId, id, options) {
    const row = await prisma.policy.findFirst({
      where: {
        id,
        userId,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
      include: policyWithCurrent,
    });
    if (!row?.versions[0]) return null;
    return mapPolicy(row, row.versions[0]);
  },

  async getPolicyVersionHistory(userId, policyId) {
    const policy = await prisma.policy.findFirst({ where: { id: policyId, userId } });
    if (!policy) return [];
    const versions = await prisma.policyVersion.findMany({
      where: { policyId },
      orderBy: { versionNumber: "asc" },
    });
    return versions.map((version) => mapPolicyVersion(policy, version));
  },

  async createPolicy(input: CreatePolicyInput) {
    const row = await prisma.policy.create({
      data: {
        user: { connect: { id: input.userId } },
        code: input.code,
        principle: input.principle,
        name: input.name.trim(),
        adoptedFromId: input.adoptedFromId ?? null,
        status: input.status,
        versions: {
          create: {
            versionNumber: 1,
            statement: input.statement.trim(),
            checkableIntent: input.checkableIntent.trim(),
            components: input.components,
            frameworks: input.frameworks,
            severity: input.severity,
            source: input.source,
            checker: input.checker,
            createdBy: input.createdBy,
            note: input.note?.trim() ?? "",
            confidence: input.confidence ?? "",
            generationNote: input.generationNote?.trim() ?? "",
          },
        },
      },
      include: policyWithCurrent,
    });
    return mapPolicy(row, row.versions[0]);
  },

  async addPolicyVersion(userId, policyId, input: AddPolicyVersionInput) {
    const policy = await prisma.policy.findFirst({ where: { id: policyId, userId, deletedAt: null } });
    if (!policy) return null;
    return prisma.$transaction(async (tx) => {
      const last = await tx.policyVersion.findFirst({
        where: { policyId },
        orderBy: { versionNumber: "desc" },
      });
      if (!last) return null;
      if (input.name && input.name.trim() !== policy.name) {
        await tx.policy.update({ where: { id: policyId }, data: { name: input.name.trim() } });
      }
      const version = await tx.policyVersion.create({
        data: {
          policyId,
          versionNumber: last.versionNumber + 1,
          statement: input.statement.trim(),
          checkableIntent: input.checkableIntent.trim(),
          components: (input.components ?? asComponents(last.components)) as Prisma.InputJsonValue,
          frameworks: (input.frameworks ?? asStringList(last.frameworks)) as Prisma.InputJsonValue,
          severity: input.severity,
          source: input.source,
          checker: input.checker,
          createdBy: input.createdBy,
          note: input.note?.trim() ?? "",
          confidence: input.confidence ?? "",
          generationNote: input.generationNote?.trim() ?? "",
        },
      });
      const updated = await tx.policy.findUniqueOrThrow({ where: { id: policyId } });
      return mapPolicy(updated, version);
    });
  },

  async setPolicyStatus(userId, policyId, status) {
    const policy = await prisma.policy.findFirst({
      where: { id: policyId, userId, deletedAt: null },
      include: policyWithCurrent,
    });
    if (!policy?.versions[0]) return null;
    const updated = await prisma.policy.update({
      where: { id: policyId },
      data: { status },
      include: policyWithCurrent,
    });
    if (!updated.versions[0]) return null;
    return mapPolicy(updated, updated.versions[0]);
  },

  async softDeletePolicy(userId, policyId) {
    const policy = await prisma.policy.findFirst({ where: { id: policyId, userId, deletedAt: null } });
    if (!policy) return false;
    await prisma.policy.update({ where: { id: policyId }, data: { deletedAt: new Date() } });
    return true;
  },

  async createComplianceReport(input: CreateComplianceReportInput) {
    const row = await prisma.complianceReport.create({
      data: {
        harnessVersionId: input.harnessVersionId,
        policyPackVersion: input.policyPackVersion,
        results: input.results as unknown as Prisma.InputJsonValue,
        summary: input.summary as unknown as Prisma.InputJsonValue,
        overallStatus: input.overallStatus,
        delta: input.delta == null ? Prisma.JsonNull : (input.delta as unknown as Prisma.InputJsonValue),
      },
    });
    return mapCompliance(row);
  },

  async listComplianceReports(harnessVersionId) {
    const rows = await prisma.complianceReport.findMany({
      where: { harnessVersionId },
      orderBy: { generatedAt: "asc" },
    });
    return rows.map(mapCompliance);
  },

  async getLatestComplianceReport(harnessVersionId) {
    const row = await prisma.complianceReport.findFirst({
      where: { harnessVersionId },
      orderBy: { generatedAt: "desc" },
    });
    return row ? mapCompliance(row) : null;
  },

  async listHarnessCompliance(harnessId): Promise<HarnessComplianceEntry[]> {
    const rows = await prisma.complianceReport.findMany({
      where: { harnessVersion: { harnessId } },
      include: { harnessVersion: { select: { versionNumber: true } } },
      orderBy: { generatedAt: "asc" },
    });
    return rows.map((row) => ({
      report: mapCompliance(row),
      versionNumber: row.harnessVersion.versionNumber,
    }));
  },

  async createHarnessSnapshot(input: CreateHarnessSnapshotInput) {
    const row = await prisma.harnessSnapshot.create({
      data: {
        snapshotId: input.snapshotId,
        agentId: input.agentId,
        sessionId: input.sessionId ?? null,
        capturedAt: input.capturedAt,
        source: input.source,
        instructions: input.instructions as unknown as Prisma.InputJsonValue,
        tools: input.tools as unknown as Prisma.InputJsonValue,
        knowledge: input.knowledge as unknown as Prisma.InputJsonValue,
        memory: input.memory as unknown as Prisma.InputJsonValue,
        guardrails: input.guardrails as unknown as Prisma.InputJsonValue,
        delegation: input.delegation as unknown as Prisma.InputJsonValue,
      },
    });
    return mapHarnessSnapshot(row);
  },

  async listHarnessSnapshots(agentId, options) {
    const rows = await prisma.harnessSnapshot.findMany({
      where: { agentId },
      orderBy: { capturedAt: "desc" },
      take: options?.limit ?? 50,
    });
    return rows.map(mapHarnessSnapshot);
  },

  async getHarnessSnapshot(snapshotId) {
    const row = await prisma.harnessSnapshot.findUnique({ where: { snapshotId } });
    return row ? mapHarnessSnapshot(row) : null;
  },
};
