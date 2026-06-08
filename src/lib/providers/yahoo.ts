import { SYMBOL_NAMES } from "@/lib/config";
import type { Bar, DataListEnvelope, Quote, Timeframe } from "@/lib/types";
import { makeMeta } from "@/lib/types";
import { round } from "@/lib/utils";
import type { MarketProvider } from "./types";

/* ----------------------------------------------------------------------------
 * Yahoo Finance provider (unofficial public chart endpoint, no API key).
 *
 * The one free source for the real Nasdaq-100 INDEX (^NDX), VIX (^VIX), the
 * 10-year yield (^TNX), and intraday/daily bars. Yahoo rate-limits server-side
 * polling aggressively (HTTP 429), so this provider is deliberately resilient:
 *   - bootstraps a session cookie (lifts limits when the IP isn't throttled),
 *   - serves last-known values (status "cached") during a 429 cooldown,
 *   - never throws — callers fall back to the next provider / demo.
 * -------------------------------------------------------------------------- */

const NAME = "Yahoo Finance";
const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const YF_MAP: Record<string, string> = { NDX: "^NDX", IXIC: "^IXIC", VIX: "^VIX", TNX: "^TNX", SPX: "^GSPC", DXY: "DX-Y.NYB", GOLD: "GC=F", RUT: "^RUT" };
const toYahoo = (s: string) => YF_MAP[s] ?? s;

// ---- Resilience state (module-level) --------------------------------------
let cookie: string | null = null;
let cookieAt = 0;
let cooldownUntil = 0; // quotes cooldown (batch fetches get throttled)
let barsCooldownUntil = 0; // bars have their own cooldown — a quotes 429 shouldn't block a single cached bar request
const lastGood = new Map<string, Quote>();

async function ensureCookie(): Promise<void> {
  if (cookie && Date.now() - cookieAt < 3_600_000) return;
  try {
    const r = await fetch("https://fc.yahoo.com/", { headers: UA });
    const setC = (r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    const c = setC.map((x) => x.split(";")[0]).join("; ");
    if (c) {
      cookie = c;
      cookieAt = Date.now();
    }
  } catch {
    /* best-effort */
  }
}

/** Fetch JSON from Yahoo; returns { data, rateLimited }. Never throws. */
async function yfetch(path: string): Promise<{ data: YahooChart | null; rateLimited: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const headers: Record<string, string> = { ...UA };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(path, { headers, signal: controller.signal, cache: "no-store" });
    if (res.status === 429) return { data: null, rateLimited: true };
    if (!res.ok) return { data: null, rateLimited: false };
    return { data: (await res.json()) as YahooChart, rateLimited: false };
  } catch {
    return { data: null, rateLimited: false };
  } finally {
    clearTimeout(timer);
  }
}

interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
}
interface YahooChart {
  chart?: {
    result?: {
      meta?: YahooMeta;
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
    }[];
  };
}

function tfParams(tf: Timeframe): { interval: string; range: string } {
  switch (tf) {
    case "1m": return { interval: "1m", range: "1d" };
    case "5m": return { interval: "5m", range: "1d" };
    case "15m": return { interval: "15m", range: "5d" };
    case "1h": return { interval: "60m", range: "1mo" };
    default: return { interval: "1d", range: "1y" };
  }
}

function metaToQuote(symbol: string, meta: YahooMeta): Quote | null {
  if (meta.regularMarketPrice == null) return null;
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change = prevClose != null ? price - prevClose : null;
  const changePct = prevClose ? (change! / prevClose) * 100 : null;
  return {
    symbol,
    name: SYMBOL_NAMES[symbol],
    price: round(price, 2),
    change: change != null ? round(change, 2) : null,
    changePct: changePct != null ? round(changePct, 2) : null,
    prevClose: prevClose != null ? round(prevClose, 2) : null,
    open: meta.regularMarketOpen ?? null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    session: "regular",
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
  };
}

export const yahooProvider: MarketProvider = {
  id: "yahoo",
  name: NAME,
  capabilities: { quotes: true, bars: true },
  isConfigured: () => true,

  async getQuotes(symbols): Promise<DataListEnvelope<Quote>> {
    const wanted = symbols.map((s) => s.toUpperCase());

    // In cooldown: serve last-known values only, clearly labeled "cached".
    if (Date.now() < cooldownUntil) {
      const items = wanted.map((s) => lastGood.get(s)).filter((q): q is Quote => !!q);
      return {
        items,
        meta: makeMeta({
          source: NAME,
          status: items.length ? "cached" : "unavailable",
          asOf: items[0]?.asOf,
          note: "Yahoo is rate-limiting — showing last-known index values until it recovers.",
        }),
      };
    }

    await ensureCookie();
    const items: Quote[] = [];
    let rateLimited = false;
    const CHUNK = 3;
    for (let i = 0; i < wanted.length; i += CHUNK) {
      const batch = await Promise.all(
        wanted.slice(i, i + CHUNK).map(async (symbol) => {
          const { data, rateLimited: rl } = await yfetch(`${BASE}/${encodeURIComponent(toYahoo(symbol))}?interval=1d&range=1d`);
          if (rl) rateLimited = true;
          const meta = data?.chart?.result?.[0]?.meta;
          return meta ? metaToQuote(symbol, meta) : null;
        }),
      );
      for (const q of batch) if (q) { items.push(q); lastGood.set(q.symbol, q); }
      if (rateLimited) break; // stop hammering
    }

    if (rateLimited) {
      cooldownUntil = Date.now() + 120_000; // back off 2 minutes
      const cached = wanted.map((s) => lastGood.get(s)).filter((q): q is Quote => !!q);
      if (cached.length) {
        return { items: cached, meta: makeMeta({ source: NAME, status: "cached", note: "Yahoo rate limit hit — serving last-known index values." }) };
      }
    }

    return {
      items,
      meta: makeMeta({
        source: NAME,
        status: items.length ? "live" : "unavailable",
        note: items.length ? "Live index & equity data via Yahoo Finance (unofficial endpoint)." : "Yahoo Finance unavailable (rate limit or no data).",
      }),
    };
  },

  async getBars(symbol, timeframe): Promise<DataListEnvelope<Bar>> {
    if (Date.now() < barsCooldownUntil) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "Yahoo rate-limited — chart data temporarily unavailable." }) };
    }
    await ensureCookie();
    const { interval, range } = tfParams(timeframe);
    const { data, rateLimited } = await yfetch(`${BASE}/${encodeURIComponent(toYahoo(symbol.toUpperCase()))}?interval=${interval}&range=${range}`);
    if (rateLimited) barsCooldownUntil = Date.now() + 30_000;
    const r = data?.chart?.result?.[0];
    const ts = r?.timestamp;
    const q = r?.indicators?.quote?.[0];
    if (!r || !ts || !q || !q.close) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "Bars unavailable from Yahoo Finance." }) };
    }
    const items: Bar[] = ts
      .map((t, i) => ({ t: t * 1000, o: q.open?.[i] ?? null, h: q.high?.[i] ?? null, l: q.low?.[i] ?? null, c: q.close?.[i] ?? null, v: q.volume?.[i] ?? 0 }))
      .filter((b): b is Bar => b.c != null && b.o != null && b.h != null && b.l != null);
    return { items, meta: makeMeta({ source: NAME, status: "live", note: "Intraday / daily bars via Yahoo Finance (unofficial endpoint)." }) };
  },
};
