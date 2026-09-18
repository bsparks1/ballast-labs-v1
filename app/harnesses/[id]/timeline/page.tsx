import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { loadTimeline } from "@/lib/harness/service";
import { TimelineView } from "@/components/harness/TimelineView";

export default async function TimelinePage({ params }: PageProps<"/harnesses/[id]/timeline">) {
  const { id } = await params;
  const user = await requireUser(`/harnesses/${id}/timeline`);
  const data = await loadTimeline(user.id, id);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
            Change log
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every saved version, the score it produced, and what the change did to findings. Export this as
            the artifact a compliance buyer hands a regulator.
          </p>
        </div>
        <Link
          href={`/api/harnesses/${id}/export`}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          Export history
        </Link>
      </div>
      <TimelineView harnessId={id} points={data.points} />
    </div>
  );
}
