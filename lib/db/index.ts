import { prismaStore } from "./prisma-store";
import type { DataStore } from "./store";

/** Active data-access layer. Swap this binding to change storage engines. */
export const store: DataStore = prismaStore;

export type { DataStore } from "./store";
export type {
  AnalysisMeta,
  AnalysisRecord,
  HarnessRecord,
  HarnessSummary,
  HarnessVersionRecord,
  PublicUser,
  UserRecord,
} from "./types";
