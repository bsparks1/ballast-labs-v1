/**
 * Storage-agnostic records. All database access returns these types so the
 * engine (Prisma/SQLite today, Postgres later) can be swapped behind lib/db.
 */

import type { ComponentReport, Finding, HarnessReport, PassStatus } from "@/lib/types";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
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
