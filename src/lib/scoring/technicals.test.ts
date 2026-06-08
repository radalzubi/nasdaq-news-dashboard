import { describe, expect, it } from "vitest";
import { atr, buildTechnicalSummary, ema, rsi, sma, vwap } from "./technicals";
import type { Bar } from "@/lib/types";

function mkBars(closes: number[], vol = 1000): Bar[] {
  return closes.map((c, i) => ({ t: i * 60000, o: c, h: c + 0.5, l: c - 0.5, c, v: vol }));
}

describe("sma", () => {
  it("averages the last N values", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([2, 4, 6], 2)).toBe(5);
  });
  it("returns null when insufficient", () => {
    expect(sma([1, 2], 5)).toBeNull();
  });
});

describe("ema", () => {
  it("returns a number close to recent values for a flat series", () => {
    expect(ema([5, 5, 5, 5, 5], 3)).toBeCloseTo(5, 5);
  });
  it("reacts to a rising series (ema above seed)", () => {
    const e = ema([1, 2, 3, 4, 5, 6, 7, 8], 4);
    expect(e).not.toBeNull();
    expect(e!).toBeGreaterThan(4);
  });
});

describe("rsi", () => {
  it("is 100 for a monotonically rising series", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(closes, 14)).toBe(100);
  });
  it("is low for a falling series", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(closes, 14)!).toBeLessThan(20);
  });
  it("returns null when insufficient", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });
});

describe("vwap", () => {
  it("equals price when all bars share it", () => {
    expect(vwap(mkBars([10, 10, 10]))).toBeCloseTo(10, 5);
  });
  it("weights by volume", () => {
    const bars: Bar[] = [
      { t: 0, o: 10, h: 10, l: 10, c: 10, v: 100 },
      { t: 1, o: 20, h: 20, l: 20, c: 20, v: 300 },
    ];
    expect(vwap(bars)).toBeCloseTo(17.5, 5);
  });
});

describe("atr", () => {
  it("returns null with too few bars", () => {
    expect(atr(mkBars([1, 2, 3]), 14)).toBeNull();
  });
  it("computes a positive range for noisy bars", () => {
    const bars = Array.from({ length: 20 }, (_, i) => ({ t: i, o: 100, h: 102, l: 98, c: 100 + (i % 2), v: 1 }));
    expect(atr(bars, 14)!).toBeGreaterThan(0);
  });
});

describe("buildTechnicalSummary", () => {
  it("reads a clean uptrend as Positive with price above VWAP", () => {
    const intraday = mkBars(Array.from({ length: 30 }, (_, i) => 100 + i * 0.2));
    const daily = mkBars(Array.from({ length: 220 }, (_, i) => 80 + i * 0.1));
    const summary = buildTechnicalSummary({
      symbol: "QQQ",
      intraday,
      daily,
      quote: {
        symbol: "QQQ", price: 106, change: 1, changePct: 1, prevClose: 105, open: 105,
        dayHigh: 106, dayLow: 104, volume: 1000, asOf: new Date().toISOString(),
      },
    });
    expect(summary.symbol).toBe("QQQ");
    const vwapInd = summary.indicators.find((i) => i.key === "vwap");
    expect(vwapInd?.stance).toBe("bullish");
    expect(summary.trend).toBe("Positive");
    expect(summary.explanation.length).toBeGreaterThan(0);
  });

  it("handles missing daily data without throwing", () => {
    const intraday = mkBars([100, 100.5, 101]);
    const summary = buildTechnicalSummary({ symbol: "QQQ", intraday });
    expect(summary).toBeTruthy();
    expect(["Positive", "Negative", "Mixed"]).toContain(summary.trend);
  });
});
