import { fmtPct } from "@/lib/utils";
import type { MacroRead } from "../features/macroFeatures";
import type {
  Anomaly,
  Bias,
  BreadthRead,
  DirectionalBias,
  MarketClarity,
  MarketDriver,
  MarketMood,
  NewsImpactReport,
  RegimeClassification,
  TechnicalRead,
  VolatilityRead,
} from "../core/types";

export interface PlainInput {
  label: string;
  primaryChangePct: number | null;
  clarity: MarketClarity;
  directionalBias: DirectionalBias;
  regime: RegimeClassification;
  news: NewsImpactReport;
  technical: TechnicalRead;
  breadth: BreadthRead;
  volatility: VolatilityRead;
  macro: MacroRead;
  anomalies: Anomaly[];
}

export function deriveMood(clarity: MarketClarity, volatility: VolatilityRead, bias: Bias): MarketMood {
  if (volatility.regime === "Extreme") return "volatile";
  if (clarity.score < 35) return "unclear";
  if (clarity.score < 45) return bias === "bearish" ? "cautious" : "quiet";
  if (bias === "bullish") return "bullish";
  if (bias === "bearish") return "bearish";
  if (bias === "mixed") return "mixed";
  return "cautious";
}

export function buildDrivers(i: PlainInput): MarketDriver[] {
  const drivers: MarketDriver[] = [];

  // Top news driver
  const topNews = i.news.items.find((n) => n.impactScore >= 45);
  if (topNews) drivers.push({ title: topNews.headline, detail: topNews.whyItMatters, weight: topNews.impactScore / 100, tickers: topNews.tickers });

  // Breadth driver
  if (i.breadth.classification === "Broad bullish" || i.breadth.classification === "Broad bearish") {
    drivers.push({ title: i.breadth.classification === "Broad bullish" ? "A broad move higher" : "A broad move lower", detail: i.breadth.plain, weight: 0.62 });
  } else if (i.breadth.narrow) {
    drivers.push({ title: "Only a few names are driving it", detail: i.breadth.plain, weight: 0.5 });
  }

  // Technical driver
  if (i.technical.inControl !== "neither") {
    drivers.push({ title: i.technical.inControl === "buyers" ? "Buyers are in control" : "Sellers are in control", detail: i.technical.plain, weight: 0.55 });
  }

  // Macro driver
  if (i.macro.supportive) drivers.push({ title: "Supportive economic backdrop", detail: i.macro.plain, weight: 0.45 });
  else if (i.macro.riskLabel === "High" || i.macro.riskLabel === "Extreme") drivers.push({ title: "A big event is on the radar", detail: i.macro.eventRisk.message, weight: 0.5 });

  // De-dup by title and take the strongest 3.
  const seen = new Set<string>();
  return drivers
    .filter((d) => (seen.has(d.title) ? false : (seen.add(d.title), true)))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
}

function decap(s: string): string {
  const w = s.split(" ")[0];
  if (w && w.length > 1 && w === w.toUpperCase()) return s; // keep multi-letter acronyms (NVDA, VIX)
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function buildSummaries(i: PlainInput, drivers: MarketDriver[]): {
  oneSentence: string;
  shortBrief: string;
  whatChanged: string;
  whyItMatters: string;
  whatToWatchNext: string;
} {
  const { label, clarity, directionalBias: db, regime } = i;
  const dirLead =
    clarity.score < 35
      ? `The ${label}'s direction isn't clear today`
      : db.bias === "bullish"
      ? `The ${label} is leaning higher today`
      : db.bias === "bearish"
      ? `The ${label} is leaning lower today`
      : db.bias === "mixed"
      ? `The ${label} is mixed today`
      : `The ${label} is fairly quiet today`;

  // Use the clause-style main driver for the "because…" (driver titles are noun phrases).
  const becauseRaw = clarity.mainDriver || drivers[0]?.title || "conditions are steady";
  const because = decap(becauseRaw.replace(/\.$/, ""));
  const risk = decap((clarity.riskFactors[0] ?? "things can change quickly").replace(/\.$/, ""));

  const oneSentence = `${dirLead} because ${because}, but ${risk}.`;
  const shortBrief = `${oneSentence} Confidence is ${clarity.score}/100 (${clarity.label.toLowerCase()}), and the environment looks like a ${regime.regime.toLowerCase()}.`;

  let whatChanged: string;
  const move = i.primaryChangePct;
  const bigAnomaly = i.anomalies.find((a) => a.severity !== "low");
  if (bigAnomaly) whatChanged = bigAnomaly.explanation;
  else if (move != null && Math.abs(move) > 0.1) whatChanged = `The ${label} is ${move > 0 ? "up" : "down"} ${fmtPct(Math.abs(move))} so far today${i.news.items[0] ? `, with attention on: ${i.news.items[0].headline}` : "."}`;
  else whatChanged = "Not much has changed — the market is fairly quiet so far today.";

  const whyItMatters = regime.why;
  const nextEvent = i.macro.eventRisk.nextEvent;
  const eventBit = nextEvent && i.macro.eventRisk.minutesUntilNext !== null && i.macro.eventRisk.minutesUntilNext >= 0 ? ` Also keep an eye on ${nextEvent.title}.` : "";
  const whatToWatchNext = `Watch ${regime.watchNext}.${eventBit}`;

  return { oneSentence, shortBrief, whatChanged, whyItMatters, whatToWatchNext };
}

// re-export for the engine
export type { Anomaly };
