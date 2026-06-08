/* ============================================================================
 * Shared statistical helpers for the engine. Pure, dependency-free, testable.
 * ========================================================================== */

export function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation (robust spread). */
export function mad(xs: number[]): number {
  if (!xs.length) return 0;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/** Robust z-score using median + MAD (falls back to mean/std). */
export function robustZ(value: number, sample: number[]): number {
  if (sample.length < 3) return 0;
  const m = median(sample);
  const d = mad(sample);
  if (d > 1e-9) return (value - m) / (1.4826 * d);
  const sd = std(sample);
  return sd > 1e-9 ? (value - mean(sample)) / sd : 0;
}

/** Percentile rank (0–1) of value within sample. */
export function percentileRank(value: number, sample: number[]): number {
  if (!sample.length) return 0.5;
  const below = sample.filter((x) => x <= value).length;
  return below / sample.length;
}

export function round(v: number, n = 2): number {
  const f = 10 ** n;
  return Math.round(v * f) / f;
}

/** Map a signed value in [-1,1] to a 0–100 clarity-style score around 50. */
export function signedToScore(signed: number, spread = 50): number {
  return clamp(50 + signed * spread);
}

/** Pearson correlation between two equal-length series. Null if degenerate. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den > 1e-9 ? num / den : null;
}
