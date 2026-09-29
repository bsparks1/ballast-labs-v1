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
    <div className="mt-6 panel p-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="marker animate-pulse" />
        <p className="eyebrow">{title}</p>
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2.5 text-xs transition-colors duration-300 ${
              i < step ? "text-healthy" : i === step ? "text-foreground" : "text-faint"
            }`}
          >
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 shrink-0 ${
                i < step ? "bg-healthy" : i === step ? "bg-foreground" : "bg-faint"
              }`}
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
