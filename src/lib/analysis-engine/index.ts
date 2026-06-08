export { runAnalysisEngine, type EngineOptions } from "./core/engine";
export { MODEL_VERSION } from "./core/types";
export type { AnalysisEngineOutput, EngineInput } from "./core/types";
export { runBacktest, type SignalType } from "./validation/backtest";
export { walkForward } from "./validation/walkForward";
export { buildConfidenceBreakdown } from "./explainability/confidenceBreakdown";
