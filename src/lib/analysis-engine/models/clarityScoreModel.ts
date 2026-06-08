import { CLARITY_WEIGHTS, clarityLabel } from "../core/config";
import { clamp, round } from "../core/scoring";
import type { MacroRead } from "../features/macroFeatures";
import { newsClarityComponent } from "./newsImpactModel";
import type {
  Bias,
  BreadthRead,
  ComponentScore,
  Conflict,
  CrossAssetRead,
  DataQualityReport,
  DirectionalBias,
  FactorContribution,
  LiquidityRead,
  MarketClarity,
  NewsImpactReport,
  RegimeName,
  Stance,
  TechnicalRead,
  VolatilityRead,
} from "../core/types";

export interface ClarityModelInput {
  news: NewsImpactReport;
  macro: MacroRead;
  technical: TechnicalRead;
  breadth: BreadthRead;
  volatility: VolatilityRead;
  liquidity: LiquidityRead;
  crossAsset: CrossAssetRead;
  dataQuality: DataQualityReport;
  conflicts: Conflict[];
  regime: RegimeName;
  regimeInvalidatedBy: string;
}

export interface ClarityModelOutput {
  clarity: MarketClarity;
  componentScores: {
    news: ComponentScore;
    macro: ComponentScore;
    technicals: ComponentScore;
    breadth: ComponentScore;
    volatility: ComponentScore;
    liquidity: ComponentScore;
    crossAsset: ComponentScore;
    dataQuality: ComponentScore;
  };
  factorContributions: FactorContribution[];
  directionalBias: DirectionalBias;
}

const biasVal = (b: Bias) => (b === "bullish" ? 1 : b === "bearish" ? -1 : 0);
const stanceFromBias = (b: Bias): Stance => (b === "bullish" ? "positive" : b === "bearish" ? "negative" : "neutral");

const BREADTH_CLARITY: Record<BreadthRead["classification"], number> = {
  "Broad bullish": 80,
  "Broad bearish": 78,
  "Narrow bullish": 40,
  "Narrow bearish": 40,
  "Mega-cap dominated": 36,
  "Weak participation": 34,
  Mixed: 48,
};

function mk(key: string, label: string, score: number, weight: number, stance: Stance, plain: string, inputsUsed: string[], degraded = false): ComponentScore {
  return { key, label, score: round(score, 0), weight, contribution: round((score - 50) * weight, 1), stance, plain, inputsUsed, degraded };
}

export function computeClarity(input: ClarityModelInput): ClarityModelOutput {
  const W = CLARITY_WEIGHTS;

  // ---- Component scores ----------------------------------------------------
  const newsC = newsClarityComponent(input.news);
  const news = mk("news", "The news", newsC.score, W.news, newsC.stance, newsC.plain, ["news clusters", "sentiment", "price reaction"], input.dataQuality.missingInputs.includes("news"));

  const macroScore = 100 - input.macro.riskScore;
  const macro = mk("macro", "Upcoming events", macroScore, W.macro, input.macro.supportive ? "positive" : "neutral", input.macro.eventRisk.message, ["economic calendar", "yields", "fear gauge"], input.macro.degraded);

  const trendDefiniteness = Math.abs(input.technical.trendScore - 50) * 2;
  const techScore = 0.35 * trendDefiniteness + 0.25 * input.technical.volumeConfirmationScore + 0.2 * input.technical.keyLevelScore + 0.2 * (100 - input.technical.chopRiskScore);
  const techStance: Stance = input.technical.trend === "Positive" ? "positive" : input.technical.trend === "Negative" ? "negative" : "neutral";
  const technicals = mk("technicals", "Price action", techScore, W.technicals, techStance, input.technical.plain, ["VWAP", "moving averages", "RSI", "volume"], input.technical.degraded);

  const breadth = mk("breadth", "How broad the move is", BREADTH_CLARITY[input.breadth.classification], W.breadth, stanceFromBias(input.breadth.bias), input.breadth.plain, ["index leaders"], input.breadth.degraded);

  const volatility = mk("volatility", "Volatility", input.volatility.score, W.volatility, "neutral", input.volatility.plain, ["VIX", "ATR"], input.volatility.degraded);
  const liquidity = mk("liquidity", "Liquidity", input.liquidity.score, W.liquidity, "neutral", input.liquidity.plain, ["volume"], input.liquidity.degraded);

  const caStance: Stance = input.crossAsset.confirming === "confirming" ? "positive" : input.crossAsset.confirming === "diverging" ? "negative" : "neutral";
  const crossAsset = mk("crossAsset", "Cross-asset confirmation", input.crossAsset.score, W.crossAsset, caStance, input.crossAsset.plain, ["SPY", "VIX", "yields"], input.crossAsset.degraded);

  const dataQuality = mk("dataQuality", "Data freshness", input.dataQuality.overall, W.dataQuality, "neutral", input.dataQuality.warning ?? "Data is fresh and updating.", ["provider status"], input.dataQuality.overall < 70);

  const components = { news, macro, technicals, breadth, volatility, liquidity, crossAsset, dataQuality };
  const list = Object.values(components);

  // ---- Clarity score: 50 + Σ contributions − conflict penalty --------------
  const conflictPenalty = input.conflicts.reduce((a, c) => a + c.clarityImpact, 0);
  const raw = 50 + list.reduce((a, c) => a + c.contribution, 0) - conflictPenalty;
  const score = clamp(round(raw, 0));
  const label = clarityLabel(score);

  // ---- Directional bias (only directional components) ----------------------
  const dirParts: { b: Bias; w: number }[] = [
    { b: input.news.netSentiment, w: W.news },
    { b: input.technical.trend === "Positive" ? "bullish" : input.technical.trend === "Negative" ? "bearish" : "mixed", w: W.technicals },
    { b: input.breadth.bias, w: W.breadth },
    { b: caStance === "positive" ? "bullish" : caStance === "negative" ? "bearish" : "neutral", w: W.crossAsset },
  ];
  const dirWeight = dirParts.reduce((a, p) => a + p.w, 0) || 1;
  const biasSum = dirParts.reduce((a, p) => a + biasVal(p.b) * p.w, 0) / dirWeight;
  const anyMixed = dirParts.some((p) => p.b === "mixed");
  const bias: Bias = Math.abs(biasSum) < 0.12 ? (anyMixed ? "mixed" : "neutral") : biasSum > 0 ? "bullish" : "bearish";
  const strength = clamp(round(Math.min(Math.abs(biasSum) * 190, score + 10), 0));

  // ---- Factor attribution --------------------------------------------------
  const factorContributions: FactorContribution[] = list
    .filter((c) => Math.abs(c.contribution) >= 1)
    .map((c) => ({ label: c.label, points: c.contribution, direction: c.contribution >= 0 ? ("positive" as const) : ("negative" as const) }));
  for (const cf of input.conflicts) {
    factorContributions.push({ label: `Conflict: ${cf.explanation.slice(0, 48)}…`, points: -cf.clarityImpact, direction: "negative" });
  }
  factorContributions.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  // ---- Supporting / risk factors + main driver -----------------------------
  const supportingFactors = list
    .filter((c) => c.score >= 56)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((c) => positivePhrase(c.key));
  const riskFactors: string[] = list
    .filter((c) => c.score <= 44)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 3)
    .map((c) => negativePhrase(c.key));
  for (const cf of input.conflicts.slice(0, 2)) riskFactors.push(cf.explanation);
  while (supportingFactors.length < 1) supportingFactors.push("Conditions are steady.");
  while (riskFactors.length < 1) riskFactors.push("Conditions can change quickly — worth checking back later.");

  const topComp = [...list].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
  const mainDriver = topComp.contribution >= 0 ? positivePhrase(topComp.key) : negativePhrase(topComp.key);

  const explanation = `${score}/100 — ${label}. ${bias === "bullish" ? "Leaning bullish" : bias === "bearish" ? "Leaning bearish" : bias === "mixed" ? "Mixed read" : "Neutral read"}, driven most by: ${mainDriver.toLowerCase()}.`;

  const clarity: MarketClarity = {
    score,
    label,
    bias,
    mainDriver,
    supportingFactors: supportingFactors.slice(0, 3),
    riskFactors: riskFactors.slice(0, 3),
    whatWouldChangeIt: input.regimeInvalidatedBy ? `Watch for ${input.regimeInvalidatedBy}.` : "Watch the key levels and whether more big companies join the move.",
    dataQualityPenalty: round(input.dataQuality.confidencePenalty, 0),
    regime: input.regime,
    explanation,
  };

  const directionalBias: DirectionalBias = {
    bias,
    strength,
    explanation:
      bias === "neutral"
        ? "No clear directional lean right now."
        : `${strength >= 60 ? "Fairly strong" : strength >= 35 ? "Moderate" : "Slight"} ${bias} lean, based on news, price action, breadth, and other markets.`,
  };

  return { clarity, componentScores: components, factorContributions, directionalBias };
}

function positivePhrase(key: string): string {
  switch (key) {
    case "news": return "Headlines are mostly good for stocks";
    case "technicals": return "Buyers are in control of the tape";
    case "breadth": return "The move is broad across the big companies";
    case "crossAsset": return "Other markets agree with the move";
    case "macro": return "The economic backdrop is supportive";
    case "volatility": return "Volatility is calm";
    case "liquidity": return "Trading volume is healthy";
    case "dataQuality": return "Data is fresh and reliable";
    default: return "Conditions are supportive";
  }
}
function negativePhrase(key: string): string {
  switch (key) {
    case "news": return "The news is mixed or leaning negative";
    case "technicals": return "Sellers are in control or the tape is messy";
    case "breadth": return "The move is narrow, not broad";
    case "crossAsset": return "Other markets aren't confirming the move";
    case "macro": return "Event risk is elevated";
    case "volatility": return "Volatility is elevated";
    case "liquidity": return "Volume is light, so the move is less reliable";
    case "dataQuality": return "Some data is stale or missing";
    default: return "Conditions are weak";
  }
}
