import type { Bias } from "../core/types";
import type { NewsImpactReport } from "../core/types";

export interface SentimentRead {
  bias: Bias;
  /** -1..1 net sentiment blended from news + price drift. */
  net: number;
  plain: string;
}

/** Blends news sentiment with the day's price drift into one tone read. */
export function buildSentimentRead(news: NewsImpactReport, primaryChangePct: number | null): SentimentRead {
  const newsVal = news.netSentiment === "bullish" ? 1 : news.netSentiment === "bearish" ? -1 : 0;
  const priceVal = primaryChangePct == null ? 0 : Math.max(-1, Math.min(1, primaryChangePct / 1.5));
  const net = newsVal * 0.6 + priceVal * 0.4;
  const bias: Bias = Math.abs(net) < 0.15 ? (news.netSentiment === "mixed" ? "mixed" : "neutral") : net > 0 ? "bullish" : "bearish";
  const plain =
    bias === "bullish"
      ? "Overall tone is positive, with news and price pointing the same way."
      : bias === "bearish"
      ? "Overall tone is negative, with news and price pointing the same way."
      : "Overall tone is mixed — news and price aren't fully agreeing.";
  return { bias, net, plain };
}
