import { computeEventRisk, type EventRisk } from "@/lib/scoring/eventRisk";
import type { EconomicEvent, Quote } from "@/lib/types";
import { clamp } from "../core/scoring";

export type MacroRiskLabel = "Low" | "Moderate" | "High" | "Extreme";

export interface MacroRead {
  /** 0–100, higher = MORE risk. */
  riskScore: number;
  riskLabel: MacroRiskLabel;
  eventRisk: EventRisk;
  plain: string;
  supportive: boolean;
  degraded: boolean;
}

export interface MacroInput {
  events: EconomicEvent[];
  quotes: Record<string, Quote | null>;
  now?: number;
  available: boolean;
}

const pct = (q: Quote | null | undefined) => (q && q.changePct != null ? q.changePct : null);

export function buildMacroRead(input: MacroInput): MacroRead {
  const now = input.now ?? Date.now();
  const er = computeEventRisk(input.events, now);

  let risk = er.level === "Extreme" ? 85 : er.level === "High" ? 65 : er.level === "Medium" ? 42 : 18;

  const tnx = pct(input.quotes.TNX);
  const vix = pct(input.quotes.VIX);
  const yieldsUp = tnx != null && tnx > 1.5;
  const yieldsDown = tnx != null && tnx < -1.5;
  const vixUp = vix != null && vix > 6;

  if (yieldsUp) risk += 10;
  if (vixUp) risk += 10;
  if (yieldsDown && !er.inRiskWindow) risk -= 8;
  risk = clamp(risk);

  const riskLabel: MacroRiskLabel = risk <= 25 ? "Low" : risk <= 50 ? "Moderate" : risk <= 75 ? "High" : "Extreme";

  // Supportive backdrop: low event risk + easing rates.
  const supportive = risk <= 30 && (yieldsDown || (tnx != null && tnx <= 0));

  const parts: string[] = [er.message];
  if (yieldsUp) parts.push("Higher interest rates can pressure the Nasdaq because tech stocks are sensitive to rate expectations.");
  else if (yieldsDown) parts.push("Lower interest rates tend to support the Nasdaq because future profits look more attractive.");
  if (vixUp && (pct(input.quotes.QQQ) ?? pct(input.quotes.NDX) ?? 0) > 0) parts.push("The market's fear gauge is rising even as stocks rise — a caution sign.");
  if (supportive) parts.push("Overall the backdrop looks supportive.");

  return {
    riskScore: risk,
    riskLabel,
    eventRisk: er,
    plain: parts.join(" "),
    supportive,
    degraded: !input.available,
  };
}
