"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function AuthNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return (
      <Link href="/login" className="text-xs text-muted hover:text-foreground">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/harnesses" className="text-xs text-muted hover:text-foreground">
        My Harnesses
      </Link>
      <span className="hidden font-mono text-[10px] text-faint sm:inline">{user.email}</span>
      <button
        type="button"
        className="text-xs text-muted hover:text-foreground"
        onClick={async () => {
          await logout();
          router.push("/");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
