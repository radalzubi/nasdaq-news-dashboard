import { Expandable, InfoHint } from "@/components/ui/explain";
import type { Stance, TechnicalSummary } from "@/lib/types";
import { cn, fmtPrice } from "@/lib/utils";

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated px-2.5 py-2">
      <p className="text-2xs uppercase tracking-wide text-faint">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold", tone)}>{value}</p>
    </div>
  );
}

const trendTone = (t: string) => (t === "Positive" ? "text-bull" : t === "Negative" ? "text-bear" : "text-caution");
const momentumTone = (t: string) => (t === "Strong" ? "text-bull" : t === "Weak" ? "text-bear" : "text-muted");
const volumeTone = (t: string) => (t === "Heavy" ? "text-info" : t === "Light" ? "text-caution" : "text-muted");
const chopTone = (t: string) => (t === "Low" ? "text-bull" : t === "High" ? "text-bear" : "text-caution");
const stanceDot = (s: Stance) => (s === "bullish" ? "bg-bull" : s === "bearish" ? "bg-bear" : "bg-faint");

export function TechnicalRead({ tech, showIndicators = false }: { tech: TechnicalSummary; showIndicators?: boolean }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Trend" value={tech.trend} tone={trendTone(tech.trend)} />
        <Stat label="Momentum" value={tech.momentum} tone={momentumTone(tech.momentum)} />
        <Stat label="Volume" value={tech.volume} tone={volumeTone(tech.volume)} />
        <Stat label="Chop risk" value={tech.chopRisk} tone={chopTone(tech.chopRisk)} />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-bg-elevated px-2.5 py-2 text-xs">
        <span className="flex items-center gap-1 text-faint">
          Key level to watch
          <InfoHint align="left">The nearby price level the read is anchored to — often VWAP or the prior close.</InfoHint>
        </span>
        <span className="tabular font-semibold text-fg">
          {tech.keyLevel !== null ? fmtPrice(tech.keyLevel, true) : "—"}
          {tech.keyLevelLabel ? <span className="ml-1 font-normal text-faint">{tech.keyLevelLabel}</span> : null}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">{tech.explanation}</p>

      {showIndicators ? (
        <div className="mt-3">
          <IndicatorList tech={tech} />
        </div>
      ) : (
        <Expandable label="Indicator detail" className="mt-3">
          <IndicatorList tech={tech} />
        </Expandable>
      )}
    </div>
  );
}

function IndicatorList({ tech }: { tech: TechnicalSummary }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {tech.indicators.map((ind) => (
        <li key={ind.key} className={cn("px-3 py-2.5", ind.mattersNow && "bg-caution-soft/30")}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-medium text-fg">
              <span className={cn("h-2 w-2 rounded-full", stanceDot(ind.stance))} />
              {ind.label}
              {ind.mattersNow ? <span className="rounded bg-caution-soft px-1 text-2xs text-caution">watch</span> : null}
            </span>
            <span className="tabular text-xs text-muted">{ind.value}</span>
          </div>
          <p className="mt-1 pl-4 text-2xs leading-relaxed text-faint">{ind.plain}</p>
        </li>
      ))}
    </ul>
  );
}
