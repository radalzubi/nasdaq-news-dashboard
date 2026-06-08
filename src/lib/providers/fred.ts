import { SYMBOL_NAMES } from "@/lib/config";
import type { Bar, DataListEnvelope, Quote, Timeframe } from "@/lib/types";
import { makeMeta } from "@/lib/types";
import { fetchJSON } from "./http";
import type { MarketProvider } from "./types";

const NAME = "FRED (St. Louis Fed)";
const BASE = "https://api.stlouisfed.org/fred/series/observations";

function key() {
  return process.env.FRED_API_KEY || "";
}

/** Macro symbols FRED can supply as a daily (end-of-day) level. */
const SERIES: Record<string, string> = {
  TNX: "DGS10", // 10-Year Treasury constant maturity rate (%)
  VIX: "VIXCLS", // CBOE Volatility Index close
};

/** Symbols FRED can supply as DAILY CLOSE history (close-only) for calibration. */
const HISTORY_SERIES: Record<string, string> = {
  QQQ: "NASDAQ100", // QQQ tracks the Nasdaq-100 ~1:1; use the real index for history
  NDX: "NASDAQ100",
  IXIC: "NASDAQCOM",
  VIX: "VIXCLS",
  TNX: "DGS10",
};

interface FredResp {
  observations?: { date: string; value: string }[];
}

export const fredProvider: MarketProvider = {
  id: "fred",
  name: NAME,
  capabilities: { quotes: true, bars: true },
  isConfigured: () => Boolean(key()),

  async getBars(symbol: string, timeframe: Timeframe): Promise<DataListEnvelope<Bar>> {
    const sym = symbol.toUpperCase();
    const series = HISTORY_SERIES[sym];
    // FRED is daily, close-only — perfect for calibration/longer-term history.
    if (timeframe !== "1D" || !series) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "FRED supplies daily history only." }) };
    }
    const data = await fetchJSON<FredResp>(
      `${BASE}?series_id=${series}&api_key=${key()}&file_type=json&sort_order=desc&limit=2600`,
      { timeoutMs: 15000 },
    );
    const obs = (data?.observations ?? []).filter((o) => o.value !== ".").reverse();
    if (obs.length < 30) {
      return { items: [], meta: makeMeta({ source: NAME, status: "unavailable", note: "FRED history unavailable." }) };
    }
    const items: Bar[] = obs.map((o) => {
      const c = parseFloat(o.value);
      return { t: new Date(`${o.date}T20:00:00Z`).getTime(), o: c, h: c, l: c, c, v: 0 };
    });
    return {
      items,
      meta: makeMeta({ source: NAME, status: "delayed", note: "Real daily history (end-of-day, close-only) — the Nasdaq-100 index via FRED." }),
    };
  },

  async getQuotes(symbols): Promise<DataListEnvelope<Quote>> {
    const wanted = symbols.map((s) => s.toUpperCase()).filter((s) => s in SERIES);
    const items: Quote[] = [];
    for (const symbol of wanted) {
      const data = await fetchJSON<FredResp>(
        `${BASE}?series_id=${SERIES[symbol]}&api_key=${key()}&file_type=json&sort_order=desc&limit=8`,
      );
      const obs = (data?.observations ?? []).filter((o) => o.value !== ".").map((o) => ({ date: o.date, value: parseFloat(o.value) }));
      if (obs.length < 2) continue;
      const [latest, prev] = obs;
      const price = latest.value;
      const prevClose = prev.value;
      const change = price - prevClose;
      const changePct = prevClose !== 0 ? (change / prevClose) * 100 : null;
      items.push({
        symbol,
        name: SYMBOL_NAMES[symbol],
        price: +price.toFixed(2),
        change: +change.toFixed(2),
        changePct: changePct !== null ? +changePct.toFixed(2) : null,
        prevClose: +prevClose.toFixed(2),
        open: null,
        dayHigh: null,
        dayLow: null,
        volume: null,
        session: "closed",
        asOf: `${latest.date}T20:00:00Z`,
      });
    }
    return {
      items,
      meta: makeMeta({
        source: NAME,
        status: items.length ? "delayed" : "unavailable",
        note: items.length ? "End-of-day macro levels (VIX, 10-year yield)." : "FRED series unavailable.",
      }),
    };
  },
};
