import { prismaStore } from "./prisma-store";
import type { DataStore } from "./store";

/** Active data-access layer. Swap this binding to change storage engines. */
export const store: DataStore = prismaStore;

export type { DataStore } from "./store";
export type {
  AddPolicyVersionInput,
  AnalysisMeta,
  AnalysisRecord,
  ComplianceReportRecord,
  CreateComplianceReportInput,
  CreatePolicyInput,
  HarnessComplianceEntry,
  HarnessRecord,
  HarnessSummary,
  HarnessVersionRecord,
  PolicyRecord,
  PolicyVersionRecord,
  PublicUser,
  StarterPolicySeed,
  UserRecord,
} from "./types";
