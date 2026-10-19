import { rsi, sma } from "@/lib/scoring/technicals";
import type { Bar } from "@/lib/types";
import { BACKTEST_ASSUMPTIONS, BACKTEST_MIN_SAMPLE, RSI } from "../core/config";
import type { BacktestResult } from "../core/types";
import { validateNoLookAhead } from "./leakageChecks";
import { computeMetrics, type ForwardObservation } from "./performanceMetrics";

export type SignalType = "trend-up" | "trend-down" | "oversold" | "overbought";

const DIRECTION: Record<SignalType, 1 | -1> = { "trend-up": 1, "trend-down": -1, oversold: 1, overbought: -1 };

const LABELS: Record<SignalType, string> = {
  "trend-up": "the Nasdaq-100 trading above its medium-term average",
  "trend-down": "the Nasdaq-100 trading below its medium-term average",
  oversold: "the Nasdaq-100 looking beaten-down (oversold)",
  overbought: "the Nasdaq-100 looking stretched (overbought)",
};

/** Signal generated from PAST data only (closes[0..i]). No look-ahead. */
function signalFires(type: SignalType, closes: number[]): boolean {
  const last = closes[closes.length - 1];
  if (type === "oversold" || type === "overbought") {
    const r = rsi(closes, 14);
    if (r === null) return false;
    return type === "oversold" ? r < RSI.oversold : r > RSI.overbought;
  }
  const s = sma(closes, 50);
  if (s === null) return false;
  return type === "trend-up" ? last > s : last < s;
}

function windowToBars(window: string): number {
  // Daily-bar backtest: intraday windows map to 1 session with a caveat.
  if (/^\d+$/.test(window)) return Math.max(1, parseInt(window, 10));
  if (window === "5d" || window === "1w") return 5;
  if (window === "20d" || window === "1m") return 20;
  return 1; // next-session / eod / intraday
}

export function runBacktest(params: { signalType: SignalType; symbol: string; window: string; daily: Bar[] }): BacktestResult {
  const { signalType, symbol, window, daily } = params;
  const forward = windowToBars(window);
  const closes = daily.map((b) => b.c);
  const cost = BACKTEST_ASSUMPTIONS.transactionCostPct + BACKTEST_ASSUMPTIONS.slippagePct;
  const minHistory = 60;

  const obs: ForwardObservation[] = [];
  const signalIndices: number[] = [];
  const dir = DIRECTION[signalType];

  for (let i = minHistory; i < daily.length - 1; i++) {
    // Only past + current data to decide.
    if (!signalFires(signalType, closes.slice(0, i + 1))) continue;
    signalIndices.push(i);
    const end = Math.min(i + forward, daily.length - 1);
    if (end <= i) continue;
    const entry = daily[i].c;
    if (entry <= 0) continue;
    const ret = ((daily[end].c - entry) / entry) * 100;
    const fwdSlice = daily.slice(i + 1, end + 1);
    const highs = fwdSlice.map((b) => b.h);
    const lows = fwdSlice.map((b) => b.l);
    const mfe = dir === 1 ? ((Math.max(...highs) - entry) / entry) * 100 : ((entry - Math.min(...lows)) / entry) * 100;
    const mae = dir === 1 ? ((Math.min(...lows) - entry) / entry) * 100 : ((entry - Math.max(...highs)) / entry) * 100;
    obs.push({ ret, mfe, mae });
  }

  const leak = validateNoLookAhead(signalIndices, forward, daily.length);
  const m = computeMetrics(obs, dir, cost);

  const confidence: BacktestResult["confidence"] =
    m.sampleSize >= BACKTEST_MIN_SAMPLE.moderate ? "high" : m.sampleSize >= BACKTEST_MIN_SAMPLE.low ? "moderate" : "low";

  const hitPct = m.hitRate !== null ? Math.round(m.hitRate * 100) : null;
  const dirWord = dir === 1 ? "positive" : "negative";
  const plain =
    m.sampleSize === 0
      ? `Not enough history to evaluate "${LABELS[signalType]}".`
      : `Historically, when there was ${LABELS[signalType]}, the next ${window} move was ${dirWord} ${hitPct}% of the time (avg ${m.avgReturnPct}% after costs), across ${m.sampleSize} cases.` +
        (confidence === "low" ? " Sample size is small — treat this as low confidence." : "");

  return {
    signalType,
    symbol,
    window,
    sampleSize: m.sampleSize,
    hitRate: m.hitRate,
    avgForwardReturnPct: m.avgReturnPct,
    medianForwardReturnPct: m.medianReturnPct,
    forwardVolatilityPct: m.volatilityPct,
    maxAdverseExcursionPct: m.maxAdverseExcursionPct,
    maxFavorableExcursionPct: m.maxFavorableExcursionPct,
    falsePositiveRate: m.falsePositiveRate,
    confidence,
    leakageChecksPassed: leak === null,
    assumptions: BACKTEST_ASSUMPTIONS,
    plain,
    disclaimer: "This is not a prediction. It is a historical context measure based on daily data, and past behavior does not guarantee future results.",
  };
}
