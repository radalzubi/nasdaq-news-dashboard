import type { MacroRead } from "../features/macroFeatures";
import type { BreadthRead, Conflict, LiquidityRead, NewsImpactReport, TechnicalRead, VolatilityRead } from "../core/types";

export interface ConflictInput {
  news: NewsImpactReport;
  technical: TechnicalRead;
  breadth: BreadthRead;
  volatility: VolatilityRead;
  liquidity: LiquidityRead;
  macro: MacroRead;
  primaryChangePct: number | null;
  eventImminent: boolean;
}

/** Detect signals that disagree — these reduce clarity and are surfaced plainly. */
export function detectConflicts(i: ConflictInput): Conflict[] {
  const out: Conflict[] = [];
  const chg = i.primaryChangePct ?? 0;
  const up = chg > 0.2;
  const down = chg < -0.2;

  const add = (id: string, severity: Conflict["severity"], explanation: string, clarityImpact: number, watch: string) =>
    out.push({ id, severity, explanation, clarityImpact, watch });

  // Bullish news but bearish price action (and vice versa)
  if (i.news.netSentiment === "bullish" && down) add("news-vs-price", "medium", "The news is good, but the Nasdaq-100 is falling — price isn't backing up the headlines.", 6, "whether price turns up to match the news, or the news is already priced in.");
  if (i.news.netSentiment === "bearish" && up) add("news-vs-price-2", "medium", "The news is bad, but the Nasdaq-100 is rising — be careful, the bounce may not hold.", 6, "whether the rally holds despite the negative news.");

  // Index green but breadth weak
  if (up && i.breadth.narrow) add("price-vs-breadth", "medium", "The Nasdaq-100 is higher, but only a few big companies are doing the work — the move may depend on a handful of stocks.", 6, "whether more companies join the move.");

  // Above VWAP but fear gauge rising
  if (i.technical.inControl === "buyers" && i.volatility.vixChangePct != null && i.volatility.vixChangePct > 4) add("buyers-vs-vix", "low", "Buyers are in control, but the market's fear gauge is rising at the same time — a quiet caution sign.", 4, "whether the fear gauge keeps climbing.");

  // Mega-cap strength but chips weak
  if (up && i.breadth.semisLeading === false) add("megacap-vs-semis", "low", "Big tech is helping, but chipmakers are lagging, which makes the tech move less unified.", 3, "whether chipmakers catch up or keep dragging.");

  // Positive technicals but high macro risk
  if (i.technical.trend === "Positive" && (i.macro.riskLabel === "High" || i.macro.riskLabel === "Extreme")) add("tech-vs-macro", "medium", "Price action looks positive, but a major economic event is near — that can override the chart quickly.", 5, "the upcoming event; positioning before it is risky.");

  // Strong move on weak volume
  if ((up || down) && Math.abs(chg) > 0.6 && i.liquidity.classification === "Risky") add("move-vs-volume", "medium", "It's a sizable move, but volume is very light, so it may not be trustworthy.", 5, "whether volume picks up to confirm the move.");

  // Rising into an event with low conviction
  if (up && i.eventImminent && (i.technical.chopRiskScore > 60 || i.breadth.narrow)) add("rally-into-event", "low", "The market is drifting higher right before a major event without strong conviction.", 3, "the event result, which is likely to set the next direction.");

  return out;
}
