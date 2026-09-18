import { NextResponse } from "next/server";
import { getCurrentUser } from "./current-user";
import type { PublicUser } from "@/lib/db";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function requireApiUser(): Promise<{ user: PublicUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("Sign in required", 401) };
  return { user };
}
