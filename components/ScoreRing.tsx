import { scoreBand } from "@/lib/format";

const BAND_STROKE: Record<string, string> = {
  healthy: "var(--healthy)",
  degraded: "var(--warning)",
  "at-risk": "var(--critical)",
};

export function ScoreRing({ score, size = 148 }: { score: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const color = BAND_STROKE[scoreBand(score)];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
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
        <span className="text-4xl font-semibold tabular-nums tracking-tight" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-faint">/ 100</span>
      </div>
    </div>
  );
}
