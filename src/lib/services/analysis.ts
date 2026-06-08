import { CORE_SYMBOLS, NASDAQ_LEADERS, PRIMARY_LABEL, PRIMARY_SYMBOL } from "@/lib/config";
import { getMarketSession } from "@/lib/market-clock";
import { runAnalysisEngine, runBacktest, walkForward, type AnalysisEngineOutput, type EngineInput, type SignalType } from "@/lib/analysis-engine";
import { calibrate } from "@/lib/analysis-engine/validation/calibration";
import { replayDirectional } from "@/lib/analysis-engine/validation/signalReplay";
import type { MarketSession } from "@/lib/analysis-engine/core/types";
import type { DataStatus } from "@/lib/types";
import { getBars, getMacroEvents, getNews, getQuotes } from "./market";

/* ----------------------------------------------------------------------------
 * Analysis service: gathers normalized inputs from the provider layer and runs
 * the pure analysis engine. Lightweight cache so the API routes can each pull
 * the same engine run without recomputing.
 * -------------------------------------------------------------------------- */

const CACHE = new Map<string, { value: unknown; expires: number }>();
async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  CACHE.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

function mapSession(s: ReturnType<typeof getMarketSession>["session"]): MarketSession {
  return s === "pre" ? "premarket" : s === "post" ? "afterhours" : s === "closed" ? "closed" : "regular";
}

async function buildInput(): Promise<EngineInput> {
  const symbols = [...new Set([...CORE_SYMBOLS, ...NASDAQ_LEADERS, "SPY", "IWM", "DXY", "GOLD"])];

  // Fetch bars FIRST, on their own — Yahoo throttles concurrent bursts, so we
  // keep the (cached 2h) bar requests away from the quote batch. One real fetch sticks.
  const daily = await getBars(PRIMARY_SYMBOL, "1D");
  const intraday = await getBars(PRIMARY_SYMBOL, "5m");

  const [quotes, news, macro] = await Promise.all([getQuotes(symbols), getNews(), getMacroEvents()]);

  const sources: Record<string, DataStatus> = {};
  for (const [sym, p] of Object.entries(quotes.provenance)) sources[sym] = p.status;

  const missingInputs: string[] = [];
  if (news.meta.status === "unavailable") missingInputs.push("news");
  if (macro.meta.status === "unavailable") missingInputs.push("economic calendar");

  const historyReal = daily.items.length > 0 && daily.meta.status !== "demo" && daily.meta.status !== "unavailable";

  return {
    symbol: PRIMARY_SYMBOL,
    label: PRIMARY_LABEL,
    session: mapSession(getMarketSession().session),
    quotes: quotes.bySymbol,
    intraday: intraday.items,
    daily: daily.items,
    newsClusters: news.clusters,
    macroEvents: macro.items,
    leaders: [...NASDAQ_LEADERS],
    historyReal,
    dataQuality: { sources, missingInputs },
  };
}

export async function getTrackRecord() {
  const daily = await getBars(PRIMARY_SYMBOL, "1D");
  const basedOnRealData = daily.items.length > 0 && daily.meta.status !== "demo" && daily.meta.status !== "unavailable";
  const calibration = calibrate(replayDirectional(daily.items));
  return { calibration, basedOnRealData, source: daily.meta.source, status: daily.meta.status };
}

export function getAnalysis(): Promise<AnalysisEngineOutput> {
  return memo("analysis", 15_000, async () => runAnalysisEngine(await buildInput()));
}

export async function getBacktest(signalType: SignalType, symbol: string, window: string) {
  const daily = await getBars(symbol.toUpperCase(), "1D");
  return {
    backtest: runBacktest({ signalType, symbol: symbol.toUpperCase(), window, daily: daily.items }),
    walkForward: walkForward({ signalType, symbol: symbol.toUpperCase(), window, daily: daily.items }),
    meta: daily.meta,
  };
}
