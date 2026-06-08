import { mean, pearson, round } from "../core/scoring";
import type { ReplayObs } from "./signalReplay";

/* ============================================================================
 * Calibration — does a high-confidence call actually correspond to a higher
 * hit rate? This is what makes a confidence number trustworthy.
 * ========================================================================== */

export interface CalibrationBucket {
  range: [number, number];
  n: number;
  hitRate: number | null;
  avgForwardPct: number | null;
}

export interface CalibrationResult {
  sampleSize: number;
  overallHitRate: number | null;
  /** Correlation between signed conviction and realized return (information coefficient). */
  informationCoefficient: number | null;
  /** Mean squared error of conviction-as-probability vs outcome (lower is better). */
  brierScore: number | null;
  buckets: CalibrationBucket[];
}

const RANGES: [number, number][] = [
  [0, 45],
  [45, 60],
  [60, 75],
  [75, 101],
];

export function calibrate(obs: ReplayObs[]): CalibrationResult {
  const n = obs.length;
  if (n === 0) {
    return { sampleSize: 0, overallHitRate: null, informationCoefficient: null, brierScore: null, buckets: RANGES.map((r) => ({ range: r, n: 0, hitRate: null, avgForwardPct: null })) };
  }

  const overallHitRate = round(obs.filter((o) => o.correct).length / n, 3);

  // Information coefficient: signed conviction vs realized return.
  const conviction = obs.map((o) => (o.dir * o.strength) / 100);
  const realized = obs.map((o) => o.forwardRetPct);
  const ic = pearson(conviction, realized);

  // Brier: treat strength/100 as P(correct); outcome 1/0.
  const brier = round(mean(obs.map((o) => ((o.strength / 100) - (o.correct ? 1 : 0)) ** 2)), 3);

  const buckets: CalibrationBucket[] = RANGES.map((range) => {
    const inBucket = obs.filter((o) => o.strength >= range[0] && o.strength < range[1]);
    return {
      range,
      n: inBucket.length,
      hitRate: inBucket.length ? round(inBucket.filter((o) => o.correct).length / inBucket.length, 3) : null,
      avgForwardPct: inBucket.length ? round(mean(inBucket.map((o) => o.forwardRetPct * o.dir)), 3) : null,
    };
  });

  return { sampleSize: n, overallHitRate, informationCoefficient: ic !== null ? round(ic, 3) : null, brierScore: brier, buckets };
}

/** Hit rate for the bucket matching a given conviction strength. */
export function bucketFor(cal: CalibrationResult, strength: number): CalibrationBucket | null {
  return cal.buckets.find((b) => strength >= b.range[0] && strength < b.range[1]) ?? null;
}
