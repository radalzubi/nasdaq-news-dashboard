import type { FactorContribution } from "../core/types";

export function splitFactors(factors: FactorContribution[]): { positive: FactorContribution[]; negative: FactorContribution[] } {
  return {
    positive: factors.filter((f) => f.points > 0).sort((a, b) => b.points - a.points),
    negative: factors.filter((f) => f.points < 0).sort((a, b) => a.points - b.points),
  };
}

/** Plain "+X / -Y" attribution lines for the "Why this score?" panel. */
export function attributionLines(factors: FactorContribution[]): string[] {
  return factors.map((f) => `${f.points >= 0 ? "+" : ""}${Math.round(f.points)} · ${f.label}`);
}
