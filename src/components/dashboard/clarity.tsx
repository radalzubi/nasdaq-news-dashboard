import type { ClarityComponent, MarketClarityScore } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, TriangleAlert } from "lucide-react";

export function scoreColor(score: number): { stroke: string; text: string } {
  if (score <= 40) return { stroke: "hsl(var(--bear))", text: "text-bear" };
  if (score <= 60) return { stroke: "hsl(var(--caution))", text: "text-caution" };
  if (score <= 75) return { stroke: "hsl(var(--info))", text: "text-info" };
  return { stroke: "hsl(var(--bull))", text: "text-bull" };
}

/** Plain-English confidence label (no jargon). */
export function plainConfidence(score: number): string {
  if (score <= 20) return "Very murky";
  if (score <= 40) return "Murky";
  if (score <= 60) return "Mixed";
  if (score <= 75) return "Fairly clear";
  if (score <= 90) return "Clear";
  return "Very clear";
}

/** Semicircular gauge for the 0–100 clarity score. */
export function ClarityMeter({ clarity, size = 200 }: { clarity: MarketClarityScore; size?: number }) {
  const r = 82;
  const cx = 100;
  const cy = 100;
  const circ = Math.PI * r;
  const color = scoreColor(clarity.score);
  const offset = circ * (1 - clarity.score / 100);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" width={size} height={(size * 112) / 200} className="overflow-visible">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--border-strong))"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color.stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
        <text x={cx} y={cy - 14} textAnchor="middle" className={cn("fill-current text-3xl font-bold tabular", color.text)}>
          {clarity.score}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-current text-[10px] uppercase tracking-wider text-faint">
          / 100
        </text>
      </svg>
      <div className="-mt-1 text-center">
        <p className={cn("text-sm font-semibold", color.text)}>{plainConfidence(clarity.score)}</p>
        <p className="text-2xs text-faint">Confidence · how clear today&apos;s picture is</p>
      </div>
    </div>
  );
}

function compColor(score: number) {
  if (score <= 40) return "bg-bear";
  if (score <= 60) return "bg-caution";
  if (score <= 75) return "bg-info";
  return "bg-bull";
}

export function ClarityComponents({ components }: { components: ClarityComponent[] }) {
  return (
    <div className="space-y-2.5">
      {components.map((c) => (
        <div key={c.key}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg">
              {c.label} <span className="text-faint">· {Math.round(c.weight * 100)}%</span>
            </span>
            <span className="tabular text-muted">{c.score}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
            <div className={cn("h-full rounded-full", compColor(c.score))} style={{ width: `${c.score}%` }} />
          </div>
          <p className="mt-1 text-2xs text-faint">{c.note}</p>
        </div>
      ))}
    </div>
  );
}

export function FactorList({ kind, items }: { kind: "support" | "risk"; items: string[] }) {
  const isSupport = kind === "support";
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-xs text-muted">
          {isSupport ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bull" />
          ) : (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caution" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
