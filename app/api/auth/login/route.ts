import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
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
  if (!email || !password) return jsonError("Email and password are required", 400);

  const user = await store.getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError("Invalid email or password", 401);
  }
  await setSessionCookie(user.id, user.email);
  return NextResponse.json({ id: user.id, email: user.email });
}
