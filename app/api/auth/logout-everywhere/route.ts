import { NextResponse } from "next/server";
import { jsonError } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { clearSessionCookie } from "@/lib/auth/session";
import { store } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required", 401);
  await store.incrementSessionVersion(user.id);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
