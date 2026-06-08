import type { EarningsEvent } from "@/lib/types";

export interface EarningsRead {
  imminent: EarningsEvent[];
  plain: string;
}

/**
 * Flags index-leader earnings due within the next few days — a known source of
 * single-stock volatility that can spill into the Nasdaq-100. Optional input.
 */
export function buildEarningsRead(earnings: EarningsEvent[] = [], now: number = Date.now(), withinDays = 3): EarningsRead {
  const cutoff = now + withinDays * 86_400_000;
  const imminent = earnings
    .filter((e) => {
      const t = new Date(e.date).getTime();
      return !Number.isNaN(t) && t >= now - 86_400_000 && t <= cutoff;
    })
    .slice(0, 5);

  const plain = imminent.length
    ? `Earnings from ${imminent.map((e) => e.name ?? e.symbol).slice(0, 3).join(", ")} are due soon, which can add single-stock volatility.`
    : "No major index-leader earnings are flagged in the next few days.";

  return { imminent, plain };
}
