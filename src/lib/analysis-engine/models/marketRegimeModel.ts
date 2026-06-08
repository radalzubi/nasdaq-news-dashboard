import { REL_VOLUME } from "../core/config";
import { clamp } from "../core/scoring";
import type { RegimeSignals } from "../features/regimeFeatures";
import type { RegimeClassification, RegimeName } from "../core/types";

/* ============================================================================
 * Market regime classifier. The same signal means different things in
 * different environments — this is what makes the read regime-aware.
 * ========================================================================== */

const TEMPLATES: Record<RegimeName, Pick<RegimeClassification, "invalidatedBy" | "watchNext">> = {
  "Risk-on trend": { invalidatedBy: "the Nasdaq-100 losing its average price for the day or the fear gauge spiking", watchNext: "whether buyers keep control and the move stays broad" },
  "Risk-off trend": { invalidatedBy: "the Nasdaq-100 reclaiming its average price and the fear gauge calming", watchNext: "whether selling slows or accelerates into key levels" },
  "Choppy / low conviction": { invalidatedBy: "a decisive break of the day's range on stronger volume", watchNext: "for a clean break of the range before reading too much into moves" },
  "News-driven spike": { invalidatedBy: "the move fading once the headline is digested", watchNext: "whether price holds the spike or gives it back" },
  "Macro-event waiting period": { invalidatedBy: "the scheduled event passing", watchNext: "the upcoming release — moves before it tend to be low-conviction" },
  "Post-event volatility": { invalidatedBy: "volatility settling back to normal", watchNext: "where price stabilizes now that the event has passed" },
  "Narrow mega-cap-led move": { invalidatedBy: "more big companies joining (broadening) or the leaders rolling over", watchNext: "whether breadth improves to confirm the move" },
  "Broad-based rally": { invalidatedBy: "breadth narrowing or the fear gauge spiking", watchNext: "whether the broad participation holds" },
  "Broad-based selloff": { invalidatedBy: "breadth improving and the fear gauge easing", watchNext: "for signs of stabilization or capitulation" },
  "Low-volume drift": { invalidatedBy: "a pickup in volume", watchNext: "for volume to confirm any move before trusting it" },
  "High-volatility liquidation": { invalidatedBy: "volatility peaking and selling exhausting", watchNext: "for volatility to calm before the read becomes reliable" },
  "Reversal attempt": { invalidatedBy: "the reversal failing and the prior trend resuming", watchNext: "whether the turn holds or fades" },
  "Range-bound consolidation": { invalidatedBy: "a clean break of either end of the range", watchNext: "the edges of the range for the next directional clue" },
};

export function classifyRegime(s: RegimeSignals): RegimeClassification {
  const chg = s.primaryChangePct ?? 0;
  const vixUp = s.vixChangePct != null && s.vixChangePct > 4;
  const vixDown = s.vixChangePct != null && s.vixChangePct < -4;
  const yieldsDown = s.yieldsChangePct != null && s.yieldsChangePct < -0.8;
  const lowVol = s.relVol != null && s.relVol <= REL_VOLUME.light;

  let regime: RegimeName;
  let why: string;
  let confidence = 55;

  if (s.volRegime === "Extreme" && chg < -1) {
    regime = "High-volatility liquidation";
    why = "Volatility is extreme and the Nasdaq-100 is falling hard, the hallmark of forced, panicky selling.";
    confidence = 70;
  } else if (s.eventImminent) {
    regime = "Macro-event waiting period";
    why = "A high-impact economic event is due shortly, so moves right now tend to be low-conviction positioning.";
    confidence = 75;
  } else if (s.eventJustPassed) {
    regime = "Post-event volatility";
    why = "A major event just landed, so the current swing is the market digesting the result.";
    confidence = 65;
  } else if (s.newsTopImpact >= 76 && (s.intradayRangePct ?? 0) > 1.2) {
    regime = "News-driven spike";
    why = "A market-moving headline is driving an outsized move rather than a steady trend.";
    confidence = 62;
  } else if (s.trend === "Positive") {
    if (s.breadthNarrow) {
      regime = "Narrow mega-cap-led move";
      why = "The Nasdaq-100 is higher, but most of the move is coming from a couple of big names while breadth is only moderate — less reliable than a broad move.";
      confidence = 60;
    } else if (s.breadthClass === "Broad bullish") {
      regime = "Broad-based rally";
      why = "The Nasdaq-100 is rising with broad participation across the big companies, which is a healthier, more reliable move.";
      confidence = 72;
    } else if (vixDown || yieldsDown) {
      regime = "Risk-on trend";
      why = "Buyers are in control and the backdrop (calmer fear gauge / easing rates) is supportive.";
      confidence = 66;
    } else {
      regime = "Risk-on trend";
      why = "Buyers have the upper hand, though the supporting evidence is moderate.";
      confidence = 56;
    }
  } else if (s.trend === "Negative") {
    if (s.breadthClass === "Broad bearish") {
      regime = "Broad-based selloff";
      why = "The Nasdaq-100 is falling with broad participation — a genuine risk-off move, not just a couple of laggards.";
      confidence = 70;
    } else if (vixUp) {
      regime = "Risk-off trend";
      why = "Sellers are in control and the fear gauge is rising — a defensive, risk-off tone.";
      confidence = 66;
    } else {
      regime = "Risk-off trend";
      why = "Sellers have the upper hand, though conviction is moderate.";
      confidence = 56;
    }
  } else {
    if (lowVol) {
      regime = "Low-volume drift";
      why = "The Nasdaq-100 is drifting on light volume, so moves are easy to over-read.";
      confidence = 58;
    } else if ((s.intradayRangePct ?? 0) < 0.6) {
      regime = "Range-bound consolidation";
      why = "Price is stuck in a tight range with no clear winner between buyers and sellers.";
      confidence = 58;
    } else {
      regime = "Choppy / low conviction";
      why = "Signals are mixed and the action is messy, so direction is unclear right now.";
      confidence = 54;
    }
  }

  const t = TEMPLATES[regime];
  return { regime, confidence: clamp(confidence), why, invalidatedBy: t.invalidatedBy, watchNext: t.watchNext };
}
