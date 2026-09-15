import Link from "next/link";

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-edge bg-surface/60">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent font-mono text-[11px] font-bold text-white">
            B
          </span>
          <span className="text-sm font-semibold tracking-tight">Ballast</span>
          <span className="mt-px hidden font-mono text-[10px] uppercase tracking-widest text-faint sm:inline">
            harness audit
          </span>
        </Link>
        {right}
      </div>
    </header>
  );
}
