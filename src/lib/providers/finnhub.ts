import { SYMBOL_NAMES } from "@/lib/config";
import type { DataListEnvelope, EarningsEvent, Quote } from "@/lib/types";
import { makeMeta } from "@/lib/types";
import { fetchJSON, isoDaysAgo, isoToday } from "./http";
import type { MarketProvider, NewsQuery, RawNewsItem } from "./types";

const NAME = "Finnhub";
const BASE = "https://finnhub.io/api/v1";

function key() {
  return process.env.FINNHUB_API_KEY || "";
}

interface FinnhubQuote {
  c: number; d: number | null; dp: number | null; h: number; l: number; o: number; pc: number; t: number;
}
interface FinnhubNews {
  category: string; datetime: number; headline: string; id: number; image: string; related: string; source: string; summary: string; url: string;
}
interface FinnhubEarnings {
  earningsCalendar?: { date: string; epsActual: number | null; epsEstimate: number | null; hour: string; revenueActual: number | null; revenueEstimate: number | null; symbol: string }[];
}

export const finnhubProvider: MarketProvider = {
  id: "finnhub",
  name: NAME,
  capabilities: { quotes: true, news: true, earnings: true },
  isConfigured: () => Boolean(key()),

  async getQuotes(symbols): Promise<DataListEnvelope<Quote>> {
    const fetchedAt = new Date().toISOString();
    const results = await Promise.all(
      symbols.map(async (raw) => {
        const symbol = raw.toUpperCase();
        const data = await fetchJSON<FinnhubQuote>(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${key()}`);
        if (!data || (data.c === 0 && data.pc === 0)) return null;
        const quote: Quote = {
          symbol,
          name: SYMBOL_NAMES[symbol],
          price: data.c ?? null,
          change: data.d ?? null,
          changePct: data.dp ?? null,
          prevClose: data.pc ?? null,
          open: data.o ?? null,
          dayHigh: data.h ?? null,
          dayLow: data.l ?? null,
          volume: null, // not provided by the free /quote endpoint
          session: "regular",
          asOf: data.t ? new Date(data.t * 1000).toISOString() : fetchedAt,
        };
        return quote;
      }),
    );
    const items = results.filter((q): q is Quote => q !== null);
    return {
      items,
      meta: makeMeta({
        source: NAME,
        status: items.length ? "live" : "unavailable",
        note: items.length ? "Real-time US equity quotes (volume not included on this endpoint)." : "No quotes returned — index symbols (VIX, TNX) may be unavailable on Finnhub.",
      }),
    };
  },

  async getNews(query: NewsQuery): Promise<DataListEnvelope<RawNewsItem>> {
    let raw: FinnhubNews[] | null = null;
    if (query.tickers?.length) {
      const from = isoDaysAgo(5);
      const to = isoToday();
      const lists = await Promise.all(
        query.tickers.slice(0, 12).map((t) =>
          fetchJSON<FinnhubNews[]>(`${BASE}/company-news?symbol=${encodeURIComponent(t.toUpperCase())}&from=${from}&to=${to}&token=${key()}`),
        ),
      );
      raw = lists.flatMap((l) => l ?? []);
    } else {
      raw = await fetchJSON<FinnhubNews[]>(`${BASE}/news?category=general&token=${key()}`);
    }
    if (!raw) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "News feed unavailable." }) };
    }
    const items: RawNewsItem[] = raw
      .filter((n) => n.headline && n.url)
      .map((n) => ({
        id: `fh-${n.id}`,
        headline: n.headline,
        source: n.source || NAME,
        url: n.url,
        publishedAt: new Date((n.datetime || 0) * 1000).toISOString(),
        tickers: (n.related || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
        summary: n.summary || null,
        image: n.image || null,
      }));
    if (query.limit) items.splice(query.limit);
    return { items, meta: makeMeta({ source: NAME, status: "live", note: "Market + company news." }) };
  },

  async getEarnings(symbols): Promise<DataListEnvelope<EarningsEvent>> {
    const from = isoToday();
    const to = isoDaysAgo(-45); // 45 days forward
    const data = await fetchJSON<FinnhubEarnings>(`${BASE}/calendar/earnings?from=${from}&to=${to}&token=${key()}`);
    if (!data?.earningsCalendar) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "Earnings calendar unavailable." }) };
    }
    const want = new Set(symbols.map((s) => s.toUpperCase()));
    const items: EarningsEvent[] = data.earningsCalendar
      .filter((e) => !symbols.length || want.has(e.symbol.toUpperCase()))
      .map((e) => ({
        symbol: e.symbol.toUpperCase(),
        name: SYMBOL_NAMES[e.symbol.toUpperCase()],
        date: e.date,
        hour: (["bmo", "amc", "dmh"].includes(e.hour) ? e.hour : null) as EarningsEvent["hour"],
        epsEstimate: e.epsEstimate,
        epsActual: e.epsActual,
        revenueEstimate: e.revenueEstimate,
        revenueActual: e.revenueActual,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { items, meta: makeMeta({ source: NAME, status: "live", note: "Upcoming earnings (next ~45 days)." }) };
  },
};
