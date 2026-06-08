import { buildBreadthRead } from "../features/breadthFeatures";
import { buildCrossAssetRead } from "../features/correlationFeatures";
import { buildLiquidityRead } from "../features/liquidityFeatures";
import { buildMacroRead } from "../features/macroFeatures";
import { buildMicrostructureRead, type OrderBookSnapshot } from "../features/microstructureFeatures";
import { buildNewsImpact } from "../features/newsFeatures";
import { extractRegimeSignals } from "../features/regimeFeatures";
import { buildTechnicalRead } from "../features/technicalFeatures";
import { buildVolatilityRead } from "../features/volatilityFeatures";
import { computeClarity } from "../models/clarityScoreModel";
import { classifyRegime } from "../models/marketRegimeModel";
import { detectAnomalies } from "../models/anomalyDetectionModel";
import { assessRisk } from "../models/riskModel";
import { detectConflicts } from "../risk/conflictGuard";
import { eventLockout } from "../risk/eventRisk";
import { applyGuardrails } from "../risk/riskControls";
import { volatilityGuard } from "../risk/volatilityGuard";
import { buildDataQualityReport } from "../validation/dataQualityChecks";
import { bucketFor, calibrate } from "../validation/calibration";
import { replayDirectional } from "../validation/signalReplay";
import { buildDrivers, buildSummaries, deriveMood } from "../explainability/plainEnglish";
import { clarityLabel } from "./config";
import { clamp } from "./scoring";
import { MODEL_VERSION, type AnalysisAlert, type AnalysisEngineOutput, type ComponentScore, type DirectionalBias, type EngineInput, type MarketRisk, type Reliability } from "./types";

export interface EngineOptions {
  orderBook?: OrderBookSnapshot | null;
}

/** The pure analysis engine: normalized inputs → structured, auditable output. */
export function runAnalysisEngine(input: EngineInput, opts: EngineOptions = {}): AnalysisEngineOutput {
  const now = input.now ?? Date.now();
  const symbol = input.symbol.toUpperCase();
  const label = input.label ?? symbol;
  const quote = input.quotes[symbol] ?? input.quotes.QQQ ?? input.quotes.NDX ?? null;
  const primaryChangePct = quote?.changePct ?? null;
  const missing = input.dataQuality?.missingInputs ?? [];
  const newsAvailable = !missing.includes("news");
  const macroAvailable = !missing.includes("economic calendar");

  // ---- Feature reads -------------------------------------------------------
  const technical = buildTechnicalRead({ symbol, label, intraday: input.intraday, daily: input.daily, quote, premarket: input.premarket });
  const liquidity = buildLiquidityRead({ quote, daily: input.daily });
  const volatility = buildVolatilityRead({ quotes: input.quotes, daily: input.daily, quote });
  const breadth = buildBreadthRead({ quotes: input.quotes, leaders: input.leaders });
  const news = buildNewsImpact({ clusters: input.newsClusters, quotes: input.quotes, primaryChangePct, now });
  const macro = buildMacroRead({ events: input.macroEvents, quotes: input.quotes, now, available: macroAvailable });
  const crossAsset = buildCrossAssetRead({ quotes: input.quotes, primaryChangePct });
  const microstructure = buildMicrostructureRead(opts.orderBook);

  // ---- Regime --------------------------------------------------------------
  const regimeSignals = extractRegimeSignals({ quotes: input.quotes, primaryChangePct, technical, breadth, volatility, macro, news, relVol: liquidity.relativeVolume });
  const regime = classifyRegime(regimeSignals);
  const eventImminent = regimeSignals.eventImminent;

  // ---- Conflicts + anomalies + data quality --------------------------------
  const conflicts = detectConflicts({ news, technical, breadth, volatility, liquidity, macro, primaryChangePct, eventImminent });
  const anomalies = detectAnomalies({ quote, daily: input.daily, news, breadthBias: breadth.bias, primaryChangePct, eventImminent });
  const dataQuality = buildDataQualityReport({
    quotes: input.quotes,
    primarySymbol: symbol,
    session: input.session,
    newsAvailable,
    macroAvailable,
    breadthAvailable: !breadth.degraded,
    meta: input.dataQuality,
    now,
  });

  // ---- Clarity model -------------------------------------------------------
  const cm = computeClarity({ news, macro, technical, breadth, volatility, liquidity, crossAsset, dataQuality, conflicts, regime: regime.regime, regimeInvalidatedBy: regime.invalidatedBy });

  // Dominant-factor share (for single-factor guardrail).
  const contribs = Object.values(cm.componentScores).map((c) => Math.abs(c.contribution));
  const dominantFactorShare = contribs.reduce((a, b) => a + b, 0) > 0 ? Math.max(...contribs) / contribs.reduce((a, b) => a + b, 0) : 0;

  // ---- Risk + guardrails ---------------------------------------------------
  const risk = assessRisk({ macro, volatility, breadth, liquidity, conflicts, dataQuality, session: input.session, dominantFactorShare });
  const volGuard = volatilityGuard(volatility);
  const lockout = eventLockout(macro.eventRisk);
  // A stale live price is a hard cap on clarity (spec: refuse a strong score).
  const stalePrimary = dataQuality.staleInputs.length > 0;
  const caps = [risk.clarityCap, volGuard.clarityCap, lockout.clarityCap, stalePrimary ? 55 : null].filter((x): x is number => x !== null);
  const clarityCap = caps.length ? Math.min(...caps) : null;
  const guardrailReasons = [...risk.guardrailReasons];
  if (volGuard.warning && volatility.regime === "Extreme") guardrailReasons.push("volatility is extreme");
  if (lockout.reason) guardrailReasons.push(lockout.reason);
  if (stalePrimary) guardrailReasons.push("the live price looks stale");

  const guard = applyGuardrails(cm.clarity.score, guardrailReasons, clarityCap);

  // Apply guardrails to the clarity object.
  const clarity = { ...cm.clarity, score: guard.adjustedClarity, label: clarityLabel(guard.adjustedClarity) };
  if (guard.notice) clarity.explanation = `${guard.notice} ${clarity.explanation}`;
  const directionalBias = { ...cm.directionalBias, strength: clamp(Math.min(cm.directionalBias.strength, guard.adjustedClarity + 10)) };

  // ---- Calibration / reliability (validates the call against history) -------
  const calibration = calibrate(replayDirectional(input.daily));
  const reliability = buildReliability(calibration, directionalBias, input.historyReal ?? false);

  // ---- Plain English -------------------------------------------------------
  const plainInput = { label, primaryChangePct, clarity, directionalBias, regime, news, technical, breadth, volatility, macro, anomalies };
  const mood = deriveMood(clarity, volatility, directionalBias.bias);
  const drivers = buildDrivers(plainInput);
  const summaries = buildSummaries(plainInput, drivers);

  // ---- Risks (combine risk model + clarity risk phrases) -------------------
  const topRisks: MarketRisk[] = [...risk.topRisks];
  if (guard.capped && guard.notice) topRisks.unshift({ title: "Reduced signal quality", detail: guard.notice, severity: "high" });

  // ---- Alerts --------------------------------------------------------------
  const alerts = buildAlerts(input, { eventImminent, volatility, dataQuality, conflicts: conflicts.length, anomalies });

  // ---- Component scores (+ optional microstructure) ------------------------
  const componentScores: AnalysisEngineOutput["componentScores"] = { ...cm.componentScores };
  if (microstructure.available) {
    componentScores.microstructure = {
      key: "microstructure",
      label: "Order flow (short-term)",
      score: 50,
      weight: 0,
      contribution: 0,
      stance: microstructure.bias === "bullish" ? "positive" : microstructure.bias === "bearish" ? "negative" : "neutral",
      plain: microstructure.plain,
      inputsUsed: ["order book"],
    } satisfies ComponentScore;
  }

  // ---- Audit trail ---------------------------------------------------------
  const inputsUsed = [
    quote ? "live quote" : null,
    input.intraday.length ? "intraday bars" : null,
    input.daily.length ? "daily bars" : null,
    newsAvailable ? "news" : null,
    macroAvailable ? "economic calendar" : null,
    !breadth.degraded ? "index leaders (breadth)" : null,
    volatility.vixLevel !== null ? "VIX" : null,
    input.quotes.TNX ? "10-year yield" : null,
    input.quotes.SPY ? "SPY (cross-asset)" : null,
    input.quotes.DXY ? "US dollar index (cross-asset)" : null,
    input.quotes.GOLD ? "gold (cross-asset)" : null,
  ].filter((x): x is string => x !== null);

  const rulesTriggered = [
    `regime:${regime.regime}`,
    ...conflicts.map((c) => `conflict:${c.id}`),
    ...anomalies.map((a) => `anomaly:${a.type}`),
    ...guardrailReasons.map((r) => `guardrail:${r}`),
  ];

  return {
    timestamp: new Date(now).toISOString(),
    symbol,
    label,
    marketSession: input.session,
    marketMood: mood,
    directionalBias,
    marketClarity: clarity,
    reliability,
    componentScores,
    regime,
    newsImpact: news,
    technicalRead: technical,
    breadth,
    volatility,
    liquidity,
    crossAsset,
    microstructure,
    topMarketDrivers: drivers,
    topRisks: topRisks.slice(0, 5),
    keyLevels: technical.keyLevels,
    conflicts,
    anomalies,
    alerts,
    factorContributions: cm.factorContributions,
    plainEnglishSummary: summaries,
    dataQuality,
    auditTrail: { inputsUsed, modelVersion: MODEL_VERSION, rulesTriggered, calculationTimestamp: new Date(now).toISOString() },
  };
}

function buildReliability(cal: ReturnType<typeof calibrate>, db: DirectionalBias, real: boolean): Reliability {
  const bucket = bucketFor(cal, db.strength);
  const bucketHitRate = bucket?.hitRate ?? null;
  const sampleSize = cal.sampleSize;
  const confidence: Reliability["confidence"] = sampleSize >= 80 ? "high" : sampleSize >= 30 ? "moderate" : "low";

  let plain: string;
  if (!real) {
    plain = "Calibration is running on SAMPLE price history (no real chart feed connected), so treat it as illustrative. Connect a charts provider for a real track record.";
  } else if (sampleSize < 20 || bucketHitRate === null || db.bias === "neutral") {
    plain = "Not enough comparable history yet to calibrate a call this strong — the track record builds as more sessions accrue.";
  } else {
    const pctv = Math.round(bucketHitRate * 100);
    const dirWord = db.bias === "bullish" ? "higher" : db.bias === "bearish" ? "lower" : "in the leaning direction";
    plain = `Historically, when the price-based read leaned this strongly, the next session moved ${dirWord} ${pctv}% of the time across ${bucket!.n} similar cases. This is calibration context, not a prediction — the live call also weighs news, breadth, and macro.`;
  }

  return {
    sampleSize,
    window: "next session",
    overallHitRate: cal.overallHitRate,
    bucketHitRate,
    informationCoefficient: cal.informationCoefficient,
    brierScore: cal.brierScore,
    confidence,
    basedOnRealData: real,
    plain,
    disclaimer: "Calibration measures how often similar past setups were followed by the expected move. It is not a forecast and does not guarantee future results.",
  };
}

function buildAlerts(
  input: EngineInput,
  ctx: { eventImminent: boolean; volatility: AnalysisEngineOutput["volatility"]; dataQuality: AnalysisEngineOutput["dataQuality"]; conflicts: number; anomalies: AnalysisEngineOutput["anomalies"] },
): AnalysisAlert[] {
  const alerts: AnalysisAlert[] = [];
  if (ctx.eventImminent) alerts.push({ id: "a-event", type: "macro-event-window", severity: "high", title: "Major event window", detail: "A high-impact economic event is imminent — moves may be less predictable." });
  if (ctx.volatility.regime === "Extreme") alerts.push({ id: "a-vol", type: "volatility-spike", severity: "high", title: "Extreme volatility", detail: ctx.volatility.plain });
  if (ctx.dataQuality.overall < 55 || ctx.dataQuality.staleInputs.length > 0) alerts.push({ id: "a-dq", type: "stale-data", severity: "important", title: "Data quality reduced", detail: ctx.dataQuality.warning ?? "Some inputs are stale or missing." });
  if (ctx.dataQuality.missingInputs.includes("news")) alerts.push({ id: "a-news", type: "missing-feed", severity: "important", title: "News feed unavailable", detail: "News impact can't be assessed right now." });
  if (ctx.conflicts >= 2) alerts.push({ id: "a-conflict", type: "signal-conflict", severity: "important", title: "Conflicting signals", detail: "Several signals disagree, which lowers confidence." });
  for (const an of ctx.anomalies.filter((a) => a.severity === "high").slice(0, 2)) {
    alerts.push({ id: `a-anom-${an.type}`, type: an.type === "unusual-volume" ? "unusual-volume" : "unusual-move", severity: "important", title: "Unusual activity", detail: an.explanation });
  }
  if (input.session === "closed") alerts.push({ id: "a-closed", type: "market-closed", severity: "info", title: "Market closed", detail: "Live signals are limited while the market is closed." });
  return alerts;
}
