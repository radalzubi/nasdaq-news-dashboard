/**
 * Central configuration: instruments, watchlists, and the reference weights the
 * scoring engines use. These are static reference values (not live market data)
 * and are intentionally approximate — they shape relative importance, not prices.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Nasdaq News Dashboard";
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "America/New_York";

export const DISCLAIMER =
  "Informational only. Not financial advice. This dashboard does not place trades and should not be treated as a buy or sell recommendation.";

/**
 * The dashboard's headline instrument. QQQ is the live, reliable, free engine
 * for the Nasdaq-100 (it tracks the index ~1:1 with identical % moves), so all
 * analysis runs on it. The real NDX index *number* is shown best-effort from
 * Yahoo in the index strip when available.
 */
export const PRIMARY_SYMBOL = "QQQ";
export const PRIMARY_LABEL = "Nasdaq-100";

/** Core instruments shown in the index strip — Nasdaq-100 first. */
export const CORE_SYMBOLS = ["NDX", "QQQ", "VIX", "TNX"] as const;

/** Symbols that are index levels (not dollar prices) for formatting. */
export const INDEX_SYMBOLS = ["NDX", "IXIC", "VIX", "TNX", "SPX"] as const;
export function isIndexSymbol(symbol: string): boolean {
  return (INDEX_SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

/** Major Nasdaq leaders we track for movers / breadth / contribution. */
export const NASDAQ_LEADERS = [
  "NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL",
  "TSLA", "AMD", "AVGO", "NFLX", "PLTR", "COST",
] as const;

/** Default watchlist (user-editable, persisted client-side). */
export const DEFAULT_WATCHLIST = [
  "QQQ", "TQQQ", "SQQQ", "NVDA", "AAPL", "MSFT", "AMZN",
  "META", "GOOGL", "TSLA", "AMD", "AVGO", "NFLX", "PLTR", "COST",
] as const;

/** Semiconductor names used for the semis breadth read. */
export const SEMI_SYMBOLS = ["NVDA", "AMD", "AVGO"] as const;

/** Mega-cap tech used for the mega-cap breadth read. */
export const MEGACAP_SYMBOLS = ["AAPL", "MSFT", "AMZN", "META", "GOOGL", "NVDA"] as const;

/** Friendly display names. */
export const SYMBOL_NAMES: Record<string, string> = {
  QQQ: "Invesco QQQ Trust",
  TQQQ: "ProShares UltraPro QQQ (3x)",
  SQQQ: "ProShares UltraPro Short QQQ (-3x)",
  SPY: "SPDR S&P 500 ETF",
  VIX: "CBOE Volatility Index",
  TNX: "US 10-Year Treasury Yield",
  NDX: "Nasdaq-100 Index",
  IXIC: "Nasdaq Composite",
  DXY: "US Dollar Index",
  GOLD: "Gold (futures)",
  RUT: "Russell 2000",
  NVDA: "Nvidia",
  AAPL: "Apple",
  MSFT: "Microsoft",
  AMZN: "Amazon",
  META: "Meta Platforms",
  GOOGL: "Alphabet",
  TSLA: "Tesla",
  AMD: "Advanced Micro Devices",
  AVGO: "Broadcom",
  NFLX: "Netflix",
  PLTR: "Palantir",
  COST: "Costco",
};

/**
 * Approximate Nasdaq-100 index weights (%) for the largest names. Used only to
 * estimate index *contribution* and headline importance — not for pricing.
 * Source: public QQQ holdings snapshots (approximate, updated periodically).
 */
export const NDX_WEIGHTS: Record<string, number> = {
  NVDA: 9.0,
  AAPL: 8.5,
  MSFT: 8.0,
  AMZN: 5.5,
  AVGO: 5.0,
  META: 4.5,
  GOOGL: 5.0, // GOOGL + GOOG combined, approx
  TSLA: 3.0,
  NFLX: 2.5,
  COST: 2.5,
  AMD: 1.6,
  PLTR: 1.0,
};

/** How influential a ticker is for *Nasdaq sentiment* (0–1). Drives news scoring. */
export function tickerInfluence(symbol: string): number {
  const w = NDX_WEIGHTS[symbol];
  if (w !== undefined) return Math.min(1, w / 9); // normalize to the biggest weight
  if ((NASDAQ_LEADERS as readonly string[]).includes(symbol)) return 0.5;
  if (symbol === "QQQ" || symbol === "NDX") return 1;
  return 0.15;
}

/**
 * Source credibility scores (0–1) used in news relevance scoring.
 * Tiered by general reliability for *market-moving* financial news.
 */
export const SOURCE_CREDIBILITY: Record<string, number> = {
  // Tier 1 — wires / primary financial press
  "reuters": 1.0,
  "bloomberg": 1.0,
  "the wall street journal": 0.98,
  "wsj": 0.98,
  "financial times": 0.96,
  "ft": 0.96,
  "associated press": 0.95,
  "ap": 0.95,
  "cnbc": 0.9,
  "marketwatch": 0.85,
  "barron's": 0.85,
  "barrons": 0.85,
  // Tier 2 — reputable financial media / official
  "sec": 1.0,
  "sec edgar": 1.0,
  "federal reserve": 1.0,
  "yahoo finance": 0.7,
  "seeking alpha": 0.6,
  "businesswire": 0.75,
  "globe newswire": 0.75,
  "pr newswire": 0.7,
  "the motley fool": 0.55,
  "benzinga": 0.6,
  "investing.com": 0.6,
};

export function sourceCredibility(source: string | undefined | null): number {
  if (!source) return 0.5;
  const key = source.trim().toLowerCase();
  if (SOURCE_CREDIBILITY[key] !== undefined) return SOURCE_CREDIBILITY[key];
  // Partial match (e.g. "Reuters Business")
  for (const [name, score] of Object.entries(SOURCE_CREDIBILITY)) {
    if (key.includes(name)) return score;
  }
  return 0.5; // unknown but plausible source
}

/** Keyword → category mapping used to classify and prioritize headlines. */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  fed: ["federal reserve", "fed", "fomc", "powell", "rate cut", "rate hike", "interest rate", "central bank", "jerome powell", "rate decision"],
  inflation: ["inflation", "cpi", "ppi", "pce", "consumer price", "producer price", "deflation", "core inflation"],
  yields: ["treasury yield", "10-year", "10 year", "bond yield", "yields", "treasuries", "2-year"],
  jobs: ["nonfarm", "payroll", "jobless", "unemployment", "jobs report", "labor market", "hiring", "layoff"],
  semis: ["semiconductor", "chip", "chips", "nvidia", "amd", "broadcom", "tsmc", "asml", "gpu", "foundry"],
  ai: ["artificial intelligence", "ai", "machine learning", "data center", "openai", "llm", "generative ai"],
  megacap: ["apple", "microsoft", "amazon", "alphabet", "google", "meta", "tesla", "netflix", "nvidia"],
  earnings: ["earnings", "revenue", "guidance", "eps", "quarterly results", "beats estimates", "misses estimates", "outlook"],
  filings: ["8-k", "10-q", "10-k", "sec filing", "form 4", "s-1", "prospectus", "13f"],
  nasdaq: ["nasdaq", "qqq", "tech stocks", "growth stocks"],
  geopolitical: ["tariff", "sanction", "war", "geopolitical", "election", "shutdown", "trade deal", "china tech"],
};

/** Plain-English "why it matters" templates keyed by category. */
export const CATEGORY_WHY: Record<string, string> = {
  fed: "Fed-related news can shift expectations for interest rates, which strongly affects growth and tech stocks.",
  inflation: "Inflation data influences how long rates may stay high — higher inflation tends to pressure Nasdaq.",
  yields: "Treasury yields move the bar for growth stocks; rising yields usually weigh on Nasdaq, falling yields support it.",
  jobs: "Labor data shapes Fed expectations and the economic outlook, both of which move risk appetite.",
  semis: "Semiconductors are a major Nasdaq driver, so chip news often sets the tone for QQQ.",
  ai: "AI demand is a key growth narrative for mega-cap tech and chips, with outsized influence on Nasdaq sentiment.",
  megacap: "Mega-cap tech names carry large index weight, so news on them moves QQQ directly.",
  earnings: "Earnings can reprice a large stock quickly and, for index leaders, move the whole Nasdaq.",
  filings: "Regulatory filings can reveal material company changes that markets react to.",
  nasdaq: "This speaks directly to the Nasdaq / QQQ environment.",
  geopolitical: "Geopolitical and policy shocks can change risk appetite across the entire market.",
};

export const PROVIDER_ORDER = {
  // Finnhub fills stocks (real-time); Yahoo then fills the indices Finnhub can't
  // (NDX/VIX/TNX) + provides bars. Order avoids bursting Yahoo with all symbols.
  // FRED before Yahoo for quotes: it reliably serves VIX + 10-yr yield, freeing
  // Yahoo to handle only the index/dollar/gold + bars (fewer requests = fewer 429s).
  quotes: (process.env.PROVIDER_ORDER_QUOTES || "finnhub,fred,yahoo,demo").split(",").map((s) => s.trim()),
  // Bars: Yahoo (intraday + daily) → Alpha Vantage → FRED (real daily index
  // history, close-only, for calibration) → demo. FRED keeps daily history real
  // even when Yahoo is throttled.
  bars: (process.env.PROVIDER_ORDER_BARS || "yahoo,alphaVantage,fred,demo").split(",").map((s) => s.trim()),
  news: (process.env.PROVIDER_ORDER_NEWS || "finnhub,alphaVantage,demo").split(",").map((s) => s.trim()),
  macro: (process.env.PROVIDER_ORDER_MACRO || "demo").split(",").map((s) => s.trim()),
};
