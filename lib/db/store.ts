/**
 * Data-access contract. Prisma is the current engine; swap the implementation
 * in prisma-store.ts without touching routes or UI.
 */

import type {
  AnalysisRecord,
  CreateAnalysisInput,
  CreateHarnessInput,
  CreateVersionInput,
  HarnessRecord,
  HarnessSummary,
  HarnessVersionRecord,
  UserRecord,
} from "./types";

export interface DataStore {
  createUser(email: string, passwordHash: string): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;

  createHarness(input: CreateHarnessInput): Promise<HarnessRecord>;
  getHarness(userId: string, id: string): Promise<HarnessRecord | null>;
  listHarnesses(userId: string): Promise<HarnessRecord[]>;
  updateHarness(
    userId: string,
    id: string,
    data: { name?: string; description?: string }
  ): Promise<HarnessRecord | null>;
  markHarnessViewed(userId: string, id: string): Promise<void>;

  createVersion(input: CreateVersionInput): Promise<HarnessVersionRecord>;
  getVersion(id: string): Promise<HarnessVersionRecord | null>;
  getVersionByNumber(harnessId: string, versionNumber: number): Promise<HarnessVersionRecord | null>;
  listVersions(harnessId: string): Promise<HarnessVersionRecord[]>;
  getLatestVersion(harnessId: string): Promise<HarnessVersionRecord | null>;

  createAnalysis(input: CreateAnalysisInput): Promise<AnalysisRecord>;
  getAnalysis(id: string): Promise<AnalysisRecord | null>;
  listAnalyses(harnessVersionId: string): Promise<AnalysisRecord[]>;
  getLatestAnalysis(harnessVersionId: string): Promise<AnalysisRecord | null>;

  listHarnessSummaries(userId: string): Promise<HarnessSummary[]>;
}
