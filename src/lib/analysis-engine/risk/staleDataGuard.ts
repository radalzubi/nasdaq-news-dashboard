import type { Quote } from "@/lib/types";

export interface StaleResult {
  stalePrimary: boolean;
  staleSymbols: string[];
  ageMinutes: number | null;
}

/** Flags quotes whose timestamp is older than `maxAgeMin` (during regular hours). */
export function checkStale(
  quotes: Record<string, Quote | null>,
  primarySymbol: string,
  now: number = Date.now(),
  maxAgeMin = 10,
): StaleResult {
  const stale: string[] = [];
  let primaryAge: number | null = null;
  for (const [sym, q] of Object.entries(quotes)) {
    if (!q?.asOf) continue;
    const age = (now - new Date(q.asOf).getTime()) / 60000;
    if (sym === primarySymbol) primaryAge = age;
    if (age > maxAgeMin) stale.push(sym);
  }
  return { stalePrimary: stale.includes(primarySymbol), staleSymbols: stale, ageMinutes: primaryAge !== null ? Math.round(primaryAge) : null };
}
