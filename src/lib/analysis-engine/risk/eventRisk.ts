import { computeEventRisk, type EventRisk } from "@/lib/scoring/eventRisk";

export { computeEventRisk };
export type { EventRisk };

/**
 * Event lockout: when a high-impact event is imminent or just passed, strong
 * directional signals should be suppressed (the read becomes a waiting period).
 */
export function eventLockout(er: EventRisk): { locked: boolean; clarityCap: number | null; reason: string | null } {
  if (er.inRiskWindow) {
    return { locked: true, clarityCap: 60, reason: `${er.nextEvent?.title ?? "A major event"} is in the current window` };
  }
  if (er.level === "Extreme") {
    return { locked: true, clarityCap: 62, reason: "a high-impact event is imminent" };
  }
  return { locked: false, clarityCap: null, reason: null };
}
