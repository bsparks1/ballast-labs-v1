import { ANALYSIS_STEPS } from "@/lib/analysis/steps";

export function AnalyzingPanel({
  step,
  title = "Analyzing harness",
  steps = ANALYSIS_STEPS,
}: {
  step: number;
  title?: string;
  steps?: string[];
}) {
  return (
    <div className="mt-6 rounded-md border border-edge bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
          {title}
        </p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2 text-xs transition-colors duration-300 ${
              i < step ? "text-healthy" : i === step ? "text-foreground" : "text-faint"
            }`}
          >
            <span className="w-4 font-mono">{i < step ? "✓" : i === step ? "▸" : "·"}</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
