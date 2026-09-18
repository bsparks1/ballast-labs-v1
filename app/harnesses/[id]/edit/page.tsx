import { requireUser } from "@/lib/auth/current-user";
import { loadHarnessView } from "@/lib/harness/service";
import { notFound } from "next/navigation";
import { HarnessEditor } from "@/components/harness/HarnessEditor";

export default async function EditHarnessPage({ params }: PageProps<"/harnesses/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/harnesses/${id}/edit`);
  const data = await loadHarnessView(user.id, id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-1 text-sm text-muted">
        Saving creates Version {data.version.versionNumber + 1}. Prior versions stay immutable.
      </p>
      <HarnessEditor
        mode="update"
        harnessId={id}
        initialName={data.harness.name}
        initialDescription={data.harness.description}
        initialPrompt={data.version.rawPrompt}
        initialConfig={data.version.rawConfig}
      />
    </div>
  );
}
