import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { HarnessNav } from "@/components/harness/HarnessNav";
import { requireUser } from "@/lib/auth/current-user";
import { store } from "@/lib/db";

export default async function HarnessLayout({
  children,
  params,
}: LayoutProps<"/harnesses/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/harnesses/${id}`);
  const harness = await store.getHarness(user.id, id);
  if (!harness) notFound();

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="mb-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">Saved harness</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{harness.name}</h1>
          {harness.description ? <p className="mt-1 text-sm text-muted">{harness.description}</p> : null}
        </div>
        <HarnessNav harnessId={id} />
        <div className="mt-6">{children}</div>
      </div>
    </>
  );
}
