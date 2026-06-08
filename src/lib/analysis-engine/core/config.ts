import type { ClarityLabel, NewsImpactLabel } from "./types";

/* ============================================================================
 * Engine configuration — all weights and thresholds in one auditable place.
 * ========================================================================== */

/** Clarity blend weights (sum = 1.0). Institutional spec §"Market Clarity Meter". */
export const CLARITY_WEIGHTS = {
  news: 0.25,
  macro: 0.2,
  technicals: 0.175,
  breadth: 0.15,
  volatility: 0.06,
  liquidity: 0.04,
  crossAsset: 0.05,
  dataQuality: 0.075,
} as const;

/** News impact model weights (sum = 1.0). */
export const NEWS_IMPACT_WEIGHTS = {
  recency: 0.2,
  sourceQuality: 0.15,
  nasdaqRelevance: 0.2,
  tickerWeight: 0.15,
  priceReaction: 0.15,
  crossSource: 0.1,
  novelty: 0.05,
} as const;

export const VIX = { calm: 15, elevated: 20, extreme: 30 } as const;
export const RSI = { overbought: 70, oversold: 30 } as const;
export const REL_VOLUME = { heavy: 1.5, light: 0.7 } as const;
export const ATR_PCT = { elevated: 2.0, extreme: 3.0 } as const;

/** Macro event windows (minutes) used by the event-risk model. */
export const EVENT_WINDOW = { imminentMin: 30, justPassedMin: 15, soonMin: 360 } as const;

/** Anomaly z-score thresholds (robust, vs daily history distribution). */
export const ANOMALY_Z = { unusual: 2.0, extreme: 3.0 } as const;

/** Backtest cost assumptions (used for validation context, never promises). */
export const BACKTEST_ASSUMPTIONS = { transactionCostPct: 0.02, slippagePct: 0.03 } as const;
export const BACKTEST_MIN_SAMPLE = { low: 20, moderate: 60 } as const;

/** Data-quality confidence penalty (points off clarity) per problem class. */
export const DQ_PENALTY = { criticalStale: 30, missingNews: 12, missingMacro: 8, missingBreadth: 6, perDelayed: 3 } as const;

export function clarityLabel(score: number): ClarityLabel {
  if (score <= 20) return "Very unclear";
  if (score <= 40) return "Weak signal";
  if (score <= 60) return "Mixed";
  if (score <= 75) return "Reasonably clear";
  if (score <= 90) return "Strong environment";
  return "Very strong, but verify";
}

export function newsImpactLabel(score: number): NewsImpactLabel {
  if (score <= 25) return "low relevance";
  if (score <= 50) return "worth noting";
  if (score <= 75) return "important";
  return "market-moving";
}
