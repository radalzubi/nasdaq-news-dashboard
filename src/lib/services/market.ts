import {
  CORE_SYMBOLS,
  MEGACAP_SYMBOLS,
  NASDAQ_LEADERS,
  NDX_WEIGHTS,
  PRIMARY_SYMBOL,
  PROVIDER_ORDER,
  SEMI_SYMBOLS,
  SYMBOL_NAMES,
} from "@/lib/config";
import { recordHealth, resolveProviders } from "@/lib/providers";
import type { MarketProvider, RawNewsItem } from "@/lib/providers/types";
import { computeMarketClarity, deriveDirection, deriveMood } from "@/lib/scoring/clarity";
import { clusterNews } from "@/lib/scoring/cluster";
import { scoreNews } from "@/lib/scoring/news";
import { buildQuoteOnlyTechnical, buildTechnicalSummary } from "@/lib/scoring/technicals";
import type {
  Bar,
  DataListEnvelope,
  DataMeta,
  DataStatus,
  EarningsEvent,
  EconomicEvent,
  MarketBrief,
  Mover,
  MoversReport,
  NewsCluster,
  NewsItem,
  Quote,
  TechnicalSummary,
  Timeframe,
  WatchlistItem,
} from "@/lib/types";
import { makeMeta } from "@/lib/types";

/* ----------------------------------------------------------------------------
 * Market service — the single composition layer the API routes call. Handles
 * provider fallback, caching, and turning raw feeds into the derived
 * intelligence (brief, clarity, movers, technical reads).
 * -------------------------------------------------------------------------- */

// ---- Tiny TTL cache --------------------------------------------------------
const CACHE = new Map<string, { value: unknown; expires: number }>();
async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  CACHE.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}
const TTL = { quotes: 15_000, bars: 300_000, news: 45_000, macro: 600_000, earnings: 3_600_000 };

const FIDELITY: Record<DataStatus, number> = { live: 5, delayed: 4, cached: 3, demo: 2, unavailable: 1 };

// ---- Quotes ----------------------------------------------------------------
export interface QuotesResult {
  items: Quote[];
  bySymbol: Record<string, Quote>;
  provenance: Record<string, { source: string; status: DataStatus }>;
  meta: DataMeta;
}

async function fetchQuotes(symbols: string[]): Promise<QuotesResult> {
  const want = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const order = resolveProviders("quotes", PROVIDER_ORDER.quotes);
  const remaining = new Set(want);
  const bySymbol: Record<string, Quote> = {};
  const provenance: Record<string, { source: string; status: DataStatus }> = {};

  for (const p of order) {
    if (remaining.size === 0) break;
    if (!p.getQuotes) continue;
    const env = await safeCall(p, () => p.getQuotes!([...remaining]));
    if (!env) continue;
    for (const q of env.items) {
      if (remaining.has(q.symbol) && q.price !== null) {
        bySymbol[q.symbol] = q;
        provenance[q.symbol] = { source: env.meta.source, status: env.meta.status };
        remaining.delete(q.symbol);
      }
    }
  }

  const items = want.map((s) => bySymbol[s]).filter(Boolean) as Quote[];

  // Overall meta: anchor on QQQ when present; call out any sample-data symbols.
  const anchor = provenance.QQQ ?? Object.values(provenance)[0];
  const demoSyms = Object.entries(provenance).filter(([, p]) => p.status === "demo").map(([s]) => s);
  const realStatuses = Object.values(provenance).map((p) => p.status);
  const allDemo = realStatuses.length > 0 && realStatuses.every((s) => s === "demo");
  const sources = [...new Set(Object.values(provenance).map((p) => p.source))];

  const meta = makeMeta({
    source: sources.join(" + ") || "—",
    status: allDemo ? "demo" : anchor?.status ?? "unavailable",
    note: demoSyms.length && !allDemo ? `Sample data for: ${demoSyms.join(", ")} (no live feed configured).` : undefined,
  });

  return { items, bySymbol, provenance, meta };
}

export function getQuotes(symbols: string[]): Promise<QuotesResult> {
  const key = `quotes:${[...symbols].map((s) => s.toUpperCase()).sort().join(",")}`;
  return memo(key, TTL.quotes, () => fetchQuotes(symbols));
}

/** Convenience: core + leader quotes used by the brief / movers / clarity. */
function dashboardSymbols(): string[] {
  return [...new Set([...CORE_SYMBOLS, ...NASDAQ_LEADERS])];
}

// ---- Bars ------------------------------------------------------------------
export async function getBars(symbol: string, timeframe: Timeframe): Promise<DataListEnvelope<Bar>> {
  const key = `bars:${symbol.toUpperCase()}:${timeframe}`;
  const hit = CACHE.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as DataListEnvelope<Bar>;

  const order = resolveProviders("bars", PROVIDER_ORDER.bars);
  let result: DataListEnvelope<Bar> = { items: [], meta: makeMeta({ source: "—", status: "unavailable", note: "No chart data available." }) };
  for (const p of order) {
    if (!p.getBars) continue;
    const env = await safeCall(p, () => p.getBars!(symbol, timeframe));
    if (env && env.items.length) {
      result = env;
      break;
    }
  }

  // Cache REAL history long (it barely changes intraday); cache sample/unavailable
  // briefly so we keep retrying until a non-throttled window lands.
  const real = result.items.length > 0 && result.meta.status !== "demo" && result.meta.status !== "unavailable";
  const ttl = real ? (timeframe === "1D" ? 2 * 60 * 60_000 : 120_000) : 45_000;
  CACHE.set(key, { value: result, expires: Date.now() + ttl });
  return result;
}

// ---- News ------------------------------------------------------------------
function buildNewsItem(raw: RawNewsItem): NewsItem {
  const scored = scoreNews({
    headline: raw.headline,
    summary: raw.summary,
    source: raw.source,
    publishedAt: raw.publishedAt,
    tickers: raw.tickers,
    sentiment: raw.sentiment ?? null,
  });
  return {
    id: raw.id,
    headline: raw.headline,
    source: raw.source,
    url: raw.url,
    publishedAt: raw.publishedAt,
    tickers: raw.tickers,
    summary: raw.summary ?? undefined,
    whyItMatters: scored.whyItMatters,
    sentiment: scored.sentiment,
    importance: scored.importance,
    relevanceScore: scored.relevanceScore,
    categories: scored.categories,
    affectedAreas: scored.affectedAreas,
    image: raw.image ?? null,
  };
}

export interface NewsResult {
  clusters: NewsCluster[];
  items: NewsItem[];
  meta: DataMeta;
}

export function getNews(tickers: string[] = []): Promise<NewsResult> {
  const key = `news:${tickers.map((t) => t.toUpperCase()).sort().join(",") || "general"}`;
  return memo(key, TTL.news, async () => {
    const order = resolveProviders("news", PROVIDER_ORDER.news);
    for (const p of order) {
      if (!p.getNews) continue;
      const env = await safeCall(p, () => p.getNews!({ tickers }));
      if (env && env.items.length) {
        const items = env.items.map(buildNewsItem).sort((a, b) => b.relevanceScore - a.relevanceScore);
        const clusters = clusterNews(items);
        return { clusters, items, meta: env.meta };
      }
    }
    return { clusters: [], items: [], meta: makeMeta({ source: "—", status: "unavailable", note: "News feed unavailable." }) };
  });
}

// ---- Macro -----------------------------------------------------------------
export function getMacroEvents(): Promise<DataListEnvelope<EconomicEvent>> {
  return memo("macro", TTL.macro, async () => {
    const order = resolveProviders("macro", PROVIDER_ORDER.macro);
    for (const p of order) {
      if (!p.getMacroEvents) continue;
      const env = await safeCall(p, () => p.getMacroEvents!());
      if (env && env.items.length) {
        env.items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        return env;
      }
    }
    return { items: [], meta: makeMeta({ source: "—", status: "unavailable", note: "Economic calendar unavailable." }) };
  });
}

// ---- Earnings --------------------------------------------------------------
export function getEarnings(symbols: string[] = [...NASDAQ_LEADERS]): Promise<DataListEnvelope<EarningsEvent>> {
  const key = `earnings:${symbols.map((s) => s.toUpperCase()).sort().join(",")}`;
  return memo(key, TTL.earnings, async () => {
    const order = resolveProviders("earnings", PROVIDER_ORDER.news);
    for (const p of order) {
      if (!p.getEarnings) continue;
      const env = await safeCall(p, () => p.getEarnings!(symbols));
      if (env && env.items.length) return env;
    }
    return { items: [], meta: makeMeta({ source: "—", status: "unavailable", note: "Earnings calendar unavailable." }) };
  });
}

// ---- Technicals ------------------------------------------------------------
export async function getTechnicalSummary(symbol: string): Promise<{ data: TechnicalSummary | null; meta: DataMeta }> {
  const sym = symbol.toUpperCase();
  const [intraday, daily, quotes] = await Promise.all([
    getBars(sym, "5m"),
    getBars(sym, "1D"),
    getQuotes([sym]),
  ]);
  const quote = quotes.bySymbol[sym] ?? null;
  const quoteStatus = quotes.provenance[sym]?.status;
  const quoteIsReal = Boolean(quote && quoteStatus && quoteStatus !== "demo" && quoteStatus !== "unavailable");
  const barsAreDemo =
    (daily.meta.status === "demo" || daily.items.length === 0) &&
    (intraday.meta.status === "demo" || intraday.items.length === 0);

  if (intraday.items.length === 0 && daily.items.length === 0 && !quote) {
    return { data: null, meta: makeMeta({ source: "—", status: "unavailable", note: "No data to build a technical read." }) };
  }

  // Don't mix a live quote with sample bars — build an honest quote-only read.
  if (quote && quoteIsReal && barsAreDemo) {
    const data = buildQuoteOnlyTechnical(sym, quote);
    return {
      data,
      meta: makeMeta({
        source: quotes.provenance[sym]?.source ?? "—",
        status: quoteStatus!,
        note: "Read built from the live quote — no intraday bar feed configured (VWAP/EMA/RSI unavailable).",
      }),
    };
  }

  const data = buildTechnicalSummary({ symbol: sym, intraday: intraday.items, daily: daily.items, quote });
  // Bars drive most of the read, so report the bars' provenance.
  const barMeta = daily.items.length ? daily.meta : intraday.meta;
  return { data, meta: barMeta };
}

// ---- Movers ----------------------------------------------------------------
function toMover(quote: Quote, clusters: NewsCluster[]): Mover {
  const sym = quote.symbol;
  const weight = NDX_WEIGHTS[sym] ?? 0.5;
  const contribution = (quote.changePct ?? 0) * (weight / 100) * 100; // relative points
  const cluster = clusters.find((c) => c.tickers.includes(sym));
  const driver = cluster
    ? cluster.categories.includes("earnings")
      ? "earnings"
      : cluster.categories.includes("fed") || cluster.categories.includes("inflation")
      ? "macro"
      : "news"
    : "unclear";
  const reason = cluster
    ? `${sym} is ${(quote.changePct ?? 0) >= 0 ? "higher" : "lower"} — ${cluster.headline}`
    : null;
  return {
    symbol: sym,
    name: SYMBOL_NAMES[sym],
    quote,
    contribution: +contribution.toFixed(3),
    driver,
    reason,
    topHeadline: cluster ? { headline: cluster.headline, url: cluster.items[0]?.url ?? "#" } : null,
    unusualVolume: Math.abs(quote.changePct ?? 0) > 2.5,
  };
}

export async function getMovers(): Promise<{ data: MoversReport; meta: DataMeta }> {
  const [quotes, news] = await Promise.all([getQuotes([...NASDAQ_LEADERS]), getNews()]);
  const movers = quotes.items.filter((q) => q.changePct !== null).map((q) => toMover(q, news.clusters));

  const byContribution = [...movers].sort((a, b) => b.contribution - a.contribution);
  const byChange = [...movers].sort((a, b) => (b.quote.changePct ?? 0) - (a.quote.changePct ?? 0));

  const report: MoversReport = {
    topContributors: byContribution.filter((m) => m.contribution > 0).slice(0, 5),
    bottomContributors: byContribution.filter((m) => m.contribution < 0).slice(-5).reverse(),
    gainers: byChange.slice(0, 5),
    losers: byChange.slice(-5).reverse(),
    unusualVolume: movers.filter((m) => m.unusualVolume),
    megacap: movers.filter((m) => (MEGACAP_SYMBOLS as readonly string[]).includes(m.symbol)),
    semis: movers.filter((m) => (SEMI_SYMBOLS as readonly string[]).includes(m.symbol)),
  };
  return { data: report, meta: quotes.meta };
}

// ---- Watchlist -------------------------------------------------------------
export async function getWatchlist(symbols: string[]): Promise<{ items: WatchlistItem[]; meta: DataMeta }> {
  const [quotes, news, earnings] = await Promise.all([getQuotes(symbols), getNews(), getEarnings(symbols)]);
  const items: WatchlistItem[] = symbols.map((raw) => {
    const sym = raw.toUpperCase();
    const quote = quotes.bySymbol[sym] ?? null;
    const cluster = news.clusters.find((c) => c.tickers.includes(sym));
    const earn = earnings.items.find((e) => e.symbol === sym);
    const chg = quote?.changePct ?? null;
    const technicalRead =
      chg === null
        ? null
        : chg > 0.5
        ? "Holding up vs yesterday"
        : chg < -0.5
        ? "Under pressure vs yesterday"
        : "Roughly flat";
    return {
      symbol: sym,
      name: SYMBOL_NAMES[sym],
      quote,
      topHeadline: cluster ? { headline: cluster.headline, url: cluster.items[0]?.url ?? "#", sentiment: cluster.sentiment } : null,
      newsSentiment: cluster?.sentiment ?? null,
      technicalRead,
      volumeStatus: null,
      nextEarnings: earn?.date ?? null,
      relevanceScore: cluster?.relevanceScore ?? null,
    };
  });
  return { items, meta: quotes.meta };
}

// ---- Market Brief + Clarity -----------------------------------------------
export async function getMarketBrief(): Promise<{ data: MarketBrief; meta: DataMeta }> {
  const [quotes, news, macro, qqqTech] = await Promise.all([
    getQuotes(dashboardSymbols()),
    getNews(),
    getMacroEvents(),
    getTechnicalSummary(PRIMARY_SYMBOL),
  ]);

  const dataIssues: string[] = [];
  if (!quotes.bySymbol[PRIMARY_SYMBOL]) dataIssues.push(`${PRIMARY_SYMBOL} quote unavailable`);
  if (news.meta.status === "unavailable") dataIssues.push("News feed unavailable");
  if (quotes.meta.status === "demo") dataIssues.push("Quotes are sample data");

  const clarity = computeMarketClarity({
    news: news.clusters,
    qqqTechnical: qqqTech.data,
    quotes: quotes.bySymbol,
    macroEvents: macro.items,
    dataIssues,
  });

  const mood = deriveMood(clarity, quotes.bySymbol);
  const headlineQuote = quotes.bySymbol[PRIMARY_SYMBOL] ?? quotes.bySymbol.QQQ ?? null;
  const direction = deriveDirection(clarity, headlineQuote?.changePct ?? null);
  const brief: MarketBrief = {
    mood,
    direction,
    summary: clarity.summary,
    clarity,
    reasons: clarity.supporting,
    risks: clarity.risks,
    headlineQuote,
    generatedAt: new Date().toISOString(),
  };

  // Brief is only as fresh as its least-fresh major input.
  const inputs = [quotes.meta, news.meta, qqqTech.meta];
  const worst = inputs.reduce((acc, m) => (FIDELITY[m.status] < FIDELITY[acc.status] ? m : acc), inputs[0]);
  const meta = makeMeta({
    source: [...new Set(inputs.map((m) => m.source))].join(" + "),
    status: worst.status,
    note: dataIssues.length ? dataIssues.join("; ") : undefined,
  });

  return { data: brief, meta };
}

// ---- helpers ---------------------------------------------------------------
async function safeCall<T>(p: MarketProvider, fn: () => Promise<DataListEnvelope<T>>): Promise<DataListEnvelope<T> | null> {
  const t0 = Date.now();
  try {
    const env = await fn();
    recordHealth(p.id, { lastFetchAt: new Date().toISOString(), latencyMs: Date.now() - t0, lastStatus: env.meta.status, lastError: undefined });
    return env;
  } catch (e) {
    recordHealth(p.id, { lastError: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
