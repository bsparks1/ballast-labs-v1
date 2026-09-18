import "server-only";
import { store } from "@/lib/db";
import { hashPassword } from "./password";

export const DEMO_EMAIL = "demo@ballast.local";
export const DEMO_PASSWORD = "demo";

export async function ensureDemoUser() {
  const existing = await store.getUserByEmail(DEMO_EMAIL);
  if (existing) return existing;
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return store.createUser(DEMO_EMAIL, passwordHash);
}
