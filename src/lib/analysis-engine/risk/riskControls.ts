import { clamp } from "../core/scoring";

export interface GuardrailResult {
  adjustedClarity: number;
  notice: string | null;
  capped: boolean;
}

/**
 * Applies guardrails: caps the clarity score when conditions are unsafe and
 * produces a plain "Signal quality reduced because…" notice. The engine never
 * shows a strong clarity score when critical inputs are stale/missing/conflicting.
 */
export function applyGuardrails(clarity: number, guardrailReasons: string[], clarityCap: number | null): GuardrailResult {
  let adjusted = clarity;
  let capped = false;
  if (clarityCap !== null && adjusted > clarityCap) {
    adjusted = clarityCap;
    capped = true;
  }
  adjusted = clamp(Math.round(adjusted));

  const reasons = [...new Set(guardrailReasons)];
  const notice = reasons.length ? `Signal quality reduced because ${joinReasons(reasons)}.` : null;
  return { adjustedClarity: adjusted, notice, capped };
}

function joinReasons(reasons: string[]): string {
  if (reasons.length === 1) return reasons[0];
  if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;
  return `${reasons.slice(0, -1).join(", ")}, and ${reasons[reasons.length - 1]}`;
}
