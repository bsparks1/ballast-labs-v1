import { scoreBand, type ScoreBand } from "@/lib/format";

const BAND_STROKE: Record<string, string> = {
  clean: "var(--healthy)",
  minor: "var(--info)",
  functional: "var(--warning)",
  gaps: "var(--warning)",
  serious: "var(--critical)",
};

export function ScoreRing({
  score,
  size = 148,
  band,
}: {
  score: number;
  size?: number;
  band?: ScoreBand;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const color = BAND_STROKE[band ?? scoreBand(score)];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--faint)"
          strokeOpacity={0.35}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="stat-num text-4xl" style={{ color }}>
          {score}
        </span>
        <span className="eyebrow mt-1">/ 100</span>
      </div>
    </div>
  );
}
