import { MEGACAP_SYMBOLS, NASDAQ_LEADERS, PRIMARY_SYMBOL, SEMI_SYMBOLS, SYMBOL_NAMES } from "@/lib/config";
import type {
  Bias,
  ClarityComponent,
  ClarityLabel,
  Direction,
  EconomicEvent,
  MarketClarityScore,
  Mood,
  NewsCluster,
  Quote,
  TechnicalSummary,
} from "@/lib/types";
import { clamp, fmtPct } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Market Clarity Meter.
 *
 * Answers "how clear and supportive is the current environment?" — NOT
 * "should I buy?". Weighted components (spec §4):
 *   A News 30%  B Macro/event 20%  C Technical 20%
 *   D Breadth 15%  E Volume/volatility 10%  F Data quality 5%
 * -------------------------------------------------------------------------- */

export interface ClarityInput {
  news: NewsCluster[];
  qqqTechnical: TechnicalSummary | null;
  quotes: Record<string, Quote | null>;
  macroEvents: EconomicEvent[];
  /** Notes about stale / missing feeds, used to penalize data quality. */
  dataIssues?: string[];
  now?: number;
}

const sentVal = (s: NewsCluster["sentiment"]) => (s === "positive" ? 1 : s === "negative" ? -1 : 0);
const pct = (q: Quote | null | undefined) => (q && q.changePct !== null ? q.changePct : null);

type Signed = { score: number; bias: Bias | null; note: string };

/* ---- A. News ------------------------------------------------------------- */
function scoreNewsComponent(news: NewsCluster[]): Signed {
  const relevant = news.filter((n) => n.importance === "high" || n.importance === "market-moving").slice(0, 12);
  if (relevant.length === 0) {
    return { score: 42, bias: "Neutral", note: "Quiet news so far — nothing major for the Nasdaq-100 right now." };
  }
  const totalW = relevant.reduce((a, n) => a + n.relevanceScore, 0) || 1;
  const weighted = relevant.reduce((a, n) => a + n.relevanceScore * sentVal(n.sentiment), 0) / totalW;
  const mixedShare = relevant.filter((n) => n.sentiment === "mixed").length / relevant.length;
  const direction = Math.abs(weighted); // 0..1
  const marketMoving = relevant.some((n) => n.importance === "market-moving");

  let score = 35 + direction * 55 - mixedShare * 15 + (marketMoving ? 5 : 0);
  score = clamp(score);
  const bias: Bias = direction < 0.12 ? "Mixed" : weighted > 0 ? "Bullish" : "Bearish";
  const note =
    bias === "Mixed"
      ? "Today's headlines point in different directions."
      : bias === "Bullish"
      ? "Today's biggest headlines are mostly good for stocks."
      : "Today's biggest headlines are mostly bad for stocks.";
  return { score, bias, note };
}

/* ---- B. Macro / event risk (higher score = lower risk) ------------------- */
function scoreMacroComponent(events: EconomicEvent[], quotes: Record<string, Quote | null>, now: number): Signed {
  let score = 85;
  const notes: string[] = [];

  const upcoming = events
    .map((e) => ({ e, mins: (new Date(e.time).getTime() - now) / 60000 }))
    .filter((x) => x.mins > -30 && x.mins < 24 * 60)
    .sort((a, b) => a.mins - b.mins);

  const imminentHigh = upcoming.find((x) => x.e.importance === "high" && x.mins >= -5 && x.mins <= 90);
  if (imminentHigh) {
    score -= 55;
    notes.push(`${imminentHigh.e.title} is due very soon`);
  } else {
    const soonHigh = upcoming.find((x) => x.e.importance === "high" && x.mins <= 6 * 60);
    const soonMed = upcoming.find((x) => x.e.importance === "medium" && x.mins <= 3 * 60);
    if (soonHigh) {
      score -= 25;
      notes.push(`${soonHigh.e.title} later today`);
    } else if (soonMed) {
      score -= 12;
    }
  }

  // Interest rates + the "fear gauge" add risk.
  const tnx = pct(quotes.TNX);
  if (tnx !== null && tnx > 1.5) {
    score -= 12;
    notes.push("interest rates rising");
  } else if (tnx !== null && tnx < -1.5) {
    score += 6;
    notes.push("interest rates easing");
  }
  const vix = pct(quotes.VIX);
  if (vix !== null && vix > 6) {
    score -= 12;
    notes.push("the market's fear gauge is jumping");
  }

  return {
    score: clamp(score),
    bias: null,
    note: notes.length ? notes.join("; ") : "No big economic news coming up soon.",
  };
}

/* ---- C. Technical -------------------------------------------------------- */
function scoreTechnicalComponent(tech: TechnicalSummary | null): Signed {
  if (!tech) return { score: 45, bias: "Neutral", note: "Price-action read is unavailable." };
  let score = 50;
  score += tech.trend !== "Mixed" ? 20 : -15;
  score += tech.chopRisk === "Low" ? 15 : tech.chopRisk === "High" ? -20 : 0;
  score += tech.momentum === "Strong" ? 10 : tech.momentum === "Weak" ? -5 : 0;
  const bias: Bias = tech.trend === "Positive" ? "Bullish" : tech.trend === "Negative" ? "Bearish" : "Mixed";
  const steadiness = tech.chopRisk === "Low" ? "fairly steady" : tech.chopRisk === "High" ? "choppy" : "uneven";
  const note =
    tech.trend === "Mixed"
      ? "Price action is mixed today."
      : `Price action is leaning ${tech.trend === "Positive" ? "up" : "down"} and looks ${steadiness}.`;
  return { score: clamp(score), bias, note };
}

/* ---- D. Breadth ---------------------------------------------------------- */
function scoreBreadthComponent(quotes: Record<string, Quote | null>): Signed & { greenLeaders: string[]; redLeaders: string[]; narrow: boolean } {
  const leaders = NASDAQ_LEADERS.map((s) => ({ s, p: pct(quotes[s]) })).filter((x) => x.p !== null) as { s: string; p: number }[];
  if (leaders.length < 3) {
    return { score: 45, bias: "Neutral", note: "Not enough data on the big companies to judge how broad the move is.", greenLeaders: [], redLeaders: [], narrow: false };
  }
  const green = leaders.filter((x) => x.p > 0.1);
  const red = leaders.filter((x) => x.p < -0.1);
  const ratio = green.length / leaders.length;
  const agreement = Math.abs(ratio - 0.5) * 2; // 0..1

  // Is the index being carried by one or two names?
  const sorted = [...leaders].sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
  const totalAbs = leaders.reduce((a, x) => a + Math.abs(x.p), 0) || 1;
  const topTwoShare = (Math.abs(sorted[0].p) + Math.abs(sorted[1]?.p ?? 0)) / totalAbs;
  const narrow = topTwoShare > 0.6 && agreement < 0.4;

  let score = 40 + agreement * 55 - (narrow ? 18 : 0);
  score = clamp(score);
  const bias: Bias = agreement < 0.2 ? "Mixed" : ratio > 0.5 ? "Bullish" : "Bearish";

  const note = narrow
    ? "Only one or two big companies are driving the move, not the whole market."
    : agreement > 0.6
    ? `It's a broad move — ${green.length} of ${leaders.length} big companies are ${ratio > 0.5 ? "up" : "down"}.`
    : "The move is split — only part of the market is taking part.";

  return {
    score,
    bias,
    note,
    greenLeaders: green.map((x) => x.s),
    redLeaders: red.map((x) => x.s),
    narrow,
  };
}

/* ---- E. Volume / volatility ---------------------------------------------- */
function scoreVolVolComponent(tech: TechnicalSummary | null, quotes: Record<string, Quote | null>): Signed {
  let score = 55;
  const notes: string[] = [];
  if (tech) {
    if (tech.volume === "Heavy") {
      score += 18;
      notes.push("trading is busy, which backs up the move");
    } else if (tech.volume === "Light") {
      score -= 18;
      notes.push("trading is light");
    }
  }
  const vix = pct(quotes.VIX);
  const vixLevel = quotes.VIX?.price ?? null;
  if (vix !== null && vix > 6) {
    score -= 15;
    notes.push("the market's fear gauge is rising");
  } else if (vix !== null && vix < -4) {
    score += 8;
    notes.push("the market's fear gauge is easing");
  }
  if (vixLevel !== null && vixLevel > 25) {
    score -= 8;
    notes.push("nerves are elevated");
  }
  return { score: clamp(score), bias: null, note: notes.length ? notes.join(", ") : "Trading activity looks normal and calm." };
}

/* ---- F. Data quality ----------------------------------------------------- */
function scoreDataQuality(quotes: Record<string, Quote | null>, issues: string[]): Signed {
  let score = 100;
  const primary = quotes[PRIMARY_SYMBOL] ?? quotes.QQQ;
  if (!primary || primary.price === null) score -= 45;
  score -= Math.min(50, issues.length * 18);
  return {
    score: clamp(score),
    bias: null,
    note: issues.length ? issues.join("; ") : "Data is fresh and updating.",
  };
}

function biasToNum(b: Bias | null): number {
  return b === "Bullish" ? 1 : b === "Bearish" ? -1 : 0;
}

function labelFor(score: number): ClarityLabel {
  if (score <= 20) return "Very unclear";
  if (score <= 40) return "Weak signal";
  if (score <= 60) return "Mixed";
  if (score <= 75) return "Reasonably clear";
  if (score <= 90) return "Strong environment";
  return "Very strong, but verify";
}

const WEIGHTS = { news: 0.3, macro: 0.2, technical: 0.2, breadth: 0.15, volvol: 0.1, data: 0.05 };

export function computeMarketClarity(input: ClarityInput): MarketClarityScore {
  const now = input.now ?? Date.now();
  const issues = input.dataIssues ?? [];

  const A = scoreNewsComponent(input.news);
  const B = scoreMacroComponent(input.macroEvents, input.quotes, now);
  const C = scoreTechnicalComponent(input.qqqTechnical);
  const D = scoreBreadthComponent(input.quotes);
  const E = scoreVolVolComponent(input.qqqTechnical, input.quotes);
  const F = scoreDataQuality(input.quotes, issues);

  const components: ClarityComponent[] = [
    { key: "news", label: "The news", weight: WEIGHTS.news, score: Math.round(A.score), note: A.note },
    { key: "macro", label: "Upcoming events", weight: WEIGHTS.macro, score: Math.round(B.score), note: B.note },
    { key: "technical", label: "Price action", weight: WEIGHTS.technical, score: Math.round(C.score), note: C.note },
    { key: "breadth", label: "How broad the move is", weight: WEIGHTS.breadth, score: Math.round(D.score), note: D.note },
    { key: "volvol", label: "Activity & nerves", weight: WEIGHTS.volvol, score: Math.round(E.score), note: E.note },
    { key: "data", label: "Data freshness", weight: WEIGHTS.data, score: Math.round(F.score), note: F.note },
  ];

  let score = components.reduce((a, c) => a + c.score * c.weight, 0);

  // Agreement boost: news, technical, breadth all pointing the same way.
  const dirs = [A.bias, C.bias, D.bias].map(biasToNum);
  const allBull = dirs.every((d) => d > 0);
  const allBear = dirs.every((d) => d < 0);
  if (allBull || allBear) score += 5;

  // Penalize choppy + mixed-news combination explicitly.
  if (A.bias === "Mixed" && input.qqqTechnical?.chopRisk === "High") score -= 6;

  // Heavy data-quality penalty: cap when feeds are degraded.
  let dataQualityWarning: string | null = null;
  if (F.score < 55) {
    dataQualityWarning = `Some data is stale or missing, so this read is less reliable: ${F.note}`;
    score = Math.min(score, 58);
  }

  score = clamp(Math.round(score));
  const label = labelFor(score);

  // Overall bias from the signed components, weighted.
  const biasSum =
    biasToNum(A.bias) * WEIGHTS.news +
    biasToNum(C.bias) * WEIGHTS.technical +
    biasToNum(D.bias) * WEIGHTS.breadth;
  const bias: Bias =
    Math.abs(biasSum) < 0.06 ? (A.bias === "Mixed" || D.bias === "Mixed" ? "Mixed" : "Neutral") : biasSum > 0 ? "Bullish" : "Bearish";

  const { supporting, risks } = buildFactors(input, A, B, C, D, E, F, now);

  const newsImpact = A.note;
  const technicalSummary = plainPriceAction(input.qqqTechnical);
  const macroRisk = B.note;

  // For the summary's "because…", prefer a reason that explains *why* (not just the price move).
  const causeSupport = supporting.find((s) => !/so far today/.test(s)) ?? supporting[0];
  const summary = buildSummary(bias, score, causeSupport, risks[0]);

  return {
    score,
    label,
    bias,
    summary,
    supporting: supporting.slice(0, 3),
    risks: risks.slice(0, 3),
    components,
    dataQualityWarning,
    newsImpact,
    technicalSummary,
    macroRisk,
    generatedAt: new Date(now).toISOString(),
  };
}

function name(sym: string) {
  return SYMBOL_NAMES[sym]?.split(" ")[0] ?? sym;
}

function buildFactors(
  input: ClarityInput,
  A: Signed,
  B: Signed,
  C: Signed,
  D: ReturnType<typeof scoreBreadthComponent>,
  E: Signed,
  F: Signed,
  now: number,
): { supporting: string[]; risks: string[] } {
  const supporting: string[] = [];
  const risks: string[] = [];
  const q = input.quotes;

  // Supporting — "why it's leaning this way". NEWS + big-name moves + macro
  // ONLY. No chart/technical phrasing is exposed to the user.
  const qqqPct = pct(q[PRIMARY_SYMBOL]) ?? pct(q.QQQ);

  // Lead with the news.
  if (A.bias === "Bullish") supporting.push("Today's biggest headlines are mostly good for stocks.");
  if (A.bias === "Bearish") supporting.push("Today's biggest headlines are mostly bad for stocks.");

  // Big-name participation (factual, news-adjacent — not technical analysis).
  if (D.bias === "Bearish" && D.redLeaders.length >= 2) {
    const names = D.redLeaders.filter((s) => (MEGACAP_SYMBOLS as readonly string[]).includes(s)).slice(0, 2).map(name);
    supporting.push(`Big names like ${(names.length ? names : D.redLeaders.slice(0, 2).map(name)).join(" and ")} are dragging it down.`);
  } else if (D.bias === "Bullish" && D.greenLeaders.length >= 2) {
    const names = D.greenLeaders.filter((s) => (MEGACAP_SYMBOLS as readonly string[]).includes(s)).slice(0, 2).map(name);
    supporting.push(`Big names like ${(names.length ? names : D.greenLeaders.slice(0, 2).map(name)).join(" and ")} are lifting it.`);
  }

  if (qqqPct !== null && qqqPct < -0.2) supporting.push(`The Nasdaq-100 is down ${fmtPct(qqqPct)} so far today.`);
  else if (qqqPct !== null && qqqPct > 0.2) supporting.push(`The Nasdaq-100 is up ${fmtPct(qqqPct)} so far today.`);

  if (SEMI_SYMBOLS.some((s) => (pct(q[s]) ?? 0) < -1) && (qqqPct ?? 0) < 0) supporting.push("Chipmakers, a big part of the Nasdaq-100, are among the weakest today.");

  if (B.note.startsWith("No big")) supporting.push("No big economic news is expected in the next hour.");
  if ((pct(q.TNX) ?? 0) < -1) supporting.push("Interest rates are easing, which tends to help tech stocks.");
  if ((pct(q.TNX) ?? 0) > 1.5) supporting.push("Interest rates are rising, which tends to weigh on tech stocks.");

  // Risks / things that could change it — plain English.
  const upcomingHigh = input.macroEvents
    .map((e) => ({ e, mins: (new Date(e.time).getTime() - now) / 60000 }))
    .filter((x) => x.e.importance === "high" && x.mins > -10 && x.mins < 6 * 60)
    .sort((a, b) => a.mins - b.mins)[0];
  if (upcomingHigh) {
    const t = new Date(upcomingHigh.e.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
    risks.push(`Big economic news (${upcomingHigh.e.title}) lands at ${t} and could swing things.`);
  }
  if ((pct(q.VIX) ?? 0) > 3) risks.push("The market's fear gauge is rising — a sign of nerves.");
  if (D.narrow) risks.push("Only a few big companies are carrying the move, not the whole market.");
  else if (D.bias === "Mixed") risks.push("The move isn't broad — only part of the market is taking part.");
  if (A.bias === "Mixed") risks.push("The news is mixed, with headlines pointing both ways.");
  if (SEMI_SYMBOLS.some((s) => (pct(q[s]) ?? 0) < -0.5) && D.bias === "Bullish") risks.push("Some chipmakers are lagging behind.");
  if ((pct(q.TNX) ?? 0) > 1.5) risks.push("Rising interest rates could keep pressure on tech stocks.");
  if (F.score < 70) risks.push("Some data is delayed right now, so double-check before acting.");

  // Fallbacks so we always have three of each — all plain English.
  while (supporting.length < 3) supporting.push(["Big Nasdaq companies are active today.", "Prices are reacting to fresh news.", "The market is working normally."][supporting.length] ?? "Conditions are steady.");
  while (risks.length < 3) risks.push(["The market can move fast, especially right after it opens and before it closes.", "Always double-check the latest before acting.", "Things can change quickly — it's worth checking back later."][risks.length] ?? "Stay aware of changing conditions.");

  return { supporting, risks };
}

/** Lowercase the first letter unless the first word is an acronym (e.g. QQQ, VIX). */
function decapFirst(s: string): string {
  const firstWord = s.split(" ")[0];
  if (firstWord && firstWord === firstWord.toUpperCase()) return s; // keep acronyms
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function buildSummary(bias: Bias, score: number, topSupport: string, topRisk: string): string {
  const lead =
    score < 38
      ? "The Nasdaq-100's near-term direction isn't clear right now"
      : bias === "Bullish"
      ? "The Nasdaq-100 is leaning higher right now"
      : bias === "Bearish"
      ? "The Nasdaq-100 is leaning lower right now"
      : bias === "Mixed"
      ? "The Nasdaq-100 is mixed right now"
      : "The Nasdaq-100 is fairly quiet right now";
  const support = decapFirst((topSupport || "big Nasdaq companies are active").replace(/\.$/, ""));
  const risk = decapFirst((topRisk || "things can change quickly").replace(/\.$/, ""));
  return `${lead} because ${support}, but ${risk}.`;
}

/** A plain-English price-action sentence (no indicator jargon). */
function plainPriceAction(tech: TechnicalSummary | null): string {
  if (!tech) return "Price-action read is unavailable right now.";
  if (tech.trend === "Mixed") return "Price action is mixed today, with no clear winner.";
  const dir = tech.trend === "Positive" ? "up" : "down";
  const steady = tech.chopRisk === "Low" ? "and fairly steady" : tech.chopRisk === "High" ? "but choppy" : "but a little uneven";
  return `Price action is leaning ${dir} ${steady}.`;
}

/** Plain-English label for the 0–100 confidence score. */
export function confidenceLabel(score: number): string {
  if (score <= 20) return "Very murky";
  if (score <= 40) return "Murky";
  if (score <= 60) return "Mixed";
  if (score <= 75) return "Fairly clear";
  if (score <= 90) return "Clear";
  return "Very clear";
}

/** Derive a simple, plain Direction indicator from clarity + today's move. */
export function deriveDirection(clarity: MarketClarityScore, changePct: number | null | undefined): Direction {
  const chg = changePct ?? 0;
  if (clarity.score < 35) {
    return { state: "unclear", label: "Unclear", sentence: "The direction isn't clear right now — it may be best to wait for things to settle." };
  }
  let state: Direction["state"];
  if (chg > 0.3 || (clarity.bias === "Bullish" && chg >= 0)) state = "up";
  else if (chg < -0.3 || (clarity.bias === "Bearish" && chg <= 0)) state = "down";
  else state = "sideways";
  const map: Record<Exclude<Direction["state"], "unclear">, Direction> = {
    up: { state: "up", label: "Bullish", sentence: "The Nasdaq-100 is leaning higher right now." },
    down: { state: "down", label: "Bearish", sentence: "The Nasdaq-100 is leaning lower right now." },
    sideways: { state: "sideways", label: "Sideways", sentence: "The Nasdaq-100 is drifting sideways right now." },
  };
  return map[state];
}

/** Map clarity to a Market Brief "mood". */
export function deriveMood(clarity: MarketClarityScore, quotes: Record<string, Quote | null>): Mood {
  const vix = quotes.VIX?.changePct ?? null;
  if (vix !== null && vix > 8) return "Volatile";
  if (clarity.score <= 35) return clarity.bias === "Bearish" ? "Cautious" : "Quiet";
  if (clarity.bias === "Bullish") return "Bullish";
  if (clarity.bias === "Bearish") return "Bearish";
  if (clarity.bias === "Mixed") return "Mixed";
  return "Cautious";
}
