import { describe, expect, it } from "vitest";
import { runAnalysisEngine } from "../core/engine";
import { MODEL_VERSION } from "../core/types";
import { bullishInput, cluster, dailyBars, event, intradayBars, quote } from "./fixtures";

describe("runAnalysisEngine — integration", () => {
  it("produces a coherent bullish read on a broad-based up day", () => {
    const out = runAnalysisEngine(bullishInput());
    expect(["bullish", "mixed", "cautious", "quiet"]).toContain(out.marketMood);
    expect(out.marketClarity.score).toBeGreaterThan(0);
    expect(out.marketClarity.score).toBeLessThanOrEqual(100);
    expect(out.directionalBias.bias === "bullish" || out.directionalBias.bias === "neutral").toBe(true);
    expect(out.plainEnglishSummary.oneSentence.length).toBeGreaterThan(10);
    expect(out.auditTrail.modelVersion).toBe(MODEL_VERSION);
    expect(out.auditTrail.inputsUsed).toContain("news");
    expect(out.keyLevels.length).toBeGreaterThan(0);
  });

  it("contains no raw indicator jargon in the user-facing summary", () => {
    const out = runAnalysisEngine(bullishInput());
    const text = `${out.plainEnglishSummary.oneSentence} ${out.plainEnglishSummary.whatChanged} ${out.plainEnglishSummary.whyItMatters}`.toLowerCase();
    // Word-boundary match so plain words like "demand" don't trip the "ema" check.
    for (const jargon of ["vwap", "rsi", "ema", "macd", "atr", "stochastic", "bollinger"]) {
      expect(text).not.toMatch(new RegExp(`\\b${jargon}\\b`));
    }
  });

  it("reads a sharp down day with rising fear gauge as bearish/volatile", () => {
    const quotes = bullishInput().quotes;
    quotes.QQQ = quote("QQQ", -2.4, 468);
    quotes.NDX = quote("NDX", -2.4, 20300);
    quotes.VIX = quote("VIX", 18, 24);
    for (const s of ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AMD", "AVGO"]) quotes[s] = quote(s, -2.5, 190);
    const out = runAnalysisEngine(
      bullishInput({
        quotes,
        intraday: intradayBars(60, 479, 468),
        daily: dailyBars(220, 468, -0.03),
        newsClusters: [cluster({ id: "b1", headline: "Stocks fall as growth fears mount", sentiment: "negative", importance: "market-moving", relevanceScore: 85, categories: ["nasdaq"], tickers: [] })],
      }),
    );
    expect(["bearish", "volatile", "cautious"]).toContain(out.marketMood);
    expect(out.volatility.regime === "Elevated" || out.volatility.regime === "Extreme").toBe(true);
  });

  it("caps clarity and warns when the live price is stale (regular session)", () => {
    const input = bullishInput();
    // Make every quote 20 minutes old.
    for (const k of Object.keys(input.quotes)) input.quotes[k] = quote(k, input.quotes[k]!.changePct ?? 0, input.quotes[k]!.price ?? 100, 20);
    const out = runAnalysisEngine(input);
    expect(out.dataQuality.staleInputs.length).toBeGreaterThan(0);
    expect(out.alerts.some((a) => a.type === "stale-data")).toBe(true);
    expect(out.marketClarity.score).toBeLessThanOrEqual(60);
  });

  it("flags missing news feed and never silently ignores it", () => {
    const out = runAnalysisEngine(bullishInput({ newsClusters: [], dataQuality: { sources: { QQQ: "live" }, missingInputs: ["news"] } }));
    expect(out.dataQuality.missingInputs).toContain("news");
    expect(out.alerts.some((a) => a.type === "missing-feed")).toBe(true);
  });

  it("enters a macro-event waiting period and caps clarity when an event is imminent", () => {
    const out = runAnalysisEngine(bullishInput({ macroEvents: [event(20, "high")] }));
    expect(out.regime.regime).toBe("Macro-event waiting period");
    expect(out.alerts.some((a) => a.type === "macro-event-window")).toBe(true);
    expect(out.marketClarity.score).toBeLessThanOrEqual(62);
  });

  it("never emits a buy/sell instruction", () => {
    const out = runAnalysisEngine(bullishInput());
    const blob = JSON.stringify(out).toLowerCase();
    expect(blob).not.toContain("buy now");
    expect(blob).not.toContain("sell now");
    expect(blob).not.toMatch(/guaranteed (return|profit)/);
  });
});
