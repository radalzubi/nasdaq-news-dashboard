import { TIMEZONE } from "@/lib/config";

export type Session = "pre" | "regular" | "post" | "closed";

export interface MarketStatus {
  session: Session;
  label: string;
  isOpen: boolean;
}

/**
 * US equity market session for a given moment, in market time. Does not account
 * for exchange holidays (documented limitation).
 */
export function getMarketSession(now: Date = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday");
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(get("minute"), 10);
  const mins = hour * 60 + minute;

  if (wd === "Sat" || wd === "Sun") return { session: "closed", label: "Markets closed · weekend", isOpen: false };
  if (mins >= 570 && mins < 960) return { session: "regular", label: "Market open", isOpen: true }; // 9:30–16:00
  if (mins >= 240 && mins < 570) return { session: "pre", label: "Pre-market", isOpen: false }; // 4:00–9:30
  if (mins >= 960 && mins < 1200) return { session: "post", label: "After-hours", isOpen: false }; // 16:00–20:00
  return { session: "closed", label: "Markets closed", isOpen: false };
}
