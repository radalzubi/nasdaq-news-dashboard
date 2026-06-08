import { z } from "zod";

/* ============================================================================
 * Data provenance — every payload carries where it came from and how fresh it
 * is. This is the mechanism behind the "never fabricate data" rule: nothing is
 * shown without a source + status the UI can surface honestly.
 * ========================================================================== */

export type DataStatus = "live" | "delayed" | "cached" | "demo" | "unavailable";

export interface DataMeta {
  /** Human-readable provider, e.g. "Finnhub", "FRED", "Demo (sample data)". */
  source: string;
  status: DataStatus;
  /** When this payload was fetched/assembled (ISO). */
  fetchedAt: string;
  /** Timestamp the underlying data represents, if different (ISO). */
  asOf?: string | null;
  /** Optional human note, e.g. "15-min delayed" or "feed unavailable". */
  note?: string;
}

/** Standard envelope for a single value. */
export interface DataEnvelope<T> {
  data: T | null;
  meta: DataMeta;
}

/** Standard envelope for a collection. */
export interface DataListEnvelope<T> {
  items: T[];
  meta: DataMeta;
}

export function makeMeta(partial: Partial<DataMeta> & Pick<DataMeta, "source" | "status">): DataMeta {
  return { fetchedAt: new Date().toISOString(), ...partial };
}

/* ============================================================================
 * Market data
 * ========================================================================== */

export interface Quote {
  symbol: string;
  name?: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  prevClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  /** Extended-hours (pre/post) last price, when available. */
  extendedPrice?: number | null;
  extendedChangePct?: number | null;
  session?: "pre" | "regular" | "post" | "closed";
  asOf: string;
}

export interface Bar {
  /** epoch milliseconds */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1D";

/* ============================================================================
 * News
 * ========================================================================== */

export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type Importance = "low" | "medium" | "high" | "market-moving";
export type AffectedArea =
  | "QQQ"
  | "Semiconductors"
  | "Mega-cap tech"
  | "Growth stocks"
  | "Risk appetite"
  | "Yields-sensitive";
export type NewsCategory =
  | "nasdaq"
  | "megacap"
  | "semis"
  | "ai"
  | "fed"
  | "inflation"
  | "yields"
  | "jobs"
  | "earnings"
  | "filings"
  | "geopolitical"
  | "general";

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  tickers: string[];
  summary?: string;
  whyItMatters?: string;
  sentiment: Sentiment;
  importance: Importance;
  /** 0–100 relevance for a Nasdaq trader. */
  relevanceScore: number;
  categories: NewsCategory[];
  affectedAreas: AffectedArea[];
  image?: string | null;
}

export interface NewsCluster {
  id: string;
  headline: string;
  summary?: string;
  whyItMatters?: string;
  sentiment: Sentiment;
  importance: Importance;
  relevanceScore: number;
  tickers: string[];
  categories: NewsCategory[];
  affectedAreas: AffectedArea[];
  sources: string[];
  articleCount: number;
  items: NewsItem[];
  firstSeen: string;
  lastSeen: string;
}

/* ============================================================================
 * Macro + events
 * ========================================================================== */

export type EventImportance = "low" | "medium" | "high";
export type EventCategory = "fed" | "inflation" | "jobs" | "growth" | "sentiment" | "rates" | "other";

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  time: string;
  importance: EventImportance;
  previous?: string | null;
  forecast?: string | null;
  actual?: string | null;
  unit?: string | null;
  surprise?: "above" | "below" | "inline" | null;
  whyItMatters: string;
  category: EventCategory;
}

export interface EarningsEvent {
  symbol: string;
  name?: string;
  date: string;
  /** before market open / after market close / during. */
  hour?: "bmo" | "amc" | "dmh" | null;
  epsEstimate?: number | null;
  epsActual?: number | null;
  revenueEstimate?: number | null;
  revenueActual?: number | null;
}

export interface Filing {
  id: string;
  symbol: string;
  form: string;
  title: string;
  filedAt: string;
  url: string;
}

/* ============================================================================
 * Derived intelligence
 * ========================================================================== */

export type Mood = "Bullish" | "Bearish" | "Mixed" | "Cautious" | "Quiet" | "Volatile";

export type ClarityLabel =
  | "Very unclear"
  | "Weak signal"
  | "Mixed"
  | "Reasonably clear"
  | "Strong environment"
  | "Very strong, but verify";

export type Bias = "Bullish" | "Bearish" | "Neutral" | "Mixed";

export interface ClarityComponent {
  key: string;
  label: string;
  /** weight as a fraction (sums to ~1). */
  weight: number;
  /** 0–100 sub-score. */
  score: number;
  note: string;
}

export interface MarketClarityScore {
  score: number;
  label: ClarityLabel;
  bias: Bias;
  summary: string;
  supporting: string[];
  risks: string[];
  components: ClarityComponent[];
  dataQualityWarning?: string | null;
  newsImpact: string;
  technicalSummary: string;
  macroRisk: string;
  generatedAt: string;
}

export type DirectionState = "up" | "down" | "sideways" | "unclear";
export interface Direction {
  state: DirectionState;
  /** Plain label, e.g. "Leaning Up". */
  label: string;
  /** Plain one-liner, e.g. "The Nasdaq-100 is leaning lower today." */
  sentence: string;
}

export interface MarketBrief {
  mood: Mood;
  direction: Direction;
  summary: string;
  clarity: MarketClarityScore;
  reasons: string[];
  risks: string[];
  headlineQuote: Quote | null;
  generatedAt: string;
}

export type Stance = "bullish" | "bearish" | "neutral";
export type Confidence = "low" | "medium" | "high";

export interface TechnicalIndicator {
  key: string;
  label: string;
  value: string;
  stance: Stance;
  confidence: Confidence;
  mattersNow: boolean;
  plain: string;
}

export interface TechnicalSummary {
  symbol: string;
  trend: "Positive" | "Negative" | "Mixed";
  momentum: "Strong" | "Weak" | "Neutral";
  volume: "Light" | "Normal" | "Heavy";
  chopRisk: "Low" | "Medium" | "High";
  keyLevel: number | null;
  keyLevelLabel?: string;
  explanation: string;
  indicators: TechnicalIndicator[];
  asOf: string;
}

/* ============================================================================
 * Movers
 * ========================================================================== */

export type MoveDriver = "news" | "earnings" | "macro" | "technical" | "unclear";

export interface Mover {
  symbol: string;
  name?: string;
  quote: Quote;
  /** Estimated index contribution in points-equivalent (relative). */
  contribution: number;
  driver: MoveDriver;
  reason?: string | null;
  topHeadline?: { headline: string; url: string } | null;
  unusualVolume?: boolean;
}

export interface MoversReport {
  topContributors: Mover[];
  bottomContributors: Mover[];
  gainers: Mover[];
  losers: Mover[];
  unusualVolume: Mover[];
  megacap: Mover[];
  semis: Mover[];
}

/* ============================================================================
 * Watchlist / alerts / journal
 * ========================================================================== */

export interface WatchlistItem {
  symbol: string;
  name?: string;
  quote: Quote | null;
  topHeadline?: { headline: string; url: string; sentiment: Sentiment } | null;
  newsSentiment: Sentiment | null;
  technicalRead?: string | null;
  volumeStatus?: "Light" | "Normal" | "Heavy" | null;
  nextEarnings?: string | null;
  relevanceScore?: number | null;
}

export type AlertSeverity = "info" | "important" | "high" | "market-moving";
export type AlertType =
  | "major-news"
  | "watchlist-news"
  | "qqq-level"
  | "qqq-vwap"
  | "macro-event"
  | "earnings"
  | "vix-spike"
  | "yield-spike"
  | "unusual-volume"
  | "clarity-change"
  | "stale-feed";

export interface AlertRule {
  id: string;
  type: AlertType;
  label: string;
  symbol?: string | null;
  threshold?: number | null;
  severity: AlertSeverity;
  enabled: boolean;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  ruleId?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  at: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  exit?: number | null;
  stop?: number | null;
  target?: number | null;
  size?: number | null;
  pnl?: number | null;
  setup?: string | null;
  reason?: string | null;
  newsContext?: string | null;
  technicalContext?: string | null;
  mistakes?: string[];
  notes?: string | null;
}

/* ============================================================================
 * Providers
 * ========================================================================== */

export interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  capabilities: string[];
  status: "connected" | "disconnected" | "not-configured" | "error";
  lastFetchAt?: string | null;
  latencyMs?: number | null;
  mode: DataStatus;
  message?: string;
}

/* ============================================================================
 * Zod schemas — input validation for POST routes + the risk calculator.
 * ========================================================================== */

export const watchlistInputSchema = z.object({
  symbols: z.array(z.string().trim().toUpperCase().min(1).max(8)).max(60),
});
export type WatchlistInput = z.infer<typeof watchlistInputSchema>;

export const alertRuleInputSchema = z.object({
  type: z.enum([
    "major-news", "watchlist-news", "qqq-level", "qqq-vwap", "macro-event",
    "earnings", "vix-spike", "yield-spike", "unusual-volume", "clarity-change", "stale-feed",
  ]),
  label: z.string().trim().min(1).max(120),
  symbol: z.string().trim().toUpperCase().max(8).optional().nullable(),
  threshold: z.number().finite().optional().nullable(),
  severity: z.enum(["info", "important", "high", "market-moving"]).default("important"),
  enabled: z.boolean().default(true),
});
export type AlertRuleInput = z.infer<typeof alertRuleInputSchema>;

export const journalInputSchema = z.object({
  date: z.string().min(1),
  symbol: z.string().trim().toUpperCase().min(1).max(8),
  direction: z.enum(["long", "short"]),
  entry: z.number().finite(),
  exit: z.number().finite().optional().nullable(),
  stop: z.number().finite().optional().nullable(),
  target: z.number().finite().optional().nullable(),
  size: z.number().finite().nonnegative().optional().nullable(),
  setup: z.string().max(80).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  newsContext: z.string().max(500).optional().nullable(),
  technicalContext: z.string().max(500).optional().nullable(),
  mistakes: z.array(z.string().max(40)).max(12).optional(),
  notes: z.string().max(1000).optional().nullable(),
});
export type JournalInput = z.infer<typeof journalInputSchema>;

export const riskInputSchema = z.object({
  accountSize: z.number().positive(),
  riskPct: z.number().positive().max(100),
  entry: z.number().positive(),
  stop: z.number().positive(),
  target: z.number().positive().optional().nullable(),
  symbol: z.string().trim().toUpperCase().max(8).optional().nullable(),
  /** Average daily range (ATR-like) used for the "stop is tight" warning. */
  atr: z.number().positive().optional().nullable(),
});
export type RiskInput = z.infer<typeof riskInputSchema>;

export const symbolsQuerySchema = z.object({
  symbols: z.string().transform((s) =>
    s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean).slice(0, 60),
  ),
});
