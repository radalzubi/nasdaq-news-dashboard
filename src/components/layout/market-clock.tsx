"use client";

import { TIMEZONE } from "@/lib/config";
import { getMarketSession, type Session } from "@/lib/market-clock";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const DOT: Record<Session, string> = {
  regular: "bg-bull",
  pre: "bg-caution",
  post: "bg-info",
  closed: "bg-faint",
};

export function MarketClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Avoid SSR/client time mismatch — render a stable placeholder until mounted.
    return <div className="h-5 w-40 skeleton" aria-hidden />;
  }

  const status = getMarketSession(now);
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TIMEZONE, hour12: true });

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[status.session], status.isOpen && "animate-pulse-dot")} />
      <span className="font-medium text-fg">{status.label}</span>
      <span className="tabular text-muted">{time} ET</span>
    </div>
  );
}
