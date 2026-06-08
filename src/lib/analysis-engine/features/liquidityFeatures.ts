import { sma } from "@/lib/scoring/technicals";
import type { Bar, Quote } from "@/lib/types";
import { REL_VOLUME } from "../core/config";
import { round } from "../core/scoring";
import type { LiquidityClass, LiquidityRead } from "../core/types";

export interface LiquidityInput {
  quote: Quote | null;
  daily: Bar[];
}

export function buildLiquidityRead(input: LiquidityInput): LiquidityRead {
  let relativeVolume: number | null = null;
  if (input.daily.length >= 10) {
    const avg = sma(input.daily.slice(0, -1).map((b) => b.v), Math.min(20, input.daily.length - 1));
    const todayVol = input.quote?.volume ?? input.daily[input.daily.length - 1].v;
    if (avg && todayVol) relativeVolume = round(todayVol / avg, 2);
  }

  let classification: LiquidityClass;
  let score: number;
  if (relativeVolume === null) {
    classification = "Unknown";
    score = 50;
  } else if (relativeVolume >= 0.9) {
    classification = "Healthy";
    score = 80;
  } else if (relativeVolume >= REL_VOLUME.light) {
    classification = "Thin";
    score = 50;
  } else {
    classification = "Risky";
    score = 28;
  }

  const slippageWarning = relativeVolume !== null && relativeVolume < 0.5;
  const degraded = relativeVolume === null;

  const plain =
    classification === "Healthy"
      ? "Trading volume is healthy, so today's move is more trustworthy."
      : classification === "Thin"
      ? "Volume is on the light side, so the move may be a little less reliable."
      : classification === "Risky"
      ? "Volume is very light, so moves can be exaggerated and less reliable."
      : "Volume data isn't available, so liquidity can't be judged right now.";

  return { classification, score, relativeVolume, slippageWarning, plain, degraded };
}
