import { MEGACAP_SYMBOLS, SEMI_SYMBOLS } from "@/lib/config";
import type { Quote } from "@/lib/types";
import { round } from "../core/scoring";
import type { Bias, BreadthClass, BreadthRead } from "../core/types";

export interface BreadthInput {
  quotes: Record<string, Quote | null>;
  leaders: string[];
}

const pct = (q: Quote | null | undefined) => (q && q.changePct != null ? q.changePct : null);

export function buildBreadthRead(input: BreadthInput): BreadthRead {
  const rows = input.leaders.map((s) => ({ s, p: pct(input.quotes[s]) })).filter((x): x is { s: string; p: number } => x.p !== null);

  if (rows.length < 3) {
    return {
      pctGreen: null,
      pctAbovePrevClose: null,
      leadersUp: 0,
      leadersTotal: rows.length,
      classification: "Mixed",
      bias: "neutral",
      narrow: false,
      semisLeading: null,
      plain: "Not enough data on the big Nasdaq companies to judge how broad the move is.",
      degraded: true,
    };
  }

  const green = rows.filter((x) => x.p > 0.1);
  const red = rows.filter((x) => x.p < -0.1);
  const ratio = green.length / rows.length;
  const agreement = Math.abs(ratio - 0.5) * 2;

  const sorted = [...rows].sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
  const totalAbs = rows.reduce((a, x) => a + Math.abs(x.p), 0) || 1;
  const topTwoShare = (Math.abs(sorted[0].p) + Math.abs(sorted[1]?.p ?? 0)) / totalAbs;
  const narrow = topTwoShare > 0.6 && agreement < 0.4;
  const megacapDominated = narrow && (MEGACAP_SYMBOLS as readonly string[]).includes(sorted[0].s);

  const semisRows = SEMI_SYMBOLS.map((s) => pct(input.quotes[s])).filter((x): x is number => x !== null);
  const avgAll = rows.reduce((a, x) => a + x.p, 0) / rows.length;
  const avgSemis = semisRows.length ? semisRows.reduce((a, b) => a + b, 0) / semisRows.length : null;
  const semisLeading = avgSemis === null ? null : avgSemis > avgAll && avgSemis > 0;

  const bias: Bias = agreement < 0.2 ? "mixed" : ratio > 0.5 ? "bullish" : "bearish";

  let classification: BreadthClass;
  if (megacapDominated) classification = "Mega-cap dominated";
  else if (agreement < 0.2 && green.length + red.length < rows.length * 0.5) classification = "Weak participation";
  else if (narrow && ratio > 0.5) classification = "Narrow bullish";
  else if (narrow && ratio < 0.5) classification = "Narrow bearish";
  else if (agreement > 0.55 && ratio > 0.5) classification = "Broad bullish";
  else if (agreement > 0.55 && ratio < 0.5) classification = "Broad bearish";
  else classification = "Mixed";

  return {
    pctGreen: round(ratio * 100, 0),
    pctAbovePrevClose: round(ratio * 100, 0),
    leadersUp: green.length,
    leadersTotal: rows.length,
    classification,
    bias,
    narrow,
    semisLeading,
    plain: buildPlain(classification, green.length, rows.length, semisLeading),
    degraded: false,
  };
}

function buildPlain(cls: BreadthClass, up: number, total: number, semisLeading: boolean | null): string {
  const base =
    cls === "Broad bullish"
      ? `The move is broad-based — ${up} of ${total} big companies are higher — which makes it more reliable.`
      : cls === "Broad bearish"
      ? `The decline is broad — ${total - up} of ${total} big companies are lower — so it's a real risk-off move, not noise.`
      : cls === "Narrow bullish" || cls === "Mega-cap dominated"
      ? "Only a few large companies are carrying the Nasdaq higher, so the move is less convincing."
      : cls === "Narrow bearish"
      ? "Only a few large companies are pulling the Nasdaq lower right now."
      : cls === "Weak participation"
      ? "Few big companies are really moving — participation is weak."
      : "The big companies are split, with no clear leadership.";
  const semi = semisLeading === true ? " Chipmakers are leading, which often supports tech sentiment." : "";
  return base + semi;
}
