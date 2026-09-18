import { FindingCard } from "@/components/FindingCard";
import { ReportLinksProvider } from "@/components/report/ReportLinks";
import type { VersionDiff } from "@/lib/harness/diff";

export function WhatsNewBanner({
  harnessId,
  whatsNew,
  previousScore,
  currentScore,
}: {
  harnessId: string;
  whatsNew: VersionDiff["findings"];
  previousScore: number | null;
  currentScore: number;
}) {
  if (whatsNew.new.length === 0 && whatsNew.resolved.length === 0) return null;
  return (
    <ReportLinksProvider base={{ kind: "harness", harnessId }}>
      <section className="rounded-md border border-warning/40 bg-warning-dim/40 p-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-warning">
          What’s new since last analysis
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          {whatsNew.new.length > 0
            ? `Re-analysis of this stored version${
                previousScore !== null ? ` moved the score ${previousScore} → ${currentScore}` : ""
              } and surfaced ${whatsNew.new.length} new finding${whatsNew.new.length === 1 ? "" : "s"}${
                whatsNew.resolved.length > 0
                  ? ` while ${whatsNew.resolved.length} no longer appear`
                  : ""
              }.`
            : `Re-analysis of this stored version${
                previousScore !== null ? ` moved the score ${previousScore} → ${currentScore}` : ""
              }${
                whatsNew.resolved.length > 0
                  ? ` and ${whatsNew.resolved.length} finding${whatsNew.resolved.length === 1 ? "" : "s"} no longer appear`
                  : " found no new issues"
              }.`}
        </p>
        {whatsNew.new.length > 0 && (
          <div className="mt-4 space-y-3">
            {whatsNew.new.map((item) => (
              <FindingCard key={item.finding.id} finding={item.finding} showComponent />
            ))}
          </div>
        )}
      </section>
    </ReportLinksProvider>
  );
}
