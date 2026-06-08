import type { Bar, Quote, Stance, TechnicalIndicator, TechnicalSummary } from "@/lib/types";
import { fmtPct, fmtPrice, round } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Technical math (pure) + a plain-English summary builder.
 *
 * The goal is to *explain* the tape to a non-technical trader, not to run a
 * TA course. Each indicator carries a one-line plain-English reading.
 * -------------------------------------------------------------------------- */

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Last EMA value of the series. */
export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

/** Wilder's RSI. Returns 0–100, or null when there isn't enough data. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Volume-weighted average price over the provided (intraday) bars. */
export function vwap(bars: Bar[]): number | null {
  if (bars.length === 0) return null;
  let pv = 0;
  let vol = 0;
  for (const b of bars) {
    const typical = (b.h + b.l + b.c) / 3;
    pv += typical * b.v;
    vol += b.v;
  }
  return vol > 0 ? pv / vol : null;
}

/** Average True Range. */
export function atr(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h;
    const l = bars[i].l;
    const pc = bars[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return sma(trs, period);
}

export interface TechInput {
  symbol: string;
  /** Today's intraday bars (oldest → newest). Used for VWAP + opening range. */
  intraday: Bar[];
  /** Daily bars (oldest → newest). Used for 50/200 SMA, RSI, ATR. */
  daily?: Bar[];
  quote?: Quote | null;
  now?: number;
}

function stanceFrom(value: number, ref: number, tolPct = 0.05): Stance {
  const diff = ((value - ref) / ref) * 100;
  if (diff > tolPct) return "bullish";
  if (diff < -tolPct) return "bearish";
  return "neutral";
}

export function buildTechnicalSummary(input: TechInput): TechnicalSummary {
  const { symbol, intraday, daily = [], quote } = input;
  const sym = symbol.toUpperCase();
  const now = input.now ?? Date.now();

  const intradayCloses = intraday.map((b) => b.c);
  const dailyCloses = daily.map((b) => b.c);

  const last =
    quote?.price ??
    (intradayCloses.length ? intradayCloses[intradayCloses.length - 1] : dailyCloses[dailyCloses.length - 1]) ??
    null;
  const prevClose = quote?.prevClose ?? (daily.length >= 2 ? daily[daily.length - 2].c : null);

  const indicators: TechnicalIndicator[] = [];
  const push = (i: TechnicalIndicator) => indicators.push(i);

  // --- VWAP -----------------------------------------------------------------
  const vw = vwap(intraday);
  if (vw !== null && last !== null) {
    const st = stanceFrom(last, vw, 0.03);
    push({
      key: "vwap",
      label: "Price vs VWAP",
      value: `${fmtPrice(last)} vs ${fmtPrice(vw)}`,
      stance: st,
      confidence: intraday.length >= 12 ? "high" : "medium",
      mattersNow: true,
      plain:
        st === "bullish"
          ? `${sym} is trading above its average price for the day, which usually means buyers are in control right now.`
          : st === "bearish"
          ? `${sym} is trading below its average price for the day, which usually means sellers have the edge right now.`
          : `${sym} is hovering around its average price for the day — neither side is clearly in control.`,
    });
  }

  // --- vs Previous close ----------------------------------------------------
  if (last !== null && prevClose) {
    const pct = ((last - prevClose) / prevClose) * 100;
    const st: Stance = pct > 0.1 ? "bullish" : pct < -0.1 ? "bearish" : "neutral";
    push({
      key: "prevClose",
      label: "Price vs prior close",
      value: `${fmtPct(pct)}`,
      stance: st,
      confidence: "high",
      mattersNow: true,
      plain:
        st === "bullish"
          ? `${sym} is up ${fmtPct(pct)} from yesterday's close — a positive start.`
          : st === "bearish"
          ? `${sym} is down ${fmtPct(pct)} from yesterday's close — a weak start.`
          : `${sym} is roughly flat versus yesterday's close.`,
    });
  }

  // --- Opening range --------------------------------------------------------
  if (intraday.length >= 3 && last !== null) {
    const orBars = intraday.slice(0, Math.min(6, intraday.length));
    const orHigh = Math.max(...orBars.map((b) => b.h));
    const orLow = Math.min(...orBars.map((b) => b.l));
    const st: Stance = last > orHigh ? "bullish" : last < orLow ? "bearish" : "neutral";
    push({
      key: "openingRange",
      label: "Opening range",
      value: `${fmtPrice(orLow)} – ${fmtPrice(orHigh)}`,
      stance: st,
      confidence: "medium",
      mattersNow: st !== "neutral",
      plain:
        st === "bullish"
          ? `${sym} has pushed above its opening range, often an early sign of strength.`
          : st === "bearish"
          ? `${sym} has slipped below its opening range, often an early sign of weakness.`
          : `${sym} is still inside its opening range — direction hasn't been chosen yet.`,
    });
  }

  // --- Short-term EMAs (9 / 21) on intraday ---------------------------------
  const ema9 = ema(intradayCloses, 9);
  const ema21 = ema(intradayCloses, 21);
  if (ema9 !== null && ema21 !== null && last !== null) {
    const aboveBoth = last > ema9 && last > ema21;
    const belowBoth = last < ema9 && last < ema21;
    const st: Stance = aboveBoth ? "bullish" : belowBoth ? "bearish" : "neutral";
    push({
      key: "shortEma",
      label: "Short-term trend (9 / 21 EMA)",
      value: `9: ${fmtPrice(ema9)} · 21: ${fmtPrice(ema21)}`,
      stance: st,
      confidence: "medium",
      mattersNow: true,
      plain:
        st === "bullish"
          ? `${sym} is holding above its short-term trend levels, which supports the up move.`
          : st === "bearish"
          ? `${sym} is trading below its short-term trend levels, which favors more weakness.`
          : `${sym} is wrestling with its short-term trend levels — no clean signal yet.`,
    });
  }

  // --- Longer-term SMAs (50 / 200) on daily ---------------------------------
  const sma50 = sma(dailyCloses, 50);
  const sma200 = sma(dailyCloses, 200);
  if (sma50 !== null && last !== null) {
    const above50 = last > sma50;
    const above200 = sma200 !== null ? last > sma200 : null;
    const st: Stance = above50 && (above200 ?? true) ? "bullish" : !above50 && above200 === false ? "bearish" : "neutral";
    push({
      key: "longSma",
      label: "Longer-term trend (50 / 200 SMA)",
      value: sma200 !== null ? `50: ${fmtPrice(sma50)} · 200: ${fmtPrice(sma200)}` : `50: ${fmtPrice(sma50)}`,
      stance: st,
      confidence: sma200 !== null ? "high" : "medium",
      mattersNow: false,
      plain:
        st === "bullish"
          ? `${sym} is above its longer-term averages — a healthier backdrop for buyers.`
          : st === "bearish"
          ? `${sym} is below its longer-term averages — a weaker backdrop overall.`
          : `${sym} is mixed against its longer-term averages.`,
    });
  }

  // --- RSI ------------------------------------------------------------------
  const rsiVal = rsi(dailyCloses.length >= 15 ? dailyCloses : intradayCloses, 14);
  if (rsiVal !== null) {
    const st: Stance = rsiVal > 60 ? "bullish" : rsiVal < 40 ? "bearish" : "neutral";
    push({
      key: "rsi",
      label: "Momentum (RSI)",
      value: `${Math.round(rsiVal)}`,
      stance: st,
      confidence: "medium",
      mattersNow: rsiVal > 70 || rsiVal < 30,
      plain:
        rsiVal > 70
          ? `${sym} is becoming stretched in the short term. That doesn't mean it must fall, but chasing here is riskier.`
          : rsiVal < 30
          ? `${sym} is quite weak short-term and may be oversold — but trying to catch a falling move is risky.`
          : st === "bullish"
          ? `Momentum is leaning positive without being overheated.`
          : st === "bearish"
          ? `Momentum is leaning negative, with sellers still active.`
          : `Momentum is balanced — neither overbought nor oversold.`,
    });
  }

  // --- Volume / relative volume --------------------------------------------
  let volStatus: TechnicalSummary["volume"] = "Normal";
  if (daily.length >= 10) {
    const avgVol = sma(daily.slice(0, -1).map((b) => b.v), Math.min(20, daily.length - 1));
    const todayVol = quote?.volume ?? daily[daily.length - 1].v;
    if (avgVol && todayVol) {
      const rel = todayVol / avgVol;
      volStatus = rel >= 1.5 ? "Heavy" : rel <= 0.7 ? "Light" : "Normal";
      push({
        key: "relVolume",
        label: "Relative volume",
        value: `${round(rel, 2)}×`,
        stance: "neutral",
        confidence: "medium",
        mattersNow: rel >= 1.5,
        plain:
          rel >= 1.5
            ? `Volume is stronger than usual, so today's move deserves more attention.`
            : rel <= 0.7
            ? `Volume is lighter than usual, so today's move may be less meaningful.`
            : `Volume is about average for this name.`,
      });
    }
  }

  // --- ATR / volatility -----------------------------------------------------
  const atrVal = atr(daily, 14);
  if (atrVal !== null && last !== null) {
    const atrPct = (atrVal / last) * 100;
    push({
      key: "atr",
      label: "Typical daily range (ATR)",
      value: `${fmtPrice(atrVal)} (${atrPct.toFixed(1)}%)`,
      stance: "neutral",
      confidence: "medium",
      mattersNow: atrPct > 2.5,
      plain:
        atrPct > 2.5
          ? `${sym} is moving more than usual, so stops and targets should account for larger swings.`
          : `${sym}'s daily swings are within a normal range.`,
    });
  }

  // --- Support / resistance from recent daily swings ------------------------
  if (daily.length >= 10 && last !== null) {
    const recent = daily.slice(-20);
    const resistance = Math.max(...recent.map((b) => b.h));
    const support = Math.min(...recent.map((b) => b.l));
    push({
      key: "levels",
      label: "Nearby levels",
      value: `Support ${fmtPrice(support)} · Resistance ${fmtPrice(resistance)}`,
      stance: "neutral",
      confidence: "medium",
      mattersNow: false,
      plain: `Recent trading puts support near ${fmtPrice(support)} and resistance near ${fmtPrice(resistance)}.`,
    });
  }

  // --- Aggregate read -------------------------------------------------------
  const stances = indicators.filter((i) => i.stance !== "neutral").map((i) => i.stance);
  const bull = stances.filter((s) => s === "bullish").length;
  const bear = stances.filter((s) => s === "bearish").length;

  const trend: TechnicalSummary["trend"] =
    bull > bear + 1 ? "Positive" : bear > bull + 1 ? "Negative" : "Mixed";

  const momentumInd = indicators.find((i) => i.key === "rsi");
  const momentum: TechnicalSummary["momentum"] =
    momentumInd?.stance === "bullish" ? "Strong" : momentumInd?.stance === "bearish" ? "Weak" : "Neutral";

  // Chop risk: high when signals disagree or volume is light.
  const disagreement = bull > 0 && bear > 0 ? Math.min(bull, bear) / Math.max(bull, bear) : 0;
  const chopRisk: TechnicalSummary["chopRisk"] =
    disagreement > 0.6 || volStatus === "Light" ? "High" : disagreement > 0.3 ? "Medium" : "Low";

  // Key level: prefer VWAP, then prior close.
  const keyLevel = vw ?? prevClose ?? last ?? null;
  const keyLevelLabel = vw ? "VWAP" : prevClose ? "Prior close" : "Last";

  const explanation = buildExplanation(sym, trend, momentum, volStatus, chopRisk, keyLevel, keyLevelLabel, momentumInd);

  return {
    symbol: sym,
    trend,
    momentum,
    volume: volStatus,
    chopRisk,
    keyLevel: keyLevel !== null ? round(keyLevel, 2) : null,
    keyLevelLabel,
    explanation,
    indicators,
    asOf: new Date(now).toISOString(),
  };
}

/**
 * Build a technical read from a live quote ALONE — used when a real-time quote
 * is available but no real bar feed is (e.g. Finnhub free tier). We deliberately
 * avoid VWAP/EMA/RSI here rather than mix a live price with sample bars.
 */
export function buildQuoteOnlyTechnical(symbol: string, quote: Quote, now: number = Date.now()): TechnicalSummary {
  const sym = symbol.toUpperCase();
  const { price, prevClose, open, dayHigh, dayLow, changePct } = quote;
  const indicators: TechnicalIndicator[] = [];

  if (price !== null && prevClose) {
    const pct = changePct ?? ((price - prevClose) / prevClose) * 100;
    const st: Stance = pct > 0.1 ? "bullish" : pct < -0.1 ? "bearish" : "neutral";
    indicators.push({
      key: "prevClose",
      label: "Price vs prior close",
      value: fmtPct(pct),
      stance: st,
      confidence: "high",
      mattersNow: true,
      plain:
        st === "bullish"
          ? `${sym} is up ${fmtPct(pct)} from yesterday's close — a positive tone.`
          : st === "bearish"
          ? `${sym} is down ${fmtPct(pct)} from yesterday's close — a weak tone.`
          : `${sym} is roughly flat versus yesterday's close.`,
    });
  }

  if (price !== null && open) {
    const st: Stance = price > open * 1.001 ? "bullish" : price < open * 0.999 ? "bearish" : "neutral";
    indicators.push({
      key: "vsOpen",
      label: "Price vs the open",
      value: `${fmtPrice(open)} → ${fmtPrice(price)}`,
      stance: st,
      confidence: "medium",
      mattersNow: false,
      plain:
        st === "bullish"
          ? `${sym} has gained ground since the open, which favors buyers today.`
          : st === "bearish"
          ? `${sym} has lost ground since the open, which favors sellers today.`
          : `${sym} is trading near where it opened.`,
    });
  }

  let rangePos: number | null = null;
  if (price !== null && dayHigh !== null && dayLow !== null && dayHigh > dayLow) {
    rangePos = (price - dayLow) / (dayHigh - dayLow);
    const st: Stance = rangePos > 0.66 ? "bullish" : rangePos < 0.34 ? "bearish" : "neutral";
    indicators.push({
      key: "dayRange",
      label: "Position in today's range",
      value: `${fmtPrice(dayLow)} – ${fmtPrice(dayHigh)}`,
      stance: st,
      confidence: "medium",
      mattersNow: false,
      plain:
        st === "bullish"
          ? `${sym} is trading in the upper part of today's range — buyers are in control.`
          : st === "bearish"
          ? `${sym} is trading in the lower part of today's range — sellers are in control.`
          : `${sym} is mid-range for the day, with no clear winner yet.`,
    });
  }

  indicators.push({
    key: "barsNote",
    label: "Intraday indicators",
    value: "limited",
    stance: "neutral",
    confidence: "low",
    mattersNow: false,
    plain: "VWAP, moving averages and RSI need an intraday bar feed, which isn't configured. Add a charts provider (e.g. Alpha Vantage) for the full read.",
  });

  const pct = changePct ?? 0;
  const trend: TechnicalSummary["trend"] = pct > 0.3 ? "Positive" : pct < -0.3 ? "Negative" : "Mixed";
  const momentum: TechnicalSummary["momentum"] =
    rangePos !== null && ((pct > 0.3 && rangePos > 0.66) || (pct < -0.3 && rangePos < 0.34)) ? "Strong" : Math.abs(pct) < 0.2 ? "Weak" : "Neutral";
  const chopRisk: TechnicalSummary["chopRisk"] =
    rangePos !== null ? (Math.abs(rangePos - 0.5) > 0.3 ? "Low" : Math.abs(rangePos - 0.5) > 0.15 ? "Medium" : "High") : "Medium";

  const keyLevel = prevClose ?? open ?? price ?? null;
  const explanation =
    trend === "Positive"
      ? `${sym} is firmer than yesterday and holding the better part of its range. Based on the live quote — intraday chart detail isn't available.`
      : trend === "Negative"
      ? `${sym} is under pressure versus yesterday and sitting low in its range. Based on the live quote — intraday chart detail isn't available.`
      : `${sym} is mixed versus yesterday with no clear intraday edge. Based on the live quote — chart detail isn't available.`;

  return {
    symbol: sym,
    trend,
    momentum,
    volume: "Normal",
    chopRisk,
    keyLevel: keyLevel !== null ? round(keyLevel, 2) : null,
    keyLevelLabel: prevClose ? "Prior close" : open ? "Open" : "Last",
    explanation,
    indicators,
    asOf: new Date(now).toISOString(),
  };
}

function buildExplanation(
  sym: string,
  trend: TechnicalSummary["trend"],
  momentum: TechnicalSummary["momentum"],
  volume: TechnicalSummary["volume"],
  chopRisk: TechnicalSummary["chopRisk"],
  keyLevel: number | null,
  keyLevelLabel: string,
  momentumInd?: TechnicalIndicator,
): string {
  const parts: string[] = [];
  if (trend === "Positive") parts.push(`The technical picture for ${sym} is moderately positive`);
  else if (trend === "Negative") parts.push(`The technical picture for ${sym} is leaning negative`);
  else parts.push(`The technical picture for ${sym} is mixed`);

  if (keyLevel !== null) parts.push(`with ${keyLevelLabel} near ${fmtPrice(keyLevel)} as the level to watch`);

  let tail = ".";
  if (momentumInd && momentumInd.value && Number(momentumInd.value) > 70) {
    tail = `, but momentum is stretched, so a pause or pullback wouldn't be surprising before another push.`;
  } else if (chopRisk === "High") {
    tail = `, but signals disagree and volume is light, so expect choppy, less predictable moves.`;
  } else if (volume === "Heavy") {
    tail = `, and heavier-than-usual volume gives today's move more weight.`;
  }
  return parts.join(" ") + tail;
}
