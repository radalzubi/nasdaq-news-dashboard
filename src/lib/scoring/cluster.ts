import type { NewsCluster, NewsItem, Sentiment } from "@/lib/types";

/* ----------------------------------------------------------------------------
 * News clustering / dedup.
 *
 * Many providers surface the same story from a dozen outlets. We group near-
 * duplicate headlines so the feed shows one card per story, with a source count
 * — "prioritize quality over quantity".
 * -------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "as", "at", "by",
  "is", "are", "be", "after", "amid", "over", "from", "its", "it", "this", "that", "new",
  "says", "say", "said", "report", "reports", "could", "will", "has", "have", "up", "down",
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Two items are the "same story" if headlines overlap a lot, or overlap a bit AND share a ticker. */
export function isSameStory(a: NewsItem, b: NewsItem, threshold = 0.5): boolean {
  const sim = jaccard(tokenize(a.headline), tokenize(b.headline));
  if (sim >= threshold) return true;
  const sharesTicker = a.tickers.some((t) => b.tickers.includes(t));
  return sharesTicker && sim >= 0.32;
}

function dominantSentiment(items: NewsItem[]): Sentiment {
  const counts: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  for (const it of items) counts[it.sentiment]++;
  if (counts.positive > 0 && counts.negative > 0) return "mixed";
  const entries = Object.entries(counts) as [Sentiment, number][];
  entries.sort((x, y) => y[1] - x[1]);
  return entries[0][0];
}

/** Cluster a list of scored news items. Output is sorted by relevance, descending. */
export function clusterNews(items: NewsItem[]): NewsCluster[] {
  const clusters: NewsItem[][] = [];

  // Process most-relevant first so the representative tends to be the strongest item.
  const sorted = [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);

  for (const item of sorted) {
    const target = clusters.find((group) => group.some((g) => isSameStory(g, item)));
    if (target) target.push(item);
    else clusters.push([item]);
  }

  const result: NewsCluster[] = clusters.map((group) => {
    const rep = group[0]; // highest relevance (sorted)
    const sources = [...new Set(group.map((g) => g.source))];
    const tickers = [...new Set(group.flatMap((g) => g.tickers))];
    const categories = [...new Set(group.flatMap((g) => g.categories))];
    const affectedAreas = [...new Set(group.flatMap((g) => g.affectedAreas))];
    const times = group.map((g) => new Date(g.publishedAt).getTime()).filter((t) => !Number.isNaN(t));
    const firstSeen = times.length ? new Date(Math.min(...times)).toISOString() : rep.publishedAt;
    const lastSeen = times.length ? new Date(Math.max(...times)).toISOString() : rep.publishedAt;

    // Multi-source corroboration nudges relevance up (capped).
    const corroboration = Math.min(8, (sources.length - 1) * 2);
    const relevanceScore = Math.min(100, rep.relevanceScore + corroboration);

    return {
      id: rep.id,
      headline: rep.headline,
      summary: rep.summary,
      whyItMatters: rep.whyItMatters,
      sentiment: dominantSentiment(group),
      importance: rep.importance,
      relevanceScore,
      tickers,
      categories,
      affectedAreas,
      sources,
      articleCount: group.length,
      items: group,
      firstSeen,
      lastSeen,
    };
  });

  return result.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
