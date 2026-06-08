import { mean, median, std, round } from "../core/scoring";

export interface ForwardObservation {
  /** Forward return % from signal to window end. */
  ret: number;
  /** Max adverse excursion % (worst point against the signal direction). */
  mae: number;
  /** Max favorable excursion % (best point in the signal direction). */
  mfe: number;
}

export interface PerformanceMetrics {
  sampleSize: number;
  hitRate: number | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  volatilityPct: number | null;
  maxAdverseExcursionPct: number | null;
  maxFavorableExcursionPct: number | null;
  falsePositiveRate: number | null;
}

/**
 * Computes signal-quality metrics. `direction` = the signal's expected sign
 * (+1 long-leaning, -1 short-leaning) used for hit rate / false positives.
 */
export function computeMetrics(obs: ForwardObservation[], direction: 1 | -1, costPct: number): PerformanceMetrics {
  const n = obs.length;
  if (n === 0) {
    return { sampleSize: 0, hitRate: null, avgReturnPct: null, medianReturnPct: null, volatilityPct: null, maxAdverseExcursionPct: null, maxFavorableExcursionPct: null, falsePositiveRate: null };
  }
  const dirReturns = obs.map((o) => o.ret * direction - costPct); // net of costs, in signal direction
  const wins = dirReturns.filter((r) => r > 0).length;
  return {
    sampleSize: n,
    hitRate: round(wins / n, 3),
    avgReturnPct: round(mean(dirReturns), 3),
    medianReturnPct: round(median(dirReturns), 3),
    volatilityPct: round(std(dirReturns), 3),
    maxAdverseExcursionPct: round(Math.min(...obs.map((o) => o.mae)), 3),
    maxFavorableExcursionPct: round(Math.max(...obs.map((o) => o.mfe)), 3),
    falsePositiveRate: round((n - wins) / n, 3),
  };
}
