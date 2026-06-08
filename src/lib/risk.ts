import type { RiskInput } from "@/lib/types";
import { round } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Position-size / risk calculator. Pure and deterministic. Plain-English
 * warnings, never advice.
 * -------------------------------------------------------------------------- */

export interface RiskResult {
  direction: "long" | "short";
  /** Whole shares the risk budget allows. */
  positionSize: number;
  /** Risk budget in dollars (account × risk%). */
  riskBudget: number;
  /** Actual dollars at risk for the sized position. */
  dollarRisk: number;
  perShareRisk: number;
  stopDistancePct: number;
  potentialReward: number | null;
  riskReward: number | null;
  positionValue: number;
  warnings: string[];
}

export function computeRisk(input: RiskInput & { eventSoon?: boolean }): RiskResult {
  const { accountSize, riskPct, entry, stop, target, atr, eventSoon } = input;
  const direction: "long" | "short" = stop < entry ? "long" : "short";

  const perShareRisk = Math.abs(entry - stop);
  const riskBudget = accountSize * (riskPct / 100);
  const positionSize = perShareRisk > 0 ? Math.floor(riskBudget / perShareRisk) : 0;
  const dollarRisk = positionSize * perShareRisk;
  const stopDistancePct = entry > 0 ? (perShareRisk / entry) * 100 : 0;
  const positionValue = positionSize * entry;

  let potentialReward: number | null = null;
  let riskReward: number | null = null;
  if (target !== null && target !== undefined && perShareRisk > 0) {
    const perShareReward = Math.abs(target - entry);
    potentialReward = positionSize * perShareReward;
    riskReward = perShareReward / perShareRisk;
  }

  const warnings: string[] = [];

  if (perShareRisk === 0) {
    warnings.push("Your stop is the same as your entry, so there is no defined risk. Set a stop away from entry.");
  }
  if (positionSize === 0 && perShareRisk > 0) {
    warnings.push("Your risk budget is too small for this stop distance — the position rounds down to zero shares.");
  }
  if (riskPct > 2) {
    warnings.push(`You're risking ${riskPct}% of the account on one trade, which is more than the common 1–2% guideline.`);
  }
  if (positionValue > accountSize && positionSize > 0) {
    warnings.push("This position is larger than your account, so it would require margin/leverage.");
  }
  if (atr && perShareRisk > 0 && perShareRisk < atr * 0.5) {
    warnings.push("The stop is very tight compared with this name's normal daily movement, so it may get hit by routine noise.");
  }
  if (riskReward !== null && riskReward < 1) {
    warnings.push("The potential reward is smaller than the risk on this setup.");
  }
  // Target/direction consistency.
  if (target !== null && target !== undefined) {
    if (direction === "long" && target <= entry) {
      warnings.push("For a long trade, the target should be above the entry.");
    }
    if (direction === "short" && target >= entry) {
      warnings.push("For a short trade, the target should be below the entry.");
    }
  }
  if (eventSoon) {
    warnings.push("A major economic event is coming soon, so price may move unpredictably around it.");
  }

  return {
    direction,
    positionSize,
    riskBudget: round(riskBudget, 2),
    dollarRisk: round(dollarRisk, 2),
    perShareRisk: round(perShareRisk, 4),
    stopDistancePct: round(stopDistancePct, 2),
    potentialReward: potentialReward !== null ? round(potentialReward, 2) : null,
    riskReward: riskReward !== null ? round(riskReward, 2) : null,
    positionValue: round(positionValue, 2),
    warnings,
  };
}
