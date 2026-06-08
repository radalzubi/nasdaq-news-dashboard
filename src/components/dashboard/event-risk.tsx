import { Badge } from "@/components/ui/badge";
import type { EventRisk } from "@/lib/scoring/eventRisk";
import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck } from "lucide-react";

const LEVEL: Record<EventRisk["level"], { tone: "bull" | "caution" | "bear"; ring: string }> = {
  Low: { tone: "bull", ring: "border-bull/30" },
  Medium: { tone: "caution", ring: "border-caution/30" },
  High: { tone: "caution", ring: "border-caution/40" },
  Extreme: { tone: "bear", ring: "border-bear/40" },
};

export function EventRiskCard({ risk }: { risk: EventRisk }) {
  const cfg = LEVEL[risk.level];
  const calm = risk.level === "Low";
  return (
    <div className={cn("rounded-lg border bg-card p-3.5", cfg.ring, risk.inRiskWindow && "bg-caution-soft/20")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {calm ? <ShieldCheck className="h-4 w-4 text-bull" /> : <ShieldAlert className="h-4 w-4 text-caution" />}
          Event risk
        </span>
        <Badge tone={cfg.tone}>{risk.level}</Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-fg">{risk.message}</p>
      {risk.nextEvent && risk.minutesUntilNext !== null && risk.minutesUntilNext >= 0 ? (
        <p className="mt-1.5 text-2xs text-faint">
          Next: <span className="text-muted">{risk.nextEvent.title}</span>
          {risk.minutesUntilNext < 600 ? ` · in ${risk.minutesUntilNext < 60 ? `${risk.minutesUntilNext} min` : `${(risk.minutesUntilNext / 60).toFixed(1)}h`}` : ""}
        </p>
      ) : null}
    </div>
  );
}
