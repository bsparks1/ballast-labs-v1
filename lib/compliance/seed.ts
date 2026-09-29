import "server-only";
import { store } from "@/lib/db";
import { STARTER_PACK } from "./pack";

export async function ensureStarterPolicies(): Promise<void> {
  await store.seedStarterPolicies(STARTER_PACK);
}
