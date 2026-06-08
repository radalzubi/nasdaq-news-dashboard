import { clamp } from "../core/scoring";
import type { Bias, NewsImpactReport, Stance } from "../core/types";

/** How CLEAR / directional is the news environment (not direction itself). */
export function newsClarityComponent(report: NewsImpactReport): {
  score: number;
  stance: Stance;
  bias: Bias;
  plain: string;
} {
  const topImpact = report.items[0]?.impactScore ?? 0;
  const mixedShare = report.items.length ? report.items.filter((i) => i.sentiment === "mixed").length / report.items.length : 0;

  let score = 40;
  if (report.netSentiment === "bullish" || report.netSentiment === "bearish") score += 25;
  else if (report.netSentiment === "mixed") score -= 8;
  score += (topImpact / 100) * 25;
  score -= mixedShare * 10;
  score = clamp(score);

  const stance: Stance = report.netSentiment === "bullish" ? "positive" : report.netSentiment === "bearish" ? "negative" : "neutral";
  return { score, stance, bias: report.netSentiment, plain: report.plain };
}
