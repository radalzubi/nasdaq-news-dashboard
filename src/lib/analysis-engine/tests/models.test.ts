import { describe, expect, it } from "vitest";
import { runAnalysisEngine } from "../core/engine";
import { CLARITY_WEIGHTS } from "../core/config";
import { buildBreadthRead } from "../features/breadthFeatures";
import { buildNewsImpact } from "../features/newsFeatures";
import { classifyRegime } from "../models/marketRegimeModel";
import type { RegimeSignals } from "../features/regimeFeatures";
import { bullishInput, cluster, quote } from "./fixtures";

function sig(p: Partial<RegimeSignals>): RegimeSignals {
  return {
    primaryChangePct: 0.5,
    trend: "Mixed",
    inControl: "neither",
    vixLevel: 15,
    vixChangePct: 0,
    yieldsChangePct: 0,
    newsBias: "neutral",
    newsTopImpact: 40,
    relVol: 1,
    intradayRangePct: 0.5,
    breadthClass: "Mixed",
    breadthNarrow: false,
    eventImminent: false,
    eventJustPassed: false,
    volRegime: "Normal",
    ...p,
  };
}

describe("classifyRegime", () => {
  it("detects a narrow mega-cap-led move", () => {
    expect(classifyRegime(sig({ trend: "Positive", breadthNarrow: true, primaryChangePct: 0.8 })).regime).toBe("Narrow mega-cap-led move");
  });
  it("detects a broad-based rally", () => {
    expect(classifyRegime(sig({ trend: "Positive", breadthClass: "Broad bullish", primaryChangePct: 1.0 })).regime).toBe("Broad-based rally");
  });
  it("detects a broad-based selloff", () => {
    expect(classifyRegime(sig({ trend: "Negative", breadthClass: "Broad bearish", primaryChangePct: -1.5 })).regime).toBe("Broad-based selloff");
  });
  it("detects a macro-event waiting period", () => {
    expect(classifyRegime(sig({ eventImminent: true })).regime).toBe("Macro-event waiting period");
  });
  it("detects high-volatility liquidation", () => {
    expect(classifyRegime(sig({ volRegime: "Extreme", primaryChangePct: -2 })).regime).toBe("High-volatility liquidation");
  });
  it("always includes an invalidation + watch-next", () => {
    const r = classifyRegime(sig({ trend: "Positive" }));
    expect(r.invalidatedBy.length).toBeGreaterThan(0);
    expect(r.watchNext.length).toBeGreaterThan(0);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe("clarity model (via engine)", () => {
  const out = runAnalysisEngine(bullishInput());
  it("weighted component weights sum to ~1", () => {
    const sum = Object.values(out.componentScores)
      .filter((c) => c.key !== "microstructure")
      .reduce((a, c) => a + c.weight, 0);
    expect(sum).toBeCloseTo(1, 2);
    expect(sum).toBeCloseTo(Object.values(CLARITY_WEIGHTS).reduce((a, b) => a + b, 0), 5);
  });
  it("factor contributions carry the correct sign", () => {
    for (const f of out.factorContributions) {
      if (f.direction === "positive") expect(f.points).toBeGreaterThan(0);
      else expect(f.points).toBeLessThan(0);
    }
  });
  it("clarity stays within 0–100 and has a label + main driver", () => {
    expect(out.marketClarity.score).toBeGreaterThanOrEqual(0);
    expect(out.marketClarity.score).toBeLessThanOrEqual(100);
    expect(out.marketClarity.label.length).toBeGreaterThan(0);
    expect(out.marketClarity.mainDriver.length).toBeGreaterThan(0);
  });
});

describe("conflict detection (via engine)", () => {
  it("flags bullish news against a falling price", () => {
    const input = bullishInput();
    input.quotes.QQQ = quote("QQQ", -1.5, 472);
    input.quotes.NDX = quote("NDX", -1.5, 20400);
    input.newsClusters = [cluster({ id: "c", headline: "Great earnings beat", sentiment: "positive", importance: "high", relevanceScore: 80, tickers: [] })];
    const out = runAnalysisEngine(input);
    expect(out.conflicts.some((c) => c.id.startsWith("news-vs-price"))).toBe(true);
  });
});

describe("buildBreadthRead", () => {
  it("classifies a broad bullish day", () => {
    const quotes: Record<string, ReturnType<typeof quote>> = {};
    const leaders = ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA", "AMD"];
    for (const s of leaders) quotes[s] = quote(s, 1.0, 200);
    const r = buildBreadthRead({ quotes, leaders });
    expect(r.classification).toBe("Broad bullish");
    expect(r.bias).toBe("bullish");
    expect(r.degraded).toBe(false);
  });
  it("degrades gracefully with too few leaders", () => {
    const r = buildBreadthRead({ quotes: { NVDA: quote("NVDA", 1, 200) }, leaders: ["NVDA", "AAPL", "MSFT"] });
    expect(r.degraded).toBe(true);
  });
});

describe("buildNewsImpact", () => {
  it("scores a fresh market-moving story and confirms with price", () => {
    const r = buildNewsImpact({
      clusters: [cluster({ id: "n", headline: "Nvidia surges on AI demand", sentiment: "positive", relevanceScore: 90, importance: "market-moving" })],
      quotes: { NVDA: quote("NVDA", 3, 140) },
      primaryChangePct: 1.2,
    });
    expect(r.items[0].impactScore).toBeGreaterThan(50);
    expect(r.items[0].priceConfirming).toBe(true);
    expect(r.netSentiment).toBe("bullish");
  });
  it("says 'Impact unclear' when it can't determine why", () => {
    const c = cluster({ id: "x", headline: "Company schedules investor day", whyItMatters: "" });
    const r = buildNewsImpact({ clusters: [c], quotes: {}, primaryChangePct: null });
    expect(r.items[0].whyItMatters).toBe("Impact unclear from available data.");
    expect(r.items[0].priceConfirming).toBeNull();
  });
});
