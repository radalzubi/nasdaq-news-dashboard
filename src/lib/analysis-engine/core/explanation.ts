/** Aggregator for the explainability layer — single import point for the engine. */
export { attributionLines, splitFactors } from "../explainability/factorAttribution";
export { buildConfidenceBreakdown, type ConfidenceBreakdown } from "../explainability/confidenceBreakdown";
export { buildDrivers, buildSummaries, deriveMood } from "../explainability/plainEnglish";
