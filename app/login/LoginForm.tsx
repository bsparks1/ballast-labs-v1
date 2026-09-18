"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PublicUser } from "@/lib/db/types";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/harnesses";
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(path: string, body?: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? { email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setUser(data as PublicUser);
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="mt-6 space-y-3 rounded-md border border-edge bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("/api/auth/login");
        }}
      >
        <label className="block font-mono text-[11px] uppercase tracking-widest text-faint" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <label className="block font-mono text-[11px] uppercase tracking-widest text-faint" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-sm border border-edge bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        {error && (
          <p className="rounded-sm border border-critical/30 bg-critical-dim px-3 py-2 text-xs text-critical">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit("/api/auth/demo")}
        className="mt-3 w-full rounded-sm border border-edge px-4 py-2.5 text-sm text-muted hover:border-edge-strong hover:text-foreground disabled:opacity-40"
      >
        Continue as demo user
      </button>

      <p className="mt-4 text-center text-xs text-muted">
        No account?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent hover:text-foreground">
          Create one
        </Link>
      </p>
    </>
  );
}
