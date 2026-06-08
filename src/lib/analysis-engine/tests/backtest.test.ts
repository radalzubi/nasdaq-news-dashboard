import { describe, expect, it } from "vitest";
import { runBacktest } from "../validation/backtest";
import { walkForward } from "../validation/walkForward";
import { noFutureBars, validateNoLookAhead } from "../validation/leakageChecks";
import { computeMetrics } from "../validation/performanceMetrics";
import { dailyBars } from "./fixtures";

describe("leakage checks", () => {
  it("noFutureBars rejects bars after the decision time", () => {
    const bars = dailyBars(5, 100);
    const decision = bars[2].t;
    expect(noFutureBars(bars.slice(0, 3), decision)).toBe(true);
    expect(noFutureBars(bars, decision)).toBe(false);
  });
  it("validateNoLookAhead returns null for in-range signals", () => {
    expect(validateNoLookAhead([60, 80, 100], 1, 220)).toBeNull();
  });
  it("validateNoLookAhead flags out-of-range indices", () => {
    expect(validateNoLookAhead([300], 1, 220)).toMatch(/out of range/);
  });
});

describe("performance metrics", () => {
  it("computes hit rate and average net of costs", () => {
    const m = computeMetrics([{ ret: 2, mae: -1, mfe: 3 }, { ret: -1, mae: -2, mfe: 0.5 }, { ret: 1, mae: -0.5, mfe: 1.5 }], 1, 0);
    expect(m.sampleSize).toBe(3);
    expect(m.hitRate).toBeCloseTo(2 / 3, 2);
    expect(m.avgReturnPct).toBeCloseTo((2 - 1 + 1) / 3, 2);
  });
});

describe("runBacktest", () => {
  it("passes leakage checks and produces metrics on a clean uptrend", () => {
    const daily = dailyBars(260, 500, 0.1); // steady uptrend
    const res = runBacktest({ signalType: "trend-up", symbol: "QQQ", window: "next-session", daily });
    expect(res.leakageChecksPassed).toBe(true);
    expect(res.sampleSize).toBeGreaterThan(0);
    expect(res.hitRate).not.toBeNull();
    expect(res.assumptions.transactionCostPct).toBeGreaterThan(0);
    expect(res.disclaimer.toLowerCase()).toContain("not a prediction");
  });

  it("warns on small sample size", () => {
    const daily = dailyBars(70, 500, 0.1);
    const res = runBacktest({ signalType: "oversold", symbol: "QQQ", window: "next-session", daily });
    // Oversold rarely fires on a pure uptrend → tiny/empty sample → low confidence.
    expect(res.confidence).toBe("low");
  });

  it("never promises returns in its plain text", () => {
    const daily = dailyBars(260, 500, 0.1);
    const res = runBacktest({ signalType: "trend-up", symbol: "QQQ", window: "next-session", daily });
    expect(res.plain.toLowerCase()).not.toMatch(/guaranteed|will (go|rise|fall)/);
    expect(res.plain.toLowerCase()).toContain("historically");
  });
});

describe("walkForward", () => {
  it("produces windows and a stability measure on enough history", () => {
    const daily = dailyBars(260, 500, 0.08);
    const wf = walkForward({ signalType: "trend-up", symbol: "QQQ", window: "next-session", daily });
    expect(wf.windows.length).toBeGreaterThan(0);
    expect(wf.plain.length).toBeGreaterThan(0);
  });
});
