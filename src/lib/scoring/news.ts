import {
  CATEGORY_KEYWORDS,
  CATEGORY_WHY,
  MEGACAP_SYMBOLS,
  SEMI_SYMBOLS,
  sourceCredibility,
  tickerInfluence,
} from "@/lib/config";
import type { AffectedArea, Importance, NewsCategory, Sentiment } from "@/lib/types";
import { clamp } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * News relevance scoring.
 *
 * Produces a 0–100 score expressing how much a headline should matter to a
 * Nasdaq / QQQ trader, plus a classification (categories, affected areas,
 * sentiment) and a plain-English "why it matters". All inputs are facts we
 * already have (headline text, source, time, tickers) — we never invent data.
 * -------------------------------------------------------------------------- */

export interface ScoreNewsInput {
  headline: string;
  summary?: string | null;
  source: string;
  publishedAt: string;
  tickers?: string[];
  /** Provider-supplied sentiment, if any. */
  sentiment?: Sentiment | null;
  /** Distinct sources reporting the same story (for clusters). */
  sourceCount?: number;
  /** Whether the related price is visibly reacting. */
  priceReacting?: boolean;
  now?: number;
}

export interface ScoredNews {
  relevanceScore: number;
  importance: Importance;
  categories: NewsCategory[];
  affectedAreas: AffectedArea[];
  sentiment: Sentiment;
  whyItMatters: string;
}

const POSITIVE_WORDS = [
  "beat", "beats", "surge", "surges", "soar", "soars", "jump", "jumps", "rally", "rallies",
  "rise", "rises", "gain", "gains", "upgrade", "upgrades", "raises", "raised", "record",
  "strong", "stronger", "growth", "optimistic", "boost", "boosts", "tops", "outperform",
  "bullish", "rebound", "recovers", "recovery", "approval", "approved", "wins", "expands",
];
const NEGATIVE_WORDS = [
  "miss", "misses", "plunge", "plunges", "slump", "slumps", "fall", "falls", "drop", "drops",
  "decline", "declines", "downgrade", "downgrades", "cuts", "cut", "warns", "warning", "weak",
  "weaker", "slow", "slowdown", "fears", "concern", "concerns", "lawsuit", "probe", "recall",
  "bearish", "selloff", "sell-off", "tumble", "tumbles", "loss", "losses", "layoff", "layoffs",
  "disappoint", "disappoints", "sinks", "slides", "crash",
];

/** Lexicon-based fallback sentiment for when the provider gives none. */
export function lexiconSentiment(text: string): Sentiment {
  const t = ` ${text.toLowerCase()} `;
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_WORDS) if (t.includes(` ${w} `) || t.includes(` ${w}`)) pos++;
  for (const w of NEGATIVE_WORDS) if (t.includes(` ${w} `) || t.includes(` ${w}`)) neg++;
  if (pos === 0 && neg === 0) return "neutral";
  if (pos > 0 && neg > 0 && Math.abs(pos - neg) <= 1) return "mixed";
  return pos > neg ? "positive" : "negative";
}

const KEYWORD_RE = new Map<string, RegExp>();
function keywordRegex(keyword: string): RegExp {
  let re = KEYWORD_RE.get(keyword);
  if (!re) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`\\b${escaped}\\b`, "i");
    KEYWORD_RE.set(keyword, re);
  }
  return re;
}

/** Classify a headline into Nasdaq-relevant categories (word-boundary aware). */
export function classifyCategories(text: string, tickers: string[] = []): NewsCategory[] {
  const found = new Set<NewsCategory>();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => keywordRegex(k).test(text))) found.add(category as NewsCategory);
  }

  // Ticker-driven classification.
  const up = tickers.map((s) => s.toUpperCase());
  if (up.some((s) => (SEMI_SYMBOLS as readonly string[]).includes(s))) found.add("semis");
  if (up.some((s) => (MEGACAP_SYMBOLS as readonly string[]).includes(s))) found.add("megacap");
  if (up.includes("QQQ") || up.includes("NDX")) found.add("nasdaq");

  if (found.size === 0) found.add("general");
  return [...found];
}

/** Map categories + tickers to the "likely affected areas". */
export function deriveAffectedAreas(categories: NewsCategory[], tickers: string[] = []): AffectedArea[] {
  const areas = new Set<AffectedArea>();
  const has = (c: NewsCategory) => categories.includes(c);

  if (has("semis")) {
    areas.add("Semiconductors");
    areas.add("QQQ");
  }
  if (has("ai")) {
    areas.add("Semiconductors");
    areas.add("Mega-cap tech");
    areas.add("Growth stocks");
    areas.add("QQQ");
  }
  if (has("megacap")) {
    areas.add("Mega-cap tech");
    areas.add("QQQ");
  }
  if (has("fed") || has("yields") || has("inflation")) {
    areas.add("Yields-sensitive");
    areas.add("Growth stocks");
    areas.add("Risk appetite");
    areas.add("QQQ");
  }
  if (has("jobs")) {
    areas.add("Risk appetite");
    areas.add("Yields-sensitive");
  }
  if (has("geopolitical")) areas.add("Risk appetite");
  if (has("nasdaq")) areas.add("QQQ");
  if (has("earnings")) {
    areas.add("Growth stocks");
    if (tickers.some((s) => (MEGACAP_SYMBOLS as readonly string[]).includes(s.toUpperCase()))) areas.add("QQQ");
  }

  if (areas.size === 0) areas.add("Risk appetite");
  return [...areas];
}

/** Recency: 1.0 within 15 minutes, exponential decay with ~3h half-life. */
export function recencyScore(publishedAt: string, now = Date.now()): number {
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return 0.3;
  const ageMin = Math.max(0, (now - t) / 60000);
  if (ageMin <= 15) return 1;
  const halfLifeMin = 180;
  return clamp(Math.pow(0.5, (ageMin - 15) / halfLifeMin), 0, 1);
}

export function importanceFromScore(score: number): Importance {
  if (score >= 80) return "market-moving";
  if (score >= 62) return "high";
  if (score >= 42) return "medium";
  return "low";
}

/** Weights for the relevance signals (sum to 1.0). */
export const NEWS_WEIGHTS = {
  credibility: 0.18,
  recency: 0.18,
  tickerImportance: 0.18,
  nasdaqRelevance: 0.14,
  megacapImpact: 0.1,
  ratesFed: 0.1,
  earnings: 0.05,
  multiSource: 0.04,
  priceReacting: 0.03,
} as const;

export function scoreNews(input: ScoreNewsInput): ScoredNews {
  const now = input.now ?? Date.now();
  const tickers = (input.tickers ?? []).map((s) => s.toUpperCase());
  const text = `${input.headline} ${input.summary ?? ""}`;
  const categories = classifyCategories(text, tickers);
  const affectedAreas = deriveAffectedAreas(categories, tickers);

  const credibility = sourceCredibility(input.source);
  const recency = recencyScore(input.publishedAt, now);
  const tickerImportance = tickers.length ? Math.max(...tickers.map(tickerInfluence)) : 0.2;

  const nasdaqCats: NewsCategory[] = ["nasdaq", "semis", "ai", "megacap", "fed", "yields", "inflation"];
  const nasdaqRelevance = categories.some((c) => nasdaqCats.includes(c)) ? 1 : 0.3;

  const megacapImpact =
    categories.includes("megacap") || categories.includes("semis")
      ? 1
      : tickers.some((s) => (MEGACAP_SYMBOLS as readonly string[]).includes(s))
      ? 0.8
      : 0.2;

  const ratesFed = ["fed", "yields", "inflation", "jobs"].some((c) => categories.includes(c as NewsCategory)) ? 1 : 0;
  const earnings = categories.includes("earnings") ? 1 : 0;
  const multiSource = clamp(((input.sourceCount ?? 1) - 1) / 3, 0, 1);
  const priceReacting = input.priceReacting ? 1 : 0;

  const w = NEWS_WEIGHTS;
  const raw =
    credibility * w.credibility +
    recency * w.recency +
    tickerImportance * w.tickerImportance +
    nasdaqRelevance * w.nasdaqRelevance +
    megacapImpact * w.megacapImpact +
    ratesFed * w.ratesFed +
    earnings * w.earnings +
    multiSource * w.multiSource +
    priceReacting * w.priceReacting;

  const relevanceScore = Math.round(clamp(raw * 100, 0, 100));
  const importance = importanceFromScore(relevanceScore);
  const sentiment = input.sentiment ?? lexiconSentiment(text);

  // Choose the "why it matters" from the most market-relevant category present.
  const priority: NewsCategory[] = ["fed", "inflation", "yields", "semis", "ai", "megacap", "earnings", "jobs", "nasdaq", "geopolitical"];
  const topCat = priority.find((c) => categories.includes(c)) ?? "nasdaq";
  const whyItMatters = CATEGORY_WHY[topCat] ?? CATEGORY_WHY.nasdaq;

  return { relevanceScore, importance, categories, affectedAreas, sentiment, whyItMatters };
}
