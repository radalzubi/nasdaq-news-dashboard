import type { Bar, DataStatus, EconomicEvent, NewsCluster, Quote, Sentiment } from "@/lib/types";

/* ============================================================================
 * Analysis Engine — type contract.
 *
 * The engine is a PURE module: it accepts normalized inputs (EngineInput) and
 * returns a structured, auditable AnalysisEngineOutput. It never executes
 * trades, never says "buy/sell now", never promises returns. Every score is
 * explainable and carries a data-quality caveat.
 * ========================================================================== */

export const MODEL_VERSION = "analysis-engine-1.0.0";

export type MarketSession = "premarket" | "regular" | "afterhours" | "closed";
export type MarketMood = "bullish" | "bearish" | "mixed" | "cautious" | "quiet" | "volatile" | "unclear";
export type Bias = "bullish" | "bearish" | "neutral" | "mixed";
export type Stance = "positive" | "negative" | "neutral";
export type Severity = "low" | "medium" | "high";

/* ---- Inputs --------------------------------------------------------------- */

export interface DataQualityMeta {
  staleInputs?: string[];
  missingInputs?: string[];
  delayedInputs?: string[];
  providerErrors?: string[];
  /** Per-source freshness/status, e.g. { QQQ: "live", NDX: "demo" }. */
  sources?: Record<string, DataStatus>;
}

export interface EngineInput {
  /** Headline instrument the read is about (e.g. "QQQ" tracking the Nasdaq-100). */
  symbol: string;
  /** Display label, e.g. "Nasdaq-100". */
  label?: string;
  now?: number;
  session: MarketSession;
  /** Quotes keyed by symbol: the instrument, index leaders, VIX, TNX, SPY, etc. */
  quotes: Record<string, Quote | null>;
  /** Today's intraday bars for the instrument (oldest→newest). */
  intraday: Bar[];
  /** Daily bars for the instrument (oldest→newest) — drives longer trend, ATR, anomaly baselines. */
  daily: Bar[];
  /** Pre-scored, de-duplicated news clusters. */
  newsClusters: NewsCluster[];
  /** Economic calendar. */
  macroEvents: EconomicEvent[];
  /** Index-leader symbols used for breadth/leadership. */
  leaders: string[];
  /** Optional premarket high/low if available. */
  premarket?: { high: number; low: number } | null;
  /** True when `daily` is real history (not sample) — affects calibration. */
  historyReal?: boolean;
  dataQuality?: DataQualityMeta;
}

/* ---- Shared output building blocks ---------------------------------------- */

export interface ComponentScore {
  key: string;
  label: string;
  /** 0–100. */
  score: number;
  /** Fraction of the clarity blend (sums to ~1 across weighted components). */
  weight: number;
  /** Signed contribution to clarity (score × weight, recentered). */
  contribution: number;
  stance: Stance;
  /** Plain-English read of this component. */
  plain: string;
  inputsUsed: string[];
  /** True when this component is running on missing/sample/stale data. */
  degraded?: boolean;
}

export interface MarketDriver {
  title: string;
  detail: string;
  /** Relative importance 0–1. */
  weight: number;
  tickers?: string[];
}

export interface MarketRisk {
  title: string;
  detail: string;
  severity: Severity;
}

export type KeyLevelKind = "vwap" | "prevClose" | "openingRangeHigh" | "openingRangeLow" | "support" | "resistance" | "gapFill" | "premarketHigh" | "premarketLow";
export interface KeyLevel {
  label: string;
  value: number;
  kind: KeyLevelKind;
  /** Signed % distance of current price from the level. */
  distancePct: number | null;
  plain: string;
}

export type AlertType =
  | "macro-event-window"
  | "volatility-spike"
  | "stale-data"
  | "missing-feed"
  | "signal-conflict"
  | "unusual-move"
  | "unusual-volume"
  | "low-liquidity"
  | "market-closed";
export interface AnalysisAlert {
  id: string;
  type: AlertType;
  severity: "info" | "important" | "high" | "market-moving";
  title: string;
  detail: string;
}

/* ---- News impact ---------------------------------------------------------- */

export type NewsImpactLabel = "low relevance" | "worth noting" | "important" | "market-moving";
export interface NewsImpactItem {
  id: string;
  headline: string;
  summary?: string;
  whyItMatters: string;
  tickers: string[];
  theme: string[];
  sentiment: Sentiment;
  impactScore: number; // 0–100
  impactLabel: NewsImpactLabel;
  priceConfirming: boolean | null; // null = can't tell
  stale: boolean;
  clustered: boolean;
  sources: string[];
  ageMinutes: number;
}
export interface NewsImpactReport {
  items: NewsImpactItem[];
  netSentiment: Bias;
  topThemes: string[];
  plain: string;
}

/* ---- Regime --------------------------------------------------------------- */

export type RegimeName =
  | "Risk-on trend"
  | "Risk-off trend"
  | "Choppy / low conviction"
  | "News-driven spike"
  | "Macro-event waiting period"
  | "Post-event volatility"
  | "Narrow mega-cap-led move"
  | "Broad-based rally"
  | "Broad-based selloff"
  | "Low-volume drift"
  | "High-volatility liquidation"
  | "Reversal attempt"
  | "Range-bound consolidation";

export interface RegimeClassification {
  regime: RegimeName;
  confidence: number; // 0–100
  why: string;
  invalidatedBy: string;
  watchNext: string;
}

/* ---- Technical / breadth / volatility / liquidity / cross-asset ----------- */

export interface TechnicalRead {
  trendScore: number;
  momentumScore: number;
  volumeConfirmationScore: number;
  keyLevelScore: number;
  chopRiskScore: number;
  trend: "Positive" | "Negative" | "Mixed";
  momentum: "Strong" | "Weak" | "Neutral";
  volume: "Light" | "Normal" | "Heavy";
  inControl: "buyers" | "sellers" | "neither";
  plain: string;
  keyLevels: KeyLevel[];
  degraded: boolean;
}

export type BreadthClass = "Broad bullish" | "Broad bearish" | "Narrow bullish" | "Narrow bearish" | "Mixed" | "Weak participation" | "Mega-cap dominated";
export interface BreadthRead {
  pctGreen: number | null;
  pctAbovePrevClose: number | null;
  leadersUp: number;
  leadersTotal: number;
  classification: BreadthClass;
  bias: Bias;
  narrow: boolean;
  semisLeading: boolean | null;
  plain: string;
  degraded: boolean;
}

export type VolatilityRegime = "Calm" | "Normal" | "Elevated" | "Extreme";
export interface VolatilityRead {
  regime: VolatilityRegime;
  score: number; // 0–100 (higher = calmer/clearer)
  vixLevel: number | null;
  vixChangePct: number | null;
  atrPct: number | null;
  intradayRangePct: number | null;
  plain: string;
  degraded: boolean;
}

export type LiquidityClass = "Healthy" | "Thin" | "Risky" | "Unknown";
export interface LiquidityRead {
  classification: LiquidityClass;
  score: number; // 0–100
  relativeVolume: number | null;
  slippageWarning: boolean;
  plain: string;
  degraded: boolean;
}

export interface CrossAssetRead {
  score: number; // 0–100 (confirmation strength)
  confirming: "confirming" | "diverging" | "mixed" | "unknown";
  plain: string;
  signals: string[];
  degraded: boolean;
}

export interface MicrostructureRead {
  available: boolean;
  bias: Bias;
  plain: string;
}

/* ---- Anomaly + conflict --------------------------------------------------- */

export type AnomalyType = "unusual-move" | "unusual-volume" | "unusual-volatility" | "news-spike" | "large-gap" | "qqq-leader-divergence" | "pre-event-move" | "provider-anomaly";
export interface Anomaly {
  type: AnomalyType;
  severity: Severity;
  explanation: string;
  trust: "trust" | "investigate";
  zScore?: number;
}

export interface Conflict {
  id: string;
  severity: Severity;
  explanation: string;
  clarityImpact: number; // negative points applied to clarity
  watch: string;
}

/* ---- Clarity + attribution ------------------------------------------------ */

export type ClarityLabel = "Very unclear" | "Weak signal" | "Mixed" | "Reasonably clear" | "Strong environment" | "Very strong, but verify";

export interface FactorContribution {
  label: string;
  points: number; // signed
  direction: "positive" | "negative";
}

export interface MarketClarity {
  score: number; // 0–100
  label: ClarityLabel;
  bias: Bias;
  mainDriver: string;
  supportingFactors: string[];
  riskFactors: string[];
  whatWouldChangeIt: string;
  dataQualityPenalty: number;
  regime: RegimeName;
  explanation: string;
}

export interface DirectionalBias {
  bias: Bias;
  strength: number; // 0–100
  explanation: string;
}

/* ---- Backtest / validation ------------------------------------------------ */

export type ForwardWindow = "5m" | "15m" | "30m" | "1h" | "eod" | "next-session";

export interface BacktestResult {
  signalType: string;
  symbol: string;
  window: string;
  sampleSize: number;
  hitRate: number | null; // fraction up
  avgForwardReturnPct: number | null;
  medianForwardReturnPct: number | null;
  forwardVolatilityPct: number | null;
  maxAdverseExcursionPct: number | null;
  maxFavorableExcursionPct: number | null;
  falsePositiveRate: number | null;
  confidence: "low" | "moderate" | "high";
  leakageChecksPassed: boolean;
  assumptions: { transactionCostPct: number; slippagePct: number };
  plain: string;
  disclaimer: string;
}

export interface Reliability {
  sampleSize: number;
  window: string;
  overallHitRate: number | null;
  /** Hit rate for the current conviction-strength bucket. */
  bucketHitRate: number | null;
  informationCoefficient: number | null;
  brierScore: number | null;
  confidence: "low" | "moderate" | "high";
  basedOnRealData: boolean;
  plain: string;
  disclaimer: string;
}

/* ---- Data quality + audit ------------------------------------------------- */

export interface DataQualityReport {
  overall: number; // 0–100
  staleInputs: string[];
  missingInputs: string[];
  delayedInputs: string[];
  providerErrors: string[];
  confidencePenalty: number;
  warning: string | null;
}

export interface AuditTrail {
  inputsUsed: string[];
  modelVersion: string;
  rulesTriggered: string[];
  calculationTimestamp: string;
}

/* ---- Top-level output ----------------------------------------------------- */

export interface AnalysisEngineOutput {
  timestamp: string;
  symbol: string;
  label: string;
  marketSession: MarketSession;
  marketMood: MarketMood;

  directionalBias: DirectionalBias;
  marketClarity: MarketClarity;
  reliability: Reliability;

  componentScores: {
    news: ComponentScore;
    macro: ComponentScore;
    technicals: ComponentScore;
    breadth: ComponentScore;
    volatility: ComponentScore;
    liquidity: ComponentScore;
    crossAsset: ComponentScore;
    microstructure?: ComponentScore;
    dataQuality: ComponentScore;
  };

  regime: RegimeClassification;
  newsImpact: NewsImpactReport;
  technicalRead: TechnicalRead;
  breadth: BreadthRead;
  volatility: VolatilityRead;
  liquidity: LiquidityRead;
  crossAsset: CrossAssetRead;
  microstructure: MicrostructureRead;

  topMarketDrivers: MarketDriver[];
  topRisks: MarketRisk[];
  keyLevels: KeyLevel[];
  conflicts: Conflict[];
  anomalies: Anomaly[];
  alerts: AnalysisAlert[];

  factorContributions: FactorContribution[];

  plainEnglishSummary: {
    oneSentence: string;
    shortBrief: string;
    whatChanged: string;
    whyItMatters: string;
    whatToWatchNext: string;
  };

  dataQuality: DataQualityReport;
  auditTrail: AuditTrail;
}
