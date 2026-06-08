import { sourceCredibility, tickerInfluence } from "@/lib/config";
import type { NewsCategory, NewsCluster, Quote, Sentiment } from "@/lib/types";
import { NEWS_IMPACT_WEIGHTS, newsImpactLabel } from "../core/config";
import { clamp } from "../core/scoring";
import type { Bias, NewsImpactItem, NewsImpactReport } from "../core/types";

const THEME: Partial<Record<NewsCategory, string>> = {
  megacap: "Mega-cap tech",
  semis: "Semiconductors",
  ai: "AI",
  fed: "Fed expectations",
  inflation: "Rates-sensitive",
  yields: "Rates-sensitive",
  jobs: "Economy",
  earnings: "Earnings",
  nasdaq: "Nasdaq / risk appetite",
  geopolitical: "Risk appetite",
};

const NASDAQ_CATS: NewsCategory[] = ["nasdaq", "semis", "ai", "megacap", "fed", "yields", "inflation"];

export interface NewsFeaturesInput {
  clusters: NewsCluster[];
  quotes: Record<string, Quote | null>;
  /** Change% of the headline index, for market-wide stories with no tickers. */
  primaryChangePct: number | null;
  now?: number;
}

/** Did price confirm the story? Returns true/false, or null if we can't tell. */
function priceReaction(cluster: NewsCluster, quotes: Record<string, Quote | null>, primaryChangePct: number | null): boolean | null {
  const moves = cluster.tickers.map((t) => quotes[t]?.changePct).filter((x): x is number => x != null);
  const ref = moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : primaryChangePct;
  if (ref == null) return null;
  if (Math.abs(ref) < 0.3) return null; // not really reacting
  if (cluster.sentiment === "positive") return ref > 0;
  if (cluster.sentiment === "negative") return ref < 0;
  return null; // neutral/mixed sentiment — direction not meaningful
}

export function buildNewsImpact(input: NewsFeaturesInput): NewsImpactReport {
  const now = input.now ?? Date.now();
  const w = NEWS_IMPACT_WEIGHTS;

  const items: NewsImpactItem[] = input.clusters.map((c) => {
    const ageMin = Math.max(0, (now - new Date(c.lastSeen).getTime()) / 60000);
    const firstAgeMin = Math.max(0, (now - new Date(c.firstSeen).getTime()) / 60000);

    const recency = ageMin <= 15 ? 1 : Math.pow(0.5, (ageMin - 15) / 180);
    const srcQuality = c.sources.length ? Math.max(...c.sources.map(sourceCredibility)) : 0.5;
    const nasdaqRel = c.categories.some((x) => NASDAQ_CATS.includes(x)) ? 1 : 0.3;
    const tickerW = c.tickers.length ? Math.max(...c.tickers.map(tickerInfluence)) : 0.2;
    const confirming = priceReaction(c, input.quotes, input.primaryChangePct);
    const priceReact = confirming === true ? 1 : confirming === false ? 0.2 : 0.5;
    const crossSource = clamp((c.sources.length - 1) / 3, 0, 1);
    const novelty = firstAgeMin <= 30 ? 1 : Math.pow(0.5, (firstAgeMin - 30) / 240);

    const impactScore = Math.round(
      clamp(
        (recency * w.recency +
          srcQuality * w.sourceQuality +
          nasdaqRel * w.nasdaqRelevance +
          tickerW * w.tickerWeight +
          priceReact * w.priceReaction +
          crossSource * w.crossSource +
          novelty * w.novelty) *
          100,
      ),
    );

    const themes = [...new Set(c.categories.map((cat) => THEME[cat]).filter((x): x is string => !!x))];
    const why = c.whyItMatters && c.whyItMatters.trim().length > 0 ? c.whyItMatters : "Impact unclear from available data.";

    return {
      id: c.id,
      headline: c.headline,
      summary: c.summary,
      whyItMatters: why,
      tickers: c.tickers,
      theme: themes,
      sentiment: c.sentiment,
      impactScore,
      impactLabel: newsImpactLabel(impactScore),
      priceConfirming: confirming,
      stale: ageMin > 180,
      clustered: c.articleCount > 1,
      sources: c.sources,
      ageMinutes: Math.round(ageMin),
    };
  });

  items.sort((a, b) => b.impactScore - a.impactScore);

  // Net sentiment weighted by impact.
  const sentVal = (s: Sentiment) => (s === "positive" ? 1 : s === "negative" ? -1 : 0);
  const totalW = items.reduce((a, i) => a + i.impactScore, 0) || 1;
  const net = items.reduce((a, i) => a + i.impactScore * sentVal(i.sentiment), 0) / totalW;
  const mixedShare = items.length ? items.filter((i) => i.sentiment === "mixed").length / items.length : 0;
  const netSentiment: Bias = items.length === 0 ? "neutral" : Math.abs(net) < 0.12 || mixedShare > 0.5 ? "mixed" : net > 0 ? "bullish" : "bearish";

  const themeCounts = new Map<string, number>();
  for (const i of items.slice(0, 8)) for (const t of i.theme) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
  const topThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 3);

  const plain = buildPlain(items, netSentiment, topThemes);
  return { items, netSentiment, topThemes, plain };
}

function buildPlain(items: NewsImpactItem[], net: Bias, themes: string[]): string {
  if (items.length === 0) return "It's quiet — no notable Nasdaq-100 news right now.";
  const topImpact = items.filter((i) => i.impactScore >= 51).length;
  const themeStr = themes.length ? ` mostly around ${themes.join(", ").toLowerCase()}` : "";
  if (net === "bullish") return `The most important headlines${themeStr} are leaning good for stocks today.`;
  if (net === "bearish") return `The most important headlines${themeStr} are leaning bad for stocks today.`;
  if (topImpact === 0) return "Today's news is fairly minor for the Nasdaq-100 so far.";
  return `Today's headlines${themeStr} point in different directions.`;
}
