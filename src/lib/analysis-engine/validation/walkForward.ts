import type { Bar } from "@/lib/types";
import { round } from "../core/scoring";
import { runBacktest, type SignalType } from "./backtest";

export interface WalkForwardWindow {
  index: number;
  trainBars: number;
  testBars: number;
  hitRate: number | null;
  sampleSize: number;
}

export interface WalkForwardResult {
  signalType: string;
  windows: WalkForwardWindow[];
  /** Std-dev of hit rate across windows — high = unstable / likely overfit. */
  hitRateStability: number | null;
  plain: string;
}

/**
 * Out-of-sample validation: roll the history forward in chunks and evaluate the
 * signal on each unseen segment. Stable hit rates across windows are more
 * trustworthy than one impressive in-sample number.
 */
export function walkForward(params: { signalType: SignalType; symbol: string; window: string; daily: Bar[]; folds?: number }): WalkForwardResult {
  const { signalType, symbol, window, daily, folds = 4 } = params;
  const windows: WalkForwardWindow[] = [];
  const minTrain = 80;

  if (daily.length < minTrain + folds * 20) {
    return { signalType, windows: [], hitRateStability: null, plain: "Not enough history for walk-forward validation." };
  }

  const segment = Math.floor((daily.length - minTrain) / folds);
  for (let f = 0; f < folds; f++) {
    const trainEnd = minTrain + f * segment;
    const testEnd = Math.min(trainEnd + segment, daily.length);
    const slice = daily.slice(0, testEnd);
    const res = runBacktest({ signalType, symbol, window, daily: slice });
    windows.push({ index: f, trainBars: trainEnd, testBars: testEnd - trainEnd, hitRate: res.hitRate, sampleSize: res.sampleSize });
  }

  const rates = windows.map((w) => w.hitRate).filter((x): x is number => x !== null);
  const mean = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const variance = rates.length > 1 ? rates.reduce((a, r) => a + (r - mean) ** 2, 0) / (rates.length - 1) : 0;
  const stability = rates.length > 1 ? round(Math.sqrt(variance), 3) : null;

  const plain =
    stability === null
      ? "Walk-forward results are inconclusive (too few cases)."
      : stability < 0.12
      ? "Results are fairly stable across time windows, which is reassuring."
      : "Results vary a lot across time windows, so treat this signal with extra caution.";

  return { signalType, windows, hitRateStability: stability, plain };
}
