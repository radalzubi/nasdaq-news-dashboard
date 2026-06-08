import type { MacroRead } from "../features/macroFeatures";
import type { BreadthRead, Conflict, DataQualityReport, LiquidityRead, MarketRisk, MarketSession, VolatilityRead } from "../core/types";

export interface RiskModelInput {
  macro: MacroRead;
  volatility: VolatilityRead;
  breadth: BreadthRead;
  liquidity: LiquidityRead;
  conflicts: Conflict[];
  dataQuality: DataQualityReport;
  session: MarketSession;
  /** Largest single component weight share of clarity (for single-factor warning). */
  dominantFactorShare?: number;
}

export interface RiskModelOutput {
  topRisks: MarketRisk[];
  guardrailReasons: string[];
  /** Hard upper bound on clarity when conditions are unsafe (null = no cap). */
  clarityCap: number | null;
}

export function assessRisk(input: RiskModelInput): RiskModelOutput {
  const risks: MarketRisk[] = [];
  const guardrails: string[] = [];
  const caps: number[] = [];

  // Macro / event risk
  if (input.macro.riskLabel === "Extreme" || input.macro.riskLabel === "High") {
    risks.push({ title: "Major event risk", detail: input.macro.eventRisk.message, severity: input.macro.riskLabel === "Extreme" ? "high" : "medium" });
    if (input.macro.eventRisk.inRiskWindow) {
      caps.push(60);
      guardrails.push("a major economic event is in the current window");
    }
  }

  // Volatility
  if (input.volatility.regime === "Extreme") {
    risks.push({ title: "Extreme volatility", detail: input.volatility.plain, severity: "high" });
    caps.push(55);
    guardrails.push("volatility is extreme");
  } else if (input.volatility.regime === "Elevated") {
    risks.push({ title: "Elevated volatility", detail: input.volatility.plain, severity: "medium" });
  }

  // Breadth
  if (input.breadth.narrow) {
    risks.push({ title: "Narrow move", detail: "Only a few large companies are driving the index, so the move is less reliable.", severity: "medium" });
  }

  // Liquidity
  if (input.liquidity.classification === "Risky") {
    risks.push({ title: "Very light volume", detail: input.liquidity.plain, severity: "medium" });
  }

  // Conflicts
  for (const c of input.conflicts.filter((x) => x.severity !== "low").slice(0, 2)) {
    risks.push({ title: "Conflicting signals", detail: c.explanation, severity: c.severity });
  }
  if (input.conflicts.filter((c) => c.severity === "high").length >= 2) {
    caps.push(60);
    guardrails.push("several signals are conflicting");
  }

  // Data quality
  if (input.dataQuality.overall < 55) {
    risks.push({ title: "Data quality reduced", detail: input.dataQuality.warning ?? "Some inputs are stale or missing.", severity: "high" });
    caps.push(58);
    guardrails.push(input.dataQuality.warning ?? "some data is stale or missing");
  } else if (input.dataQuality.staleInputs.length || input.dataQuality.missingInputs.length) {
    risks.push({ title: "Some data is delayed", detail: input.dataQuality.warning ?? "A few inputs are delayed.", severity: "low" });
  }

  // Market closed
  if (input.session === "closed") {
    guardrails.push("the market is closed, so live signals are limited");
    caps.push(72);
  }

  // Single-factor dominance
  if (input.dominantFactorShare !== undefined && input.dominantFactorShare > 0.6) {
    guardrails.push("the read is driven mostly by a single factor");
  }

  return {
    topRisks: risks.slice(0, 5),
    guardrailReasons: guardrails,
    clarityCap: caps.length ? Math.min(...caps) : null,
  };
}
