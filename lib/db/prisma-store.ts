import "server-only";
import type { Prisma } from "@prisma/client";
import type { ComponentReport, Finding, PassStatus } from "@/lib/types";
import { prisma } from "./prisma";
import type { DataStore } from "./store";
import type {
  AnalysisMeta,
  AnalysisRecord,
  CreateAnalysisInput,
  CreateHarnessInput,
  CreateVersionInput,
  HarnessRecord,
  HarnessSummary,
  HarnessVersionRecord,
  UserRecord,
} from "./types";

function mapUser(row: {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
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
};
