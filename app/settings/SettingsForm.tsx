"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

const CONFIRM_MS = 5000;

export function SettingsForm() {
  const router = useRouter();
  const { setUser } = useAuth();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming || busy) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || buttonRef.current?.contains(target)) return;
      setConfirming(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [confirming, busy]);

  async function logoutEverywhere() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/logout-everywhere", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section className="mt-6 panel p-5">
      <h2 className="eyebrow">Sessions</h2>
      <p className="mt-2 text-sm text-muted">
        Ends every signed-in session for this account, including this browser.
      </p>
      {error && (
        <p className="mt-3 rounded-sm border border-critical/30 bg-critical-dim px-3 py-2 text-xs text-critical">{error}</p>
      )}
      <button
        ref={buttonRef}
        type="button"
        disabled={busy}
        onClick={() => {
          if (busy) return;
          if (!confirming) {
            setError(null);
            setConfirming(true);
            return;
          }
          void logoutEverywhere();
        }}
        className={`mt-4 w-full rounded-sm px-4 py-2.5 text-center text-sm font-medium leading-snug disabled:opacity-40 ${
          confirming
            ? "border border-warning/40 bg-warning-dim text-warning hover:bg-warning/15"
            : "border border-edge text-muted hover:border-edge-strong hover:text-foreground"
        }`}
      >
        {busy ? "Signing out…" : confirming ? "Click again to confirm — this logs you out here too" : "Log out of all devices"}
      </button>
    </section>
  );
}
