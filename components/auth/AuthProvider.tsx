"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PublicUser } from "@/lib/db/types";

type AuthContextValue = {
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: PublicUser | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<PublicUser | null>(initialUser);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, logout }), [user, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      setUser: () => {},
      logout: async () => {},
    };
  }
  return ctx;
}
