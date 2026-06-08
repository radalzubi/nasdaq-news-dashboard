import type { Bar, EconomicEvent, NewsCluster, Quote } from "@/lib/types";
import type { EngineInput } from "../core/types";

export function quote(symbol: string, changePct: number, price = 480, asOfMinAgo = 0): Quote {
  const prevClose = price / (1 + changePct / 100);
  return {
    symbol,
    price,
    change: +(price - prevClose).toFixed(2),
    changePct,
    prevClose: +prevClose.toFixed(2),
    open: +prevClose.toFixed(2),
    dayHigh: +(Math.max(price, prevClose) * 1.006).toFixed(2),
    dayLow: +(Math.min(price, prevClose) * 0.994).toFixed(2),
    volume: 40_000_000,
    session: "regular",
    asOf: new Date(Date.now() - asOfMinAgo * 60000).toISOString(),
  };
}

/** Deterministic daily series of `count` bars ending at `end`, with a per-bar drift. */
export function dailyBars(count: number, end: number, driftPct = 0.05, vol = 40_000_000): Bar[] {
  const bars: Bar[] = [];
  let price = end / (1 + (driftPct / 100) * count);
  const dayMs = 86_400_000;
  const start = Date.now() - count * dayMs;
  for (let i = 0; i < count; i++) {
    const o = price;
    price = price * (1 + driftPct / 100);
    bars.push({ t: start + i * dayMs, o: +o.toFixed(2), h: +(Math.max(o, price) * 1.003).toFixed(2), l: +(Math.min(o, price) * 0.997).toFixed(2), c: +price.toFixed(2), v: vol });
  }
  return bars;
}

export function intradayBars(count: number, open: number, close: number, vol = 500_000): Bar[] {
  const bars: Bar[] = [];
  const step = (close - open) / count;
  const barMs = 5 * 60_000;
  const start = Date.now() - count * barMs;
  let p = open;
  for (let i = 0; i < count; i++) {
    const o = p;
    p = i === count - 1 ? close : p + step;
    bars.push({ t: start + i * barMs, o: +o.toFixed(2), h: +(Math.max(o, p) * 1.001).toFixed(2), l: +(Math.min(o, p) * 0.999).toFixed(2), c: +p.toFixed(2), v: vol });
  }
  return bars;
}

export function cluster(partial: Partial<NewsCluster> & Pick<NewsCluster, "id" | "headline">): NewsCluster {
  const iso = new Date().toISOString();
  return {
    summary: "summary",
    whyItMatters: "Because semiconductors drive Nasdaq sentiment.",
    sentiment: "positive",
    importance: "high",
    relevanceScore: 80,
    tickers: ["NVDA"],
    categories: ["semis"],
    affectedAreas: ["Semiconductors"],
    sources: ["Reuters", "Bloomberg"],
    articleCount: 2,
    items: [{ id: partial.id, headline: partial.headline, source: "Reuters", url: "#", publishedAt: iso, tickers: ["NVDA"], sentiment: "positive", importance: "high", relevanceScore: 80, categories: ["semis"], affectedAreas: ["Semiconductors"] }],
    firstSeen: iso,
    lastSeen: iso,
    ...partial,
  };
}

export function event(minsFromNow: number, importance: EconomicEvent["importance"] = "high"): EconomicEvent {
  return {
    id: "cpi",
    title: "CPI Inflation Report",
    country: "US",
    time: new Date(Date.now() + minsFromNow * 60000).toISOString(),
    importance,
    whyItMatters: "Inflation affects rate expectations.",
    category: "inflation",
  };
}

const LEADERS = ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA", "AMD", "AVGO", "NFLX", "PLTR", "COST"];

/** A coherent bullish, broad-based day. */
export function bullishInput(overrides: Partial<EngineInput> = {}): EngineInput {
  const quotes: Record<string, Quote> = {
    QQQ: quote("QQQ", 1.2, 480),
    NDX: quote("NDX", 1.2, 20800),
    SPY: quote("SPY", 0.8, 575),
    VIX: quote("VIX", -4, 14),
    TNX: quote("TNX", -1.2, 4.2),
    IWM: quote("IWM", 0.6, 210),
  };
  for (const s of LEADERS) quotes[s] = quote(s, 0.8 + Math.abs(s.length % 3) * 0.3, 200);
  return {
    symbol: "QQQ",
    label: "Nasdaq-100",
    session: "regular",
    quotes,
    intraday: intradayBars(60, 474, 480),
    daily: dailyBars(220, 480, 0.05),
    newsClusters: [cluster({ id: "n1", headline: "Nvidia rises on strong AI demand", sentiment: "positive", importance: "market-moving", relevanceScore: 88 })],
    macroEvents: [event(300, "high")],
    leaders: LEADERS,
    dataQuality: { sources: { QQQ: "live" }, missingInputs: [] },
    ...overrides,
  };
}
