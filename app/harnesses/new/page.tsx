import { Header } from "@/components/Header";
import { HarnessEditor } from "@/components/harness/HarnessEditor";
import { requireUser } from "@/lib/auth/current-user";

export default async function NewHarnessPage() {
  await requireUser("/harnesses/new");
  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-3xl flex-1 p-4 py-8 sm:p-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
          New harness
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Save a named harness</h1>
        <p className="mt-2 text-sm text-muted">
          Name it, paste a prompt or extract from a GitHub repo, and Ballast stores Version 1 with a full analysis.
          Later edits — including re-ingesting the repo — become new versions.
        </p>
        <div className="mt-6">
          <HarnessEditor mode="create" />
        </div>
      </div>
    </>
  );
}
