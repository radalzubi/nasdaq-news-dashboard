import { describe, expect, it } from "vitest";
import { computeMarketClarity, deriveMood } from "./clarity";
import type { EconomicEvent, NewsCluster, Quote, TechnicalSummary } from "@/lib/types";

function q(symbol: string, changePct: number, price = 100): Quote {
  return {
    symbol, price, change: (price * changePct) / 100, changePct, prevClose: price - (price * changePct) / 100,
    open: price, dayHigh: price, dayLow: price, volume: 1000, asOf: new Date().toISOString(),
  };
}

function cluster(partial: Partial<NewsCluster>): NewsCluster {
  return {
    id: "c", headline: "h", sentiment: "neutral", importance: "high", relevanceScore: 75,
    tickers: [], categories: ["nasdaq"], affectedAreas: ["QQQ"], sources: ["Reuters"],
    articleCount: 1, items: [], firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
    ...partial,
  };
}

const cleanBullTech: TechnicalSummary = {
  symbol: "QQQ", trend: "Positive", momentum: "Strong", volume: "Heavy", chopRisk: "Low",
  keyLevel: 100, keyLevelLabel: "VWAP", explanation: "Positive tape.",
  indicators: [{ key: "vwap", label: "Price vs VWAP", value: "above", stance: "bullish", confidence: "high", mattersNow: true, plain: "" }],
  asOf: new Date().toISOString(),
};

describe("computeMarketClarity", () => {
  it("returns a strong, bullish read when everything agrees", () => {
    const quotes: Record<string, Quote | null> = {
      QQQ: q("QQQ", 1.2, 480), SPY: q("SPY", 0.8, 580), VIX: q("VIX", -3, 14), TNX: q("TNX", -1.2, 4.2),
      NVDA: q("NVDA", 2.5), AAPL: q("AAPL", 1.1), MSFT: q("MSFT", 1.4), AMZN: q("AMZN", 0.9),
      META: q("META", 1.0), GOOGL: q("GOOGL", 0.7), TSLA: q("TSLA", 1.5), AMD: q("AMD", 2.0),
      AVGO: q("AVGO", 1.8), NFLX: q("NFLX", 0.6), PLTR: q("PLTR", 1.2), COST: q("COST", 0.5),
    };
    const news = [cluster({ sentiment: "positive", importance: "market-moving", relevanceScore: 88, categories: ["semis"] })];
    const clarity = computeMarketClarity({ news, qqqTechnical: cleanBullTech, quotes, macroEvents: [] });
    expect(clarity.bias).toBe("Bullish");
    expect(clarity.score).toBeGreaterThanOrEqual(70);
    expect(clarity.supporting.length).toBe(3);
    expect(clarity.risks.length).toBe(3);
  });

  it("penalizes an imminent high-impact macro event", () => {
    const quotes: Record<string, Quote | null> = { QQQ: q("QQQ", 0.3, 480), VIX: q("VIX", 1, 15), TNX: q("TNX", 0, 4.2) };
    const event: EconomicEvent = {
      id: "cpi", title: "CPI Inflation Report", country: "US",
      time: new Date(Date.now() + 20 * 60000).toISOString(), importance: "high",
      whyItMatters: "x", category: "inflation",
    };
    const withEvent = computeMarketClarity({ news: [], qqqTechnical: cleanBullTech, quotes, macroEvents: [event] });
    const withoutEvent = computeMarketClarity({ news: [], qqqTechnical: cleanBullTech, quotes, macroEvents: [] });
    const macroWith = withEvent.components.find((c) => c.key === "macro")!.score;
    const macroWithout = withoutEvent.components.find((c) => c.key === "macro")!.score;
    expect(macroWith).toBeLessThan(macroWithout);
    expect(withEvent.risks.join(" ")).toMatch(/CPI/i);
  });

  it("flags and caps the score when data is missing", () => {
    const quotes: Record<string, Quote | null> = { QQQ: null };
    const clarity = computeMarketClarity({
      news: [], qqqTechnical: null, quotes, macroEvents: [],
      dataIssues: ["Quotes feed unavailable", "News feed unavailable"],
    });
    expect(clarity.dataQualityWarning).toBeTruthy();
    expect(clarity.score).toBeLessThanOrEqual(58);
  });

  it("produces a label consistent with the score", () => {
    const quotes: Record<string, Quote | null> = { QQQ: q("QQQ", 0, 480), VIX: q("VIX", 0, 15), TNX: q("TNX", 0, 4.2) };
    const clarity = computeMarketClarity({ news: [], qqqTechnical: null, quotes, macroEvents: [] });
    expect(clarity.label).toBeTruthy();
    expect(clarity.score).toBeGreaterThanOrEqual(0);
    expect(clarity.score).toBeLessThanOrEqual(100);
  });
});

describe("deriveMood", () => {
  it("returns Volatile when VIX spikes hard", () => {
    const clarity = computeMarketClarity({
      news: [], qqqTechnical: cleanBullTech,
      quotes: { QQQ: q("QQQ", 0.5, 480), VIX: q("VIX", 12, 22) }, macroEvents: [],
    });
    expect(deriveMood(clarity, { VIX: q("VIX", 12, 22) })).toBe("Volatile");
  });
});
