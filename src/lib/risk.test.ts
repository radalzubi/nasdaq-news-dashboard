import { describe, expect, it } from "vitest";
import { computeRisk } from "./risk";

describe("computeRisk", () => {
  it("sizes a long position from the risk budget", () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 98, target: 106 });
    expect(r.direction).toBe("long");
    expect(r.riskBudget).toBe(100);
    expect(r.perShareRisk).toBe(2);
    expect(r.positionSize).toBe(50); // 100 budget / 2 per share
    expect(r.dollarRisk).toBe(100);
    expect(r.riskReward).toBe(3); // reward 6 / risk 2
    expect(r.potentialReward).toBe(300);
  });

  it("detects a short trade from stop above entry", () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 102, target: 94 });
    expect(r.direction).toBe("short");
    expect(r.riskReward).toBe(3);
  });

  it("warns when risk per trade exceeds the common guideline", () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 5, entry: 100, stop: 98 });
    expect(r.warnings.some((w) => /guideline/i.test(w))).toBe(true);
  });

  it("warns when reward is smaller than risk", () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 95, target: 102 });
    expect(r.warnings.some((w) => /reward is smaller/i.test(w))).toBe(true);
  });

  it("warns when the position would exceed the account", () => {
    const r = computeRisk({ accountSize: 1000, riskPct: 50, entry: 100, stop: 99 });
    expect(r.warnings.some((w) => /larger than your account/i.test(w))).toBe(true);
  });

  it("warns when the stop is tight relative to ATR", () => {
    const r = computeRisk({ accountSize: 100000, riskPct: 1, entry: 100, stop: 99.7, atr: 3 });
    expect(r.warnings.some((w) => /tight/i.test(w))).toBe(true);
  });

  it("warns about an event window when flagged", () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 98, eventSoon: true });
    expect(r.warnings.some((w) => /economic event/i.test(w))).toBe(true);
  });

  it("handles stop == entry without dividing by zero", () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 100 });
    expect(r.positionSize).toBe(0);
    expect(r.warnings.some((w) => /same as your entry/i.test(w))).toBe(true);
  });

  it("warns when target is on the wrong side for a long", () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 98, target: 99 });
    expect(r.warnings.some((w) => /target should be above/i.test(w))).toBe(true);
  });
});
