/**
 * Data-access contract. Prisma is the current engine; swap the implementation
 * in prisma-store.ts without touching routes or UI.
 */

import type {
  AddPolicyVersionInput,
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

export interface DataStore {
  createUser(email: string, passwordHash: string): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  incrementSessionVersion(userId: string): Promise<void>;

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

  seedStarterPolicies(seeds: StarterPolicySeed[]): Promise<void>;
  listStarterPolicies(): Promise<PolicyRecord[]>;
  listUserPolicies(userId: string): Promise<PolicyRecord[]>;
  getUserPolicy(userId: string, id: string, options?: { includeDeleted?: boolean }): Promise<PolicyRecord | null>;
  getPolicyVersionHistory(userId: string, policyId: string): Promise<PolicyVersionRecord[]>;
  createPolicy(input: CreatePolicyInput): Promise<PolicyRecord>;
  addPolicyVersion(userId: string, policyId: string, input: AddPolicyVersionInput): Promise<PolicyRecord | null>;
  setPolicyStatus(userId: string, policyId: string, status: PolicyRecord["status"]): Promise<PolicyRecord | null>;
  softDeletePolicy(userId: string, policyId: string): Promise<boolean>;

  createComplianceReport(input: CreateComplianceReportInput): Promise<ComplianceReportRecord>;
  listComplianceReports(harnessVersionId: string): Promise<ComplianceReportRecord[]>;
  getLatestComplianceReport(harnessVersionId: string): Promise<ComplianceReportRecord | null>;
  listHarnessCompliance(harnessId: string): Promise<HarnessComplianceEntry[]>;

  createHarnessSnapshot(input: CreateHarnessSnapshotInput): Promise<HarnessSnapshotRecord>;
  listHarnessSnapshots(agentId: string, options?: { limit?: number }): Promise<HarnessSnapshotRecord[]>;
  getHarnessSnapshot(snapshotId: string): Promise<HarnessSnapshotRecord | null>;
}
