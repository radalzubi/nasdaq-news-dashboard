import type { Bar, Quote } from "@/lib/types";
import { ANOMALY_Z } from "../core/config";
import { robustZ, round } from "../core/scoring";
import type { Anomaly, Bias, NewsImpactReport } from "../core/types";

export interface AnomalyInput {
  quote: Quote | null;
  daily: Bar[];
  news: NewsImpactReport;
  breadthBias: Bias;
  primaryChangePct: number | null;
  eventImminent: boolean;
}

/** Robust, distribution-based anomaly detection (median + MAD z-scores). */
export function detectAnomalies(i: AnomalyInput): Anomaly[] {
  const out: Anomaly[] = [];
  const daily = i.daily;

  // Build past daily return + volume distributions (exclude today).
  const past = daily.slice(0, -1);
  const returns: number[] = [];
  for (let k = 1; k < past.length; k++) {
    if (past[k - 1].c > 0) returns.push(((past[k].c - past[k - 1].c) / past[k - 1].c) * 100);
  }
  const volumes = past.map((b) => b.v).filter((v) => v > 0);

  // Unusual move
  if (returns.length >= 20 && i.primaryChangePct != null) {
    const z = robustZ(i.primaryChangePct, returns);
    if (Math.abs(z) >= ANOMALY_Z.unusual) {
      out.push({
        type: "unusual-move",
        severity: Math.abs(z) >= ANOMALY_Z.extreme ? "high" : "medium",
        explanation: `Today's ${i.primaryChangePct >= 0 ? "gain" : "drop"} of ${round(i.primaryChangePct, 2)}% is unusually large versus the recent norm.`,
        trust: "investigate",
        zScore: round(z, 2),
      });
    }
  }

  // Unusual volume
  if (volumes.length >= 20 && i.quote?.volume) {
    const z = robustZ(i.quote.volume, volumes);
    if (z >= ANOMALY_Z.unusual) {
      out.push({
        type: "unusual-volume",
        severity: z >= ANOMALY_Z.extreme ? "high" : "medium",
        explanation: "Trading volume is unusually high today, so the move deserves more attention.",
        trust: "trust",
        zScore: round(z, 2),
      });
    }
  }

  // Large gap
  const prevClose = i.quote?.prevClose ?? (daily.length >= 2 ? daily[daily.length - 2].c : null);
  if (prevClose && i.quote?.open != null) {
    const gapPct = ((i.quote.open - prevClose) / prevClose) * 100;
    if (Math.abs(gapPct) > 1.5) {
      out.push({ type: "large-gap", severity: Math.abs(gapPct) > 3 ? "high" : "medium", explanation: `The market opened with a large ${gapPct >= 0 ? "up" : "down"} gap of ${round(gapPct, 2)}%.`, trust: "trust" });
    }
  }

  // News spike
  const bigNews = i.news.items.filter((n) => n.impactScore >= 76).length;
  if (bigNews >= 2) {
    out.push({ type: "news-spike", severity: bigNews >= 3 ? "high" : "medium", explanation: `${bigNews} market-moving headlines are hitting at once.`, trust: "investigate" });
  }

  // QQQ vs leaders divergence
  if (i.primaryChangePct != null && Math.abs(i.primaryChangePct) > 0.3) {
    const primaryBias: Bias = i.primaryChangePct > 0 ? "bullish" : "bearish";
    if (i.breadthBias !== "neutral" && i.breadthBias !== "mixed" && i.breadthBias !== primaryBias) {
      out.push({ type: "qqq-leader-divergence", severity: "medium", explanation: "The index is moving one way while most big companies move the other — a divergence worth watching.", trust: "investigate" });
    }
  }

  // Pre-event move
  if (i.eventImminent && i.primaryChangePct != null && Math.abs(i.primaryChangePct) > 0.6) {
    out.push({ type: "pre-event-move", severity: "medium", explanation: "There's a notable move right before a scheduled high-impact event, which can reverse quickly.", trust: "investigate" });
  }

  return out;
}
