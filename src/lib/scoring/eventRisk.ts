import type { EconomicEvent } from "@/lib/types";
import { TIMEZONE } from "@/lib/config";

export interface EventRisk {
  level: "Low" | "Medium" | "High" | "Extreme";
  nextEvent: EconomicEvent | null;
  minutesUntilNext: number | null;
  inRiskWindow: boolean;
  message: string;
}

/** Translate the calendar into a single, plain-English "event risk" read. */
export function computeEventRisk(events: EconomicEvent[], now = Date.now()): EventRisk {
  const future = events
    .map((e) => ({ e, mins: (new Date(e.time).getTime() - now) / 60000 }))
    .filter((x) => x.mins > -20)
    .sort((a, b) => a.mins - b.mins);

  const next = future[0]?.e ?? null;
  const minutesUntilNext = future[0] ? Math.round(future[0].mins) : null;

  const high = future.find((x) => x.e.importance === "high");
  const med = future.find((x) => x.e.importance === "medium");

  let level: EventRisk["level"] = "Low";
  if (high && high.mins <= 30) level = "Extreme";
  else if (high && high.mins <= 120) level = "High";
  else if ((high && high.mins <= 360) || (med && med.mins <= 60)) level = "Medium";

  const inRiskWindow = Boolean(high && high.mins >= -15 && high.mins <= 30);

  let message: string;
  const fmtIn = (m: number) => (m <= 0 ? "now" : m < 60 ? `in ${Math.round(m)} min` : `in ${(m / 60).toFixed(1)}h`);
  if (high && high.mins <= 30) {
    message = `${high.e.title} is due ${fmtIn(high.mins)}. Market moves may become less predictable around the release.`;
  } else if (high) {
    const t = new Date(high.e.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIMEZONE });
    message = `${high.e.title} is scheduled for ${t} — a high-impact release to watch.`;
  } else if (med && med.mins <= 60) {
    message = `${med.e.title} is due ${fmtIn(med.mins)}. Some added volatility is possible.`;
  } else {
    message = "No major economic releases are imminent. The event backdrop is calm.";
  }

  return { level, nextEvent: next, minutesUntilNext, inRiskWindow, message };
}
