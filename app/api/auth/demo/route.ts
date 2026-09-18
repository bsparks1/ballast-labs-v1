import { NextResponse } from "next/server";
import { ensureDemoUser } from "@/lib/auth/demo";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const user = await ensureDemoUser();
  await setSessionCookie(user.id, user.email);
  return NextResponse.json({ id: user.id, email: user.email });
}
