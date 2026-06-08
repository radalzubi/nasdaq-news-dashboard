import { atr, ema, rsi, sma, vwap } from "@/lib/scoring/technicals";
import type { Bar, Quote } from "@/lib/types";
import { fmtPrice } from "@/lib/utils";
import { ATR_PCT, REL_VOLUME, RSI } from "../core/config";
import { clamp, round } from "../core/scoring";
import type { KeyLevel, TechnicalRead } from "../core/types";

export interface TechInput {
  symbol: string;
  label: string;
  intraday: Bar[];
  daily: Bar[];
  quote: Quote | null;
  premarket?: { high: number; low: number } | null;
}

function level(label: string, value: number, kind: KeyLevel["kind"], last: number | null, plain: string): KeyLevel {
  return { label, value: round(value, 2), kind, distancePct: last ? round(((last - value) / value) * 100, 2) : null, plain };
}

/** Translate the tape into scores (0–100) + plain English. No raw jargon leaks. */
export function buildTechnicalRead(input: TechInput): TechnicalRead {
  const { label, intraday, daily, quote } = input;
  const intradayCloses = intraday.map((b) => b.c);
  const dailyCloses = daily.map((b) => b.c);

  const last = quote?.price ?? intradayCloses.at(-1) ?? dailyCloses.at(-1) ?? null;
  const prevClose = quote?.prevClose ?? (daily.length >= 2 ? daily[daily.length - 2].c : null);
  const vw = vwap(intraday);
  const ema9 = ema(intradayCloses, 9);
  const ema21 = ema(intradayCloses, 21);
  const sma50 = sma(dailyCloses, 50);
  const sma200 = sma(dailyCloses, 200);
  const rsiVal = rsi(dailyCloses.length >= 15 ? dailyCloses : intradayCloses, 14);
  const atrVal = atr(daily, 14);

  const degraded = intraday.length < 6 && daily.length < 30;

  // ---- Trend (0–100): blend of position vs VWAP, short EMAs, long SMAs ------
  let trendPts = 50;
  if (vw !== null && last !== null) trendPts += last > vw ? 14 : last < vw ? -14 : 0;
  if (ema9 !== null && ema21 !== null && last !== null) {
    if (last > ema9 && last > ema21) trendPts += 12;
    else if (last < ema9 && last < ema21) trendPts -= 12;
  }
  if (sma50 !== null && last !== null) trendPts += last > sma50 ? 8 : -8;
  if (sma200 !== null && last !== null) trendPts += last > sma200 ? 6 : -6;
  const trendScore = clamp(trendPts);

  // ---- Momentum (0–100) ----------------------------------------------------
  let momPts = 50;
  if (rsiVal !== null) momPts = rsiVal; // RSI already 0–100, centered ~50
  const momentumScore = clamp(momPts);

  // ---- Volume confirmation (0–100) ----------------------------------------
  let relVol: number | null = null;
  if (daily.length >= 10) {
    const avg = sma(daily.slice(0, -1).map((b) => b.v), Math.min(20, daily.length - 1));
    const todayVol = quote?.volume ?? daily[daily.length - 1].v;
    if (avg && todayVol) relVol = todayVol / avg;
  }
  const volumeConfirmationScore = relVol === null ? 50 : clamp(40 + (relVol - 1) * 60);
  const volume: TechnicalRead["volume"] = relVol === null ? "Normal" : relVol >= REL_VOLUME.heavy ? "Heavy" : relVol <= REL_VOLUME.light ? "Light" : "Normal";

  // ---- Key levels + key-level behavior score -------------------------------
  const keyLevels: KeyLevel[] = [];
  if (vw !== null) keyLevels.push(level("Average price today (VWAP)", vw, "vwap", last, last !== null && last > vw ? `${label} is trading above its average price for the day — buyers in control intraday.` : `${label} is below its average price for the day — sellers in control intraday.`));
  if (prevClose) keyLevels.push(level("Yesterday's close", prevClose, "prevClose", last, "Where the day started from."));
  if (intraday.length >= 3) {
    const orBars = intraday.slice(0, Math.min(6, intraday.length));
    const orHigh = Math.max(...orBars.map((b) => b.h));
    const orLow = Math.min(...orBars.map((b) => b.l));
    keyLevels.push(level("First 30-min high", orHigh, "openingRangeHigh", last, "A break above often signals early strength."));
    keyLevels.push(level("First 30-min low", orLow, "openingRangeLow", last, "A break below often signals early weakness."));
  }
  if (daily.length >= 10) {
    const recent = daily.slice(-20);
    keyLevels.push(level("Nearby support", Math.min(...recent.map((b) => b.l)), "support", last, "A floor buyers have recently defended."));
    keyLevels.push(level("Nearby resistance", Math.max(...recent.map((b) => b.h)), "resistance", last, "A ceiling sellers have recently defended."));
  }
  if (input.premarket) {
    keyLevels.push(level("Pre-market high", input.premarket.high, "premarketHigh", last, "Where buyers topped out before the open."));
    keyLevels.push(level("Pre-market low", input.premarket.low, "premarketLow", last, "Where sellers bottomed before the open."));
  }
  if (prevClose && quote?.open != null && Math.abs(quote.open - prevClose) / prevClose > 0.003) {
    keyLevels.push(level("Gap-fill level", prevClose, "gapFill", last, "The price the gap would close at if it filled."));
  }
  // Decisiveness: how far price sits from VWAP/prevClose (away = decisive).
  const refs = [vw, prevClose].filter((x): x is number => x != null);
  const avgDistPct = last && refs.length ? mean(refs.map((r) => Math.abs((last - r) / r) * 100)) : 0;
  const keyLevelScore = clamp(40 + Math.min(avgDistPct, 2) * 25);

  // ---- Chop risk (0–100, higher = choppier) --------------------------------
  const intradayRangePct = last && quote?.dayHigh != null && quote?.dayLow != null && prevClose ? ((quote.dayHigh - quote.dayLow) / prevClose) * 100 : null;
  const atrPct = atrVal !== null && last ? (atrVal / last) * 100 : null;
  let chopPts = 35;
  if (volume === "Light") chopPts += 25;
  if (avgDistPct < 0.25) chopPts += 20; // hugging VWAP/prevClose = indecisive
  if (rsiVal !== null && rsiVal > 45 && rsiVal < 55) chopPts += 10;
  if (atrPct !== null && atrPct > ATR_PCT.elevated) chopPts -= 10; // big range = trending, less chop
  const chopRiskScore = clamp(chopPts);

  // ---- Aggregate reads -----------------------------------------------------
  const inControl: TechnicalRead["inControl"] = vw !== null && last !== null ? (last > vw * 1.0005 ? "buyers" : last < vw * 0.9995 ? "sellers" : "neither") : "neither";
  const trend: TechnicalRead["trend"] = trendScore > 60 ? "Positive" : trendScore < 40 ? "Negative" : "Mixed";
  const momentum: TechnicalRead["momentum"] = momentumScore > 60 ? "Strong" : momentumScore < 40 ? "Weak" : "Neutral";

  const plain = buildPlain(label, inControl, volume, rsiVal, chopRiskScore, trend);

  return {
    trendScore,
    momentumScore,
    volumeConfirmationScore,
    keyLevelScore,
    chopRiskScore,
    trend,
    momentum,
    volume,
    inControl,
    plain,
    keyLevels,
    degraded,
  };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function buildPlain(
  label: string,
  inControl: TechnicalRead["inControl"],
  volume: TechnicalRead["volume"],
  rsiVal: number | null,
  chop: number,
  trend: TechnicalRead["trend"],
): string {
  const control =
    inControl === "buyers"
      ? `Buyers have control for now because ${label} is above its average price for the day`
      : inControl === "sellers"
      ? `Sellers are controlling the session — ${label} is below its average price for the day`
      : `${label} is stuck between important levels, so direction is unclear`;
  let tail = ".";
  if (rsiVal !== null && rsiVal > RSI.overbought) tail = `, and the move looks stretched, so chasing is riskier.`;
  else if (rsiVal !== null && rsiVal < RSI.oversold) tail = `, and it looks beaten down, though catching a falling move is risky.`;
  else if (volume === "Light") tail = `, but volume is light, so the move is less reliable.`;
  else if (chop > 65) tail = `, but the action is messy, so the signal isn't clean.`;
  else if (volume === "Heavy") tail = `, and busy trading gives the move more weight.`;
  else if (trend === "Mixed") tail = `, but the signal is mixed right now.`;
  return control + tail;
}
