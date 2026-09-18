import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, decodeSession, encodeSession } from "./token";

export { SESSION_COOKIE, decodeSession, encodeSession };

export async function setSessionCookie(userId: string, email: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession({ userId, email }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSession() {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}
