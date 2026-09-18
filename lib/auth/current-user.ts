import "server-only";
import { redirect } from "next/navigation";
import { store } from "@/lib/db";
import type { PublicUser } from "@/lib/db";
import { readSession } from "./session";

export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const session = await readSession();
    if (!session) return null;
    const user = await store.getUserById(session.userId);
    if (!user) return null;
    return { id: user.id, email: user.email };
  } catch (err) {
    console.error("[ballast:auth] getCurrentUser failed", err);
    return null;
  }
}

export async function requireUser(nextPath = "/harnesses"): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}
