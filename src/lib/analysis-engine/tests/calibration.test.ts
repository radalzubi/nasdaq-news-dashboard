import { describe, expect, it } from "vitest";
import { calibrate, bucketFor } from "../validation/calibration";
import { replayDirectional } from "../validation/signalReplay";
import { runAnalysisEngine } from "../core/engine";
import { bullishInput, dailyBars } from "./fixtures";

describe("signalReplay — no look-ahead", () => {
  it("a past observation does not change when future bars are added", () => {
    const full = dailyBars(160, 500, 0.08);
    const prefix = full.slice(0, 120);
    const obsFull = replayDirectional(full);
    const obsPrefix = replayDirectional(prefix);
    // Observations that exist in the prefix replay must match the full replay
    // for the same signal positions (signal at i uses only closes[0..i]).
    const compareN = Math.min(obsPrefix.length, 30);
    for (let k = 0; k < compareN; k++) {
      expect(obsFull[k].dir).toBe(obsPrefix[k].dir);
      expect(obsFull[k].strength).toBeCloseTo(obsPrefix[k].strength, 6);
    }
  });

  it("leans bullish and is mostly correct on a steady uptrend", () => {
    const obs = replayDirectional(dailyBars(200, 500, 0.1));
    expect(obs.length).toBeGreaterThan(0);
    expect(obs.every((o) => o.dir === 1)).toBe(true);
    const cal = calibrate(obs);
    expect(cal.overallHitRate).toBeGreaterThan(0.9); // deterministic uptrend → almost always up next day
  });
});

describe("calibrate", () => {
  it("returns buckets, IC, and Brier on enough data", () => {
    const cal = calibrate(replayDirectional(dailyBars(220, 500, 0.06)));
    expect(cal.sampleSize).toBeGreaterThan(0);
    expect(cal.buckets.length).toBe(4);
    expect(cal.informationCoefficient).not.toBeNull();
    expect(cal.brierScore).not.toBeNull();
  });
  it("handles empty input without throwing", () => {
    const cal = calibrate([]);
    expect(cal.sampleSize).toBe(0);
    expect(cal.overallHitRate).toBeNull();
  });
  it("bucketFor selects the right strength bucket", () => {
    const cal = calibrate(replayDirectional(dailyBars(220, 500, 0.06)));
    const b = bucketFor(cal, 50);
    expect(b?.range[0]).toBe(45);
    expect(b?.range[1]).toBe(60);
  });
});

describe("engine reliability output", () => {
  it("attaches a reliability read and flags sample vs real history", () => {
    const out = runAnalysisEngine(bullishInput({ historyReal: false }));
    expect(out.reliability.sampleSize).toBeGreaterThanOrEqual(0);
    expect(out.reliability.basedOnRealData).toBe(false);
    expect(out.reliability.plain.toLowerCase()).toContain("sample");
    expect(out.reliability.disclaimer.toLowerCase()).toContain("not a forecast");

    const real = runAnalysisEngine(bullishInput({ historyReal: true }));
    expect(real.reliability.basedOnRealData).toBe(true);
  });
});
