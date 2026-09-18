import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { jsonError } from "@/lib/auth/api";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.includes("@")) return jsonError("A valid email is required", 400);
  if (password.length < 6) return jsonError("Password must be at least 6 characters", 400);

  const existing = await store.getUserByEmail(email);
  if (existing) return jsonError("An account with that email already exists", 409);

  const user = await store.createUser(email, await hashPassword(password));
  await setSessionCookie(user.id, user.email);
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
