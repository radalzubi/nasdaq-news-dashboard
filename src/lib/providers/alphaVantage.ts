import { SYMBOL_NAMES } from "@/lib/config";
import type { Bar, DataListEnvelope, Quote, Sentiment, Timeframe } from "@/lib/types";
import { makeMeta } from "@/lib/types";
import { fetchJSON } from "./http";
import type { MarketProvider, NewsQuery, RawNewsItem } from "./types";

const NAME = "Alpha Vantage";
const BASE = "https://www.alphavantage.co/query";

function key() {
  return process.env.ALPHA_VANTAGE_API_KEY || "";
}

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const n = parseFloat(String(s).replace("%", ""));
  return Number.isNaN(n) ? null : n;
};

function avInterval(tf: Timeframe): string | null {
  switch (tf) {
    case "1m": return "1min";
    case "5m": return "5min";
    case "15m": return "15min";
    case "1h": return "60min";
    default: return null; // daily handled separately
  }
}

function mapSentiment(label?: string): Sentiment | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes("bull")) return "positive";
  if (l.includes("bear")) return "negative";
  if (l.includes("neutral")) return "neutral";
  return null;
}

/** Parse Alpha Vantage's "20240101T123000" timestamps. */
function parseAvTime(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, se] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}Z`).toISOString();
}

export const alphaVantageProvider: MarketProvider = {
  id: "alphaVantage",
  name: NAME,
  capabilities: { quotes: true, bars: true, news: true },
  isConfigured: () => Boolean(key()),

  async getQuotes(symbols): Promise<DataListEnvelope<Quote>> {
    // Alpha Vantage free tier is rate-limited (about 25 requests/day); fetch
    // sequentially and stop labeling fresh once we hit a throttle note.
    const items: Quote[] = [];
    let throttled = false;
    for (const raw of symbols) {
      const symbol = raw.toUpperCase();
      const data = await fetchJSON<Record<string, Record<string, string>>>(
        `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key()}`,
      );
      const gq = data?.["Global Quote"];
      if (!gq || !gq["05. price"]) {
        if (data && (("Note" in data) || ("Information" in data))) throttled = true;
        continue;
      }
      items.push({
        symbol,
        name: SYMBOL_NAMES[symbol],
        price: num(gq["05. price"]),
        change: num(gq["09. change"]),
        changePct: num(gq["10. change percent"]),
        prevClose: num(gq["08. previous close"]),
        open: num(gq["02. open"]),
        dayHigh: num(gq["03. high"]),
        dayLow: num(gq["04. low"]),
        volume: num(gq["06. volume"]),
        session: "regular",
        asOf: gq["07. latest trading day"] ? `${gq["07. latest trading day"]}T20:00:00Z` : new Date().toISOString(),
      });
    }
    return {
      items,
      meta: makeMeta({
        source: NAME,
        status: items.length ? "delayed" : "unavailable",
        note: throttled
          ? "Alpha Vantage rate limit reached — some symbols skipped."
          : items.length ? "End-of-day / delayed quotes." : "No quotes returned.",
      }),
    };
  },

  async getBars(symbol, timeframe): Promise<DataListEnvelope<Bar>> {
    const sym = symbol.toUpperCase();
    const interval = avInterval(timeframe);
    // Reserve the free-tier quota (≈25/day) for DAILY history, which powers the
    // calibration + longer-term context. Intraday would blow the quota, so we
    // leave it to Yahoo / quote-only reads.
    if (interval) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "Alpha Vantage is reserved for daily history (free-tier quota)." }) };
    }
    const url =
      interval
        ? `${BASE}?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=full&apikey=${key()}`
        : `${BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(sym)}&outputsize=full&apikey=${key()}`;
    const data = await fetchJSON<Record<string, unknown>>(url);
    const seriesKey = Object.keys(data ?? {}).find((k) => k.startsWith("Time Series"));
    if (!data || !seriesKey) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "Bars unavailable (or rate limited)." }) };
    }
    const series = data[seriesKey] as Record<string, Record<string, string>>;
    const items: Bar[] = Object.entries(series)
      .map(([ts, v]) => ({
        t: new Date(interval ? `${ts.replace(" ", "T")}` : `${ts}T20:00:00Z`).getTime(),
        o: num(v["1. open"]) ?? 0,
        h: num(v["2. high"]) ?? 0,
        l: num(v["3. low"]) ?? 0,
        c: num(v["4. close"]) ?? 0,
        v: num(v["5. volume"]) ?? 0,
      }))
      .sort((a, b) => a.t - b.t);
    return { items, meta: makeMeta({ source: NAME, status: "delayed", note: "Historical bars." }) };
  },

  async getNews(query: NewsQuery): Promise<DataListEnvelope<RawNewsItem>> {
    const tickers = query.tickers?.length ? query.tickers.map((t) => t.toUpperCase()).join(",") : "";
    const url = tickers
      ? `${BASE}?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(tickers)}&sort=LATEST&limit=50&apikey=${key()}`
      : `${BASE}?function=NEWS_SENTIMENT&topics=technology,economy_macro,finance&sort=LATEST&limit=50&apikey=${key()}`;
    const data = await fetchJSON<{ feed?: Record<string, unknown>[] }>(url);
    if (!data?.feed) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "News feed unavailable (or rate limited)." }) };
    }
    const items: RawNewsItem[] = data.feed.map((f, i) => {
      const tickerSentiment = (f.ticker_sentiment as { ticker: string }[] | undefined) ?? [];
      return {
        id: `av-${i}-${String(f.url).slice(-12)}`,
        headline: String(f.title ?? ""),
        source: String(f.source ?? NAME),
        url: String(f.url ?? ""),
        publishedAt: parseAvTime(String(f.time_published ?? "")),
        tickers: tickerSentiment.map((t) => t.ticker?.toUpperCase()).filter(Boolean),
        summary: f.summary ? String(f.summary) : null,
        sentiment: mapSentiment(f.overall_sentiment_label as string | undefined),
        image: f.banner_image ? String(f.banner_image) : null,
      };
    }).filter((n) => n.headline && n.url);
    return { items, meta: makeMeta({ source: NAME, status: "delayed", note: "News with provider sentiment." }) };
  },
};
