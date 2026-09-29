"use client";

import Link from "next/link";
import { AuthNav } from "@/components/auth/AuthNav";
import { BallastLogo } from "@/components/brand/BallastLogo";

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-edge bg-surface/80 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="no-underline hover:opacity-80" aria-label="Ballast Labs home">
          <BallastLogo />
        </Link>
        <div className="flex items-center gap-5">
          {right}
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
