import type { Quote } from "@/lib/types";
import { clamp } from "../core/scoring";
import type { CrossAssetRead } from "../core/types";

export interface CorrelationInput {
  quotes: Record<string, Quote | null>;
  primaryChangePct: number | null;
}

const pct = (q: Quote | null | undefined) => (q && q.changePct != null ? q.changePct : null);

/** Do other markets confirm the Nasdaq move? (SPY, VIX, 10-yr yield, small caps.) */
export function buildCrossAssetRead(input: CorrelationInput): CrossAssetRead {
  const p = input.primaryChangePct;
  const spy = pct(input.quotes.SPY);
  const vix = pct(input.quotes.VIX);
  const tnx = pct(input.quotes.TNX);
  const iwm = pct(input.quotes.IWM);
  const dxy = pct(input.quotes.DXY);
  const gold = pct(input.quotes.GOLD);

  const signals: string[] = [];
  let score = 50;
  let inputs = 0;

  if (p != null) {
    if (vix != null) {
      inputs++;
      const opposite = (p > 0 && vix < 0) || (p < 0 && vix > 0);
      if (opposite) {
        score += 12;
        signals.push(p > 0 ? "Stocks up while the fear gauge falls — supportive." : "Stocks down with the fear gauge up — a clean risk-off move.");
      } else if (Math.abs(vix) > 2) {
        score -= 12;
        signals.push("Stocks and the fear gauge are rising together — a caution sign.");
      }
    }
    if (tnx != null) {
      inputs++;
      if (p > 0 && tnx < -0.5) {
        score += 10;
        signals.push("Interest rates are easing as stocks rise — a tailwind.");
      } else if (p > 0 && tnx > 1) {
        score -= 8;
        signals.push("Rates are rising into the rally — a headwind.");
      } else if (p < 0 && tnx > 0.5) {
        score -= 6;
        signals.push("Stocks down and rates up — pressure on tech.");
      }
    }
    if (spy != null) {
      inputs++;
      const rel = p - spy;
      if (rel > 0.3) {
        score += 6;
        signals.push("The Nasdaq-100 is outperforming the broad market — tech leadership.");
      } else if (rel < -0.3) {
        score -= 6;
        signals.push("The Nasdaq-100 is lagging the broad market — tech weakness.");
      }
    }
    if (iwm != null && spy != null) {
      inputs++;
      if (p > 0 && iwm > 0 && spy > 0) {
        score += 4;
        signals.push("Big and small companies are rising together — broad strength.");
      }
    }
    if (dxy != null) {
      inputs++;
      if (p > 0 && dxy < -0.2) {
        score += 5;
        signals.push("The US dollar is easing, a tailwind for stocks.");
      } else if (p > 0 && dxy > 0.3) {
        score -= 5;
        signals.push("The dollar is strengthening into the rally — a mild headwind.");
      } else if (p < 0 && dxy > 0.3) {
        score -= 4;
        signals.push("A stronger dollar is adding pressure on stocks.");
      }
    }
    if (gold != null) {
      inputs++;
      if (p < 0 && gold > 0.6) {
        score -= 4;
        signals.push("Money is moving into gold — a sign of caution.");
      } else if (p > 0 && gold < -0.4) {
        score += 3;
        signals.push("Gold is slipping as risk appetite returns.");
      }
    }
  }

  score = clamp(score);
  const degraded = inputs === 0;
  const confirming: CrossAssetRead["confirming"] = degraded ? "unknown" : score >= 60 ? "confirming" : score <= 42 ? "diverging" : "mixed";

  const plain = degraded
    ? "Other markets can't be compared right now (data unavailable)."
    : confirming === "confirming"
    ? "Other markets agree with the Nasdaq's move, which makes it more trustworthy."
    : confirming === "diverging"
    ? "Other markets aren't confirming the Nasdaq's move, which is a caution sign."
    : "Other markets are giving a mixed read on the Nasdaq's move.";

  return { score, confirming, plain, signals, degraded };
}
