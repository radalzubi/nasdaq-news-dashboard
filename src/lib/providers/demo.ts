import { NASDAQ_LEADERS, SYMBOL_NAMES } from "@/lib/config";
import type {
  Bar,
  DataListEnvelope,
  EarningsEvent,
  EconomicEvent,
  Filing,
  Quote,
  Timeframe,
} from "@/lib/types";
import { makeMeta } from "@/lib/types";
import type { MarketProvider, NewsQuery, RawNewsItem } from "./types";

/* ----------------------------------------------------------------------------
 * DEMO provider.
 *
 * Returns deterministic SAMPLE data so the dashboard is fully explorable with
 * zero API keys. Critically, every payload is stamped status:"demo" /
 * source:"Demo (sample data)" — it is NEVER presented as live market data.
 * Prices are seeded per-symbol so every view (brief, movers, watchlist) agrees.
 * -------------------------------------------------------------------------- */

const DEMO_SOURCE = "Demo (sample data)";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic RNG (mulberry32) seeded from a string. */
function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sample base prices (NOT live). A mildly bullish-tech scenario for showcase.
const BASE_PRICE: Record<string, number> = {
  QQQ: 480, SPY: 575, VIX: 14.5, TNX: 4.25, NDX: 20800,
  TQQQ: 75, SQQQ: 8.5,
  NVDA: 135, AAPL: 212, MSFT: 445, AMZN: 205, META: 575, GOOGL: 178,
  TSLA: 240, AMD: 165, AVGO: 175, NFLX: 690, PLTR: 30, COST: 880,
};

const SCENARIO_PCT: Record<string, number> = {
  QQQ: 0.65, SPY: 0.35, VIX: -3.2, TNX: -1.1, NDX: 0.65,
  TQQQ: 1.95, SQQQ: -1.95,
  NVDA: 2.1, AMD: 1.8, AVGO: 1.2, MSFT: 0.9, AAPL: 0.4, AMZN: 0.7,
  META: 1.1, GOOGL: 0.3, TSLA: -0.8, NFLX: 0.5, PLTR: 1.6, COST: 0.2,
};

const AVG_VOLUME: Record<string, number> = {
  QQQ: 40_000_000, SPY: 70_000_000, NVDA: 250_000_000, AAPL: 55_000_000,
  MSFT: 22_000_000, AMZN: 40_000_000, META: 14_000_000, GOOGL: 25_000_000,
  TSLA: 90_000_000, AMD: 45_000_000, AVGO: 20_000_000, NFLX: 4_000_000,
  PLTR: 60_000_000, COST: 2_500_000, TQQQ: 60_000_000, SQQQ: 70_000_000,
};

function demoQuote(symbol: string): Quote {
  const sym = symbol.toUpperCase();
  const r = rng(`q:${sym}`);
  const base = BASE_PRICE[sym] ?? 50 + r() * 200;
  const scenario = SCENARIO_PCT[sym] ?? (r() - 0.5) * 2;
  const jitter = (r() - 0.5) * 0.3;
  const changePct = scenario + jitter;
  const price = +(base * (1 + changePct / 100)).toFixed(2);
  const prevClose = +base.toFixed(2);
  const change = +(price - prevClose).toFixed(2);
  const intraSwing = base * 0.012 * (0.5 + r());
  const dayHigh = +(Math.max(price, prevClose) + intraSwing * r()).toFixed(2);
  const dayLow = +(Math.min(price, prevClose) - intraSwing * r()).toFixed(2);
  const open = +(prevClose * (1 + (changePct / 100) * 0.4)).toFixed(2);
  const avgVol = AVG_VOLUME[sym] ?? 5_000_000;
  const relVol = sym === "QQQ" ? 1.35 : 0.8 + r() * 0.8;
  const volume = Math.round(avgVol * relVol);

  return {
    symbol: sym,
    name: SYMBOL_NAMES[sym],
    price,
    change,
    changePct: +changePct.toFixed(2),
    prevClose,
    open,
    dayHigh,
    dayLow,
    volume,
    session: "regular",
    asOf: new Date().toISOString(),
  };
}

function demoDailyBars(symbol: string, count = 220): Bar[] {
  const sym = symbol.toUpperCase();
  const q = demoQuote(sym);
  const r = rng(`d:${sym}`);
  const end = q.prevClose ?? q.price ?? 100;
  // Build a gently trending random walk ending at prevClose, then append today.
  const bars: Bar[] = [];
  let price = end * (0.82 + r() * 0.06); // start ~18% below, mild uptrend
  const drift = (end - price) / count;
  const dayMs = 86_400_000;
  const startT = Date.now() - count * dayMs;
  for (let i = 0; i < count - 1; i++) {
    const noise = (r() - 0.5) * end * 0.012;
    const open = price;
    price = Math.max(1, price + drift + noise);
    const high = Math.max(open, price) * (1 + r() * 0.006);
    const low = Math.min(open, price) * (1 - r() * 0.006);
    bars.push({ t: startT + i * dayMs, o: +open.toFixed(2), h: +high.toFixed(2), l: +low.toFixed(2), c: +price.toFixed(2), v: Math.round((AVG_VOLUME[sym] ?? 5e6) * (0.7 + r() * 0.6)) });
  }
  // Today's bar.
  bars.push({
    t: Date.now(),
    o: q.open ?? end,
    h: q.dayHigh ?? q.price ?? end,
    l: q.dayLow ?? q.price ?? end,
    c: q.price ?? end,
    v: q.volume ?? 0,
  });
  return bars;
}

function demoIntradayBars(symbol: string, count = 78): Bar[] {
  const sym = symbol.toUpperCase();
  const q = demoQuote(sym);
  const r = rng(`i:${sym}`);
  const open = q.open ?? q.prevClose ?? q.price ?? 100;
  const close = q.price ?? open;
  const bars: Bar[] = [];
  let price = open;
  const drift = (close - open) / count;
  const barMs = 5 * 60_000;
  // Anchor to the most recent 6.5h.
  const startT = Date.now() - count * barMs;
  for (let i = 0; i < count; i++) {
    const noise = (r() - 0.5) * open * 0.0035;
    const o = price;
    price = i === count - 1 ? close : Math.max(1, price + drift + noise);
    const h = Math.max(o, price) * (1 + r() * 0.0015);
    const l = Math.min(o, price) * (1 - r() * 0.0015);
    const vol = Math.round(((q.volume ?? 1e6) / count) * (0.6 + r() * 1.2));
    bars.push({ t: startT + i * barMs, o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +price.toFixed(2), v: vol });
  }
  return bars;
}

// ---- Sample news (clearly labeled). Includes near-duplicates for clustering. -
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function demoNews(): RawNewsItem[] {
  return [
    { id: "n1", headline: "Nvidia shares rise after analyst raises AI demand forecast", source: "Reuters", url: "https://example.com/n1", publishedAt: minsAgo(8), tickers: ["NVDA"], summary: "An analyst lifted estimates for data-center GPU demand into next year, citing strong enterprise AI orders." },
    { id: "n2", headline: "Nvidia shares rise as analyst raises AI demand forecast", source: "CNBC", url: "https://example.com/n2", publishedAt: minsAgo(12), tickers: ["NVDA"], summary: "Several desks raised price targets on continued AI spending." },
    { id: "n3", headline: "Nvidia shares climb after analyst lifts AI demand forecast", source: "Bloomberg", url: "https://example.com/n3", publishedAt: minsAgo(19), tickers: ["NVDA"] },
    { id: "n4", headline: "Treasury yields ease as traders pencil in slower path for rates", source: "MarketWatch", url: "https://example.com/n4", publishedAt: minsAgo(34), tickers: [], summary: "The 10-year yield slipped, a modest tailwind for growth and tech stocks." },
    { id: "n5", headline: "Fed official says inflation progress allows patience on rate cuts", source: "The Wall Street Journal", url: "https://example.com/n5", publishedAt: minsAgo(52), tickers: [], summary: "Comments were read as balanced, neither hawkish nor dovish." },
    { id: "n6", headline: "AMD gains as data-center chip momentum continues", source: "Barron's", url: "https://example.com/n6", publishedAt: minsAgo(67), tickers: ["AMD"] },
    { id: "n7", headline: "Microsoft expands AI features across cloud product line", source: "CNBC", url: "https://example.com/n7", publishedAt: minsAgo(95), tickers: ["MSFT"], summary: "New capabilities target enterprise customers." },
    { id: "n8", headline: "Tesla slips as analysts trim delivery estimates", source: "Reuters", url: "https://example.com/n8", publishedAt: minsAgo(120), tickers: ["TSLA"], summary: "A few analysts lowered near-term delivery forecasts." },
    { id: "n9", headline: "Apple reportedly accelerates on-device AI roadmap", source: "Bloomberg", url: "https://example.com/n9", publishedAt: minsAgo(140), tickers: ["AAPL"] },
    { id: "n10", headline: "Jobless claims hold steady, labor market stays resilient", source: "Associated Press", url: "https://example.com/n10", publishedAt: minsAgo(175), tickers: [], summary: "Weekly claims were roughly in line with expectations." },
    { id: "n11", headline: "Broadcom raises full-year AI revenue guidance", source: "Reuters", url: "https://example.com/n11", publishedAt: minsAgo(210), tickers: ["AVGO"], summary: "The company pointed to strong networking and custom-silicon demand." },
    { id: "n12", headline: "Palantir wins new government contract, shares jump", source: "Benzinga", url: "https://example.com/n12", publishedAt: minsAgo(240), tickers: ["PLTR"] },
    { id: "n13", headline: "Costco reports steady monthly sales growth", source: "MarketWatch", url: "https://example.com/n13", publishedAt: minsAgo(300), tickers: ["COST"] },
    { id: "n14", headline: "Markets watch upcoming inflation data for rate clues", source: "Yahoo Finance", url: "https://example.com/n14", publishedAt: minsAgo(330), tickers: ["QQQ", "SPY"], summary: "Tomorrow's CPI release is the week's key macro event." },
  ];
}

const EVENT_WHY: Record<string, string> = {
  inflation: "Higher inflation can hurt Nasdaq because it may keep interest rates higher for longer; cooler readings tend to support tech.",
  fed: "A Fed speech or decision can move markets if it changes expectations about the path of interest rates.",
  jobs: "Labor data shapes Fed expectations — a hot report can lift yields and pressure growth stocks.",
  rates: "Treasury auctions and rate-sensitive data influence yields, which set the bar for growth-stock valuations.",
  growth: "Growth readings affect the economic outlook and risk appetite across the market.",
  sentiment: "Sentiment surveys hint at the direction of spending and confidence.",
};

function demoMacroEvents(): EconomicEvent[] {
  const now = new Date();
  const at = (dayOffset: number, hour: number, minute: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const mins = (m: number) => new Date(now.getTime() + m * 60000).toISOString();

  return [
    { id: "e-claims", title: "Initial Jobless Claims", country: "US", time: mins(-90), importance: "medium", previous: "219K", forecast: "222K", actual: "217K", surprise: "below", whyItMatters: EVENT_WHY.jobs, category: "jobs" },
    { id: "e-fedspk", title: "Fed Speaker: Williams", country: "US", time: mins(150), importance: "medium", previous: null, forecast: null, actual: null, whyItMatters: EVENT_WHY.fed, category: "fed" },
    { id: "e-auction", title: "10-Year Note Auction", country: "US", time: mins(180), importance: "low", previous: "4.31%", forecast: null, actual: null, whyItMatters: EVENT_WHY.rates, category: "rates" },
    { id: "e-cpi", title: "CPI Inflation Report (MoM)", country: "US", time: at(1, 8, 30), importance: "high", previous: "0.3%", forecast: "0.2%", actual: null, whyItMatters: EVENT_WHY.inflation, category: "inflation" },
    { id: "e-ppi", title: "PPI (MoM)", country: "US", time: at(2, 8, 30), importance: "medium", previous: "0.2%", forecast: "0.2%", actual: null, whyItMatters: EVENT_WHY.inflation, category: "inflation" },
    { id: "e-retail", title: "Retail Sales (MoM)", country: "US", time: at(3, 8, 30), importance: "high", previous: "0.4%", forecast: "0.3%", actual: null, whyItMatters: EVENT_WHY.growth, category: "growth" },
    { id: "e-umich", title: "U. of Michigan Sentiment", country: "US", time: at(4, 10, 0), importance: "medium", previous: "69.1", forecast: "70.0", actual: null, whyItMatters: EVENT_WHY.sentiment, category: "sentiment" },
    { id: "e-fomc", title: "FOMC Meeting Minutes", country: "US", time: at(5, 14, 0), importance: "high", previous: null, forecast: null, actual: null, whyItMatters: EVENT_WHY.fed, category: "fed" },
  ];
}

function demoEarnings(symbols: string[]): EarningsEvent[] {
  const want = symbols.length ? symbols.map((s) => s.toUpperCase()) : [...NASDAQ_LEADERS];
  const now = new Date();
  const out: EarningsEvent[] = [];
  let offset = 2;
  for (const sym of want) {
    if (!(sym in BASE_PRICE)) continue;
    const r = rng(`earn:${sym}`);
    const d = new Date(now);
    d.setDate(d.getDate() + Math.round(offset + r() * 30));
    out.push({
      symbol: sym,
      name: SYMBOL_NAMES[sym],
      date: d.toISOString().slice(0, 10),
      hour: r() > 0.5 ? "amc" : "bmo",
      epsEstimate: +(0.5 + r() * 3).toFixed(2),
    });
    offset += 1.5;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function demoFilings(symbols: string[]): Filing[] {
  const want = (symbols.length ? symbols : ["NVDA", "AAPL", "MSFT", "AMD"]).map((s) => s.toUpperCase());
  const forms = ["8-K", "10-Q", "4", "8-K"];
  return want.slice(0, 6).map((sym, i) => ({
    id: `f-${sym}-${i}`,
    symbol: sym,
    form: forms[i % forms.length],
    title: `${SYMBOL_NAMES[sym] ?? sym} — Form ${forms[i % forms.length]}`,
    filedAt: minsAgo(60 + i * 120),
    url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(sym)}&type=${forms[i % forms.length]}`,
  }));
}

export const demoProvider: MarketProvider = {
  id: "demo",
  name: DEMO_SOURCE,
  capabilities: { quotes: true, bars: true, news: true, earnings: true, macro: true, filings: true },
  isConfigured: () => true,

  async getQuotes(symbols) {
    const items = symbols.map((s) => demoQuote(s));
    return { items, meta: makeMeta({ source: DEMO_SOURCE, status: "demo", note: "Sample prices — not live market data." }) };
  },

  async getBars(symbol, timeframe: Timeframe) {
    const items = timeframe === "1D" ? demoDailyBars(symbol) : demoIntradayBars(symbol);
    return { items, meta: makeMeta({ source: DEMO_SOURCE, status: "demo", note: "Sample bars — not live market data." }) };
  },

  async getNews(query: NewsQuery): Promise<DataListEnvelope<RawNewsItem>> {
    let items = demoNews();
    if (query.tickers?.length) {
      const want = new Set(query.tickers.map((t) => t.toUpperCase()));
      items = items.filter((n) => n.tickers.some((t) => want.has(t)));
    }
    if (query.limit) items = items.slice(0, query.limit);
    return { items, meta: makeMeta({ source: DEMO_SOURCE, status: "demo", note: "Sample headlines — not live news." }) };
  },

  async getEarnings(symbols) {
    return { items: demoEarnings(symbols), meta: makeMeta({ source: DEMO_SOURCE, status: "demo", note: "Sample earnings dates." }) };
  },

  async getMacroEvents() {
    return { items: demoMacroEvents(), meta: makeMeta({ source: DEMO_SOURCE, status: "demo", note: "Sample economic calendar — verify against an official source." }) };
  },

  async getFilings(symbols) {
    return { items: demoFilings(symbols), meta: makeMeta({ source: DEMO_SOURCE, status: "demo", note: "Sample filings list." }) };
  },
};
