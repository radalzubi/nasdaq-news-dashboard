import { atr } from "@/lib/scoring/technicals";
import type { Bar, Quote } from "@/lib/types";
import { VIX, ATR_PCT } from "../core/config";
import { clamp, round } from "../core/scoring";
import type { VolatilityRead, VolatilityRegime } from "../core/types";

export interface VolatilityInput {
  quotes: Record<string, Quote | null>;
  daily: Bar[];
  quote: Quote | null;
}

export function buildVolatilityRead(input: VolatilityInput): VolatilityRead {
  const vixQ = input.quotes.VIX;
  const vixLevel = vixQ?.price ?? null;
  const vixChangePct = vixQ?.changePct ?? null;

  const last = input.quote?.price ?? input.daily.at(-1)?.c ?? null;
  const atrVal = atr(input.daily, 14);
  const atrPct = atrVal !== null && last ? round((atrVal / last) * 100, 2) : null;
  const prevClose = input.quote?.prevClose ?? null;
  const intradayRangePct =
    input.quote?.dayHigh != null && input.quote?.dayLow != null && prevClose
      ? round(((input.quote.dayHigh - input.quote.dayLow) / prevClose) * 100, 2)
      : null;

  // Regime: prefer VIX; fall back to ATR%/range.
  let regime: VolatilityRegime;
  if (vixLevel !== null) {
    regime = vixLevel < VIX.calm ? "Calm" : vixLevel < VIX.elevated ? "Normal" : vixLevel < VIX.extreme ? "Elevated" : "Extreme";
  } else if (atrPct !== null) {
    regime = atrPct < 1 ? "Calm" : atrPct < ATR_PCT.elevated ? "Normal" : atrPct < ATR_PCT.extreme ? "Elevated" : "Extreme";
  } else {
    regime = "Normal";
  }

  let score = regime === "Calm" ? 85 : regime === "Normal" ? 70 : regime === "Elevated" ? 45 : 20;
  if (vixChangePct !== null && vixChangePct > 6) score -= 10;
  else if (vixChangePct !== null && vixChangePct < -5) score += 6;
  score = clamp(score);

  const degraded = vixLevel === null && atrPct === null;
  return {
    regime,
    score,
    vixLevel,
    vixChangePct,
    atrPct,
    intradayRangePct,
    plain: buildPlain(regime, vixChangePct),
    degraded,
  };
}

function buildPlain(regime: VolatilityRegime, vixChange: number | null): string {
  if (regime === "Extreme") return "Volatility is extreme — price can move sharply in both directions, so signals are less reliable.";
  if (regime === "Elevated") return "Volatility is elevated, so price may move quickly. Use a little more caution than usual.";
  if (regime === "Calm") return "The market is calm, with no major volatility warning.";
  const rising = vixChange !== null && vixChange > 3 ? " though the fear gauge is creeping up" : "";
  return `Volatility looks normal${rising}.`;
}
