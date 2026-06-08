import { sma } from "@/lib/scoring/technicals";
import type { Bar } from "@/lib/types";
import { clamp } from "../core/scoring";

/* ============================================================================
 * Signal replay — walk the engine's directional logic across history with NO
 * look-ahead, recording (lean, strength, forward outcome) for calibration.
 *
 * Limited to the price-based part of the read (the only component with usable
 * daily history). The live engine also weighs news/breadth/macro, so this is
 * calibration *context*, not the full engine's track record.
 * ========================================================================== */

export interface ReplayObs {
  /** Predicted lean: +1 bullish, -1 bearish. */
  dir: 1 | -1;
  /** Conviction strength 0–100 at signal time. */
  strength: number;
  /** Realized next-session return %. */
  forwardRetPct: number;
  /** Did the next session move in the predicted direction? */
  correct: boolean;
}

export function replayDirectional(daily: Bar[]): ReplayObs[] {
  const closes = daily.map((b) => b.c);
  const obs: ReplayObs[] = [];
  const minHistory = 55;

  for (let i = minHistory; i < closes.length - 1; i++) {
    const hist = closes.slice(0, i + 1); // PAST + current only
    const smaFast = sma(hist, 10);
    const smaSlow = sma(hist, 50);
    if (smaFast === null || smaSlow === null || hist[i - 5] === undefined) continue;

    const mom5 = ((closes[i] - closes[i - 5]) / closes[i - 5]) * 100;
    const mom20 = closes[i - 20] !== undefined ? ((closes[i] - closes[i - 20]) / closes[i - 20]) * 100 : 0;
    const trendUp = smaFast > smaSlow;

    // A directional lean only fires when trend and momentum agree.
    let dir: 1 | -1 | 0 = 0;
    if (trendUp && mom5 > 0) dir = 1;
    else if (!trendUp && mom5 < 0) dir = -1;
    if (dir === 0) continue;

    const strength = clamp(40 + Math.min(Math.abs(mom5), 4) * 8 + Math.min(Math.abs(mom20), 8) * 1.5);
    const forwardRetPct = ((closes[i + 1] - closes[i]) / closes[i]) * 100;
    const correct = Math.sign(forwardRetPct) === dir;
    obs.push({ dir, strength, forwardRetPct, correct });
  }
  return obs;
}
