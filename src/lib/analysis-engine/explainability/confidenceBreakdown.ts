import type { FactorContribution, MarketClarity } from "../core/types";
import { splitFactors } from "./factorAttribution";

export interface ConfidenceBreakdown {
  score: number;
  label: string;
  positive: FactorContribution[];
  negative: FactorContribution[];
  plain: string;
}

/** The structured "Why this score?" object for the expandable UI panel. */
export function buildConfidenceBreakdown(clarity: MarketClarity, factors: FactorContribution[]): ConfidenceBreakdown {
  const { positive, negative } = splitFactors(factors);
  return {
    score: clarity.score,
    label: clarity.label,
    positive,
    negative,
    plain: clarity.explanation,
  };
}
