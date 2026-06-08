import type { Quote } from "@/lib/types";
import type { BreadthRead, TechnicalRead, VolatilityRead, VolatilityRegime, BreadthClass, Bias } from "../core/types";
import type { MacroRead } from "./macroFeatures";
import type { NewsImpactReport } from "../core/types";

export interface RegimeSignals {
  primaryChangePct: number | null;
  trend: TechnicalRead["trend"];
  inControl: TechnicalRead["inControl"];
  vixLevel: number | null;
  vixChangePct: number | null;
  yieldsChangePct: number | null;
  newsBias: Bias;
  newsTopImpact: number;
  relVol: number | null;
  intradayRangePct: number | null;
  breadthClass: BreadthClass;
  breadthNarrow: boolean;
  eventImminent: boolean;
  eventJustPassed: boolean;
  volRegime: VolatilityRegime;
}

export interface RegimeExtractInput {
  quotes: Record<string, Quote | null>;
  primaryChangePct: number | null;
  technical: TechnicalRead;
  breadth: BreadthRead;
  volatility: VolatilityRead;
  macro: MacroRead;
  news: NewsImpactReport;
  relVol: number | null;
}

export function extractRegimeSignals(i: RegimeExtractInput): RegimeSignals {
  const er = i.macro.eventRisk;
  const mins = er.minutesUntilNext;
  const eventImminent = er.level === "Extreme" || (mins !== null && mins >= 0 && mins <= 30 && er.nextEvent?.importance === "high");
  const eventJustPassed = mins !== null && mins < 0 && mins > -15 && er.nextEvent?.importance === "high";

  return {
    primaryChangePct: i.primaryChangePct,
    trend: i.technical.trend,
    inControl: i.technical.inControl,
    vixLevel: i.volatility.vixLevel,
    vixChangePct: i.volatility.vixChangePct,
    yieldsChangePct: i.quotes.TNX?.changePct ?? null,
    newsBias: i.news.netSentiment,
    newsTopImpact: i.news.items[0]?.impactScore ?? 0,
    relVol: i.relVol,
    intradayRangePct: i.volatility.intradayRangePct,
    breadthClass: i.breadth.classification,
    breadthNarrow: i.breadth.narrow,
    eventImminent: Boolean(eventImminent),
    eventJustPassed: Boolean(eventJustPassed),
    volRegime: i.volatility.regime,
  };
}
