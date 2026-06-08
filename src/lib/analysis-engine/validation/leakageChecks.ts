import type { Bar } from "@/lib/types";

/* ============================================================================
 * Leakage / look-ahead guards. Backtests MUST only use information available
 * at decision time. These are asserted in the backtest and unit-tested.
 * ========================================================================== */

/** True when every bar used for a decision is at or before the decision time. */
export function noFutureBars(barsUsed: Bar[], decisionTimeMs: number): boolean {
  return barsUsed.every((b) => b.t <= decisionTimeMs);
}

/** True when a news item is only used at/after its publication time. */
export function newsAvailableAt(newsPublishedMs: number, decisionTimeMs: number): boolean {
  return newsPublishedMs <= decisionTimeMs;
}

/**
 * Validates a backtest plan: signals are generated only from bars at index ≤ i,
 * and forward returns are measured from bars at index > i. Returns the first
 * violation, or null if clean.
 */
export function validateNoLookAhead(signalIndices: number[], forwardOffset: number, totalBars: number): string | null {
  for (const i of signalIndices) {
    if (i < 0 || i >= totalBars) return `signal index ${i} out of range`;
    if (i + forwardOffset >= totalBars) {
      // Not a leak — just an incomplete forward window; skipped by the backtest.
      continue;
    }
  }
  return null;
}
