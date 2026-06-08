import type { JournalEntry } from "@/lib/types";

export interface JournalAnalytics {
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number | null;
  totalPnl: number;
  bestSetup: string | null;
  worstSetup: string | null;
  bestHour: string | null;
  mostCommonMistake: string | null;
}

/** Derive a P/L from the trade fields when not explicitly provided. */
export function derivePnl(e: Pick<JournalEntry, "direction" | "entry" | "exit" | "size" | "pnl">): number | null {
  if (e.pnl !== null && e.pnl !== undefined) return e.pnl;
  if (e.exit === null || e.exit === undefined || !e.size) return null;
  const perShare = e.direction === "long" ? e.exit - e.entry : e.entry - e.exit;
  return +(perShare * e.size).toFixed(2);
}

export function computeJournalAnalytics(entries: JournalEntry[]): JournalAnalytics {
  const withPnl = entries.map((e) => ({ e, pnl: derivePnl(e) })).filter((x) => x.pnl !== null) as { e: JournalEntry; pnl: number }[];
  const closedTrades = withPnl.length;
  const wins = withPnl.filter((x) => x.pnl > 0);
  const losses = withPnl.filter((x) => x.pnl < 0);
  const grossWin = wins.reduce((a, x) => a + x.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, x) => a + x.pnl, 0));

  const bySetup = new Map<string, number>();
  for (const x of withPnl) {
    const k = x.e.setup?.trim() || "Unspecified";
    bySetup.set(k, (bySetup.get(k) ?? 0) + x.pnl);
  }
  const setupSorted = [...bySetup.entries()].sort((a, b) => b[1] - a[1]);

  const byHour = new Map<string, number>();
  for (const x of withPnl) {
    const d = new Date(x.e.date);
    const hour = Number.isNaN(d.getTime()) ? "—" : `${d.getHours()}:00`;
    byHour.set(hour, (byHour.get(hour) ?? 0) + x.pnl);
  }
  const hourSorted = [...byHour.entries()].sort((a, b) => b[1] - a[1]);

  const mistakeCounts = new Map<string, number>();
  for (const e of entries) for (const m of e.mistakes ?? []) mistakeCounts.set(m, (mistakeCounts.get(m) ?? 0) + 1);
  const mistakeSorted = [...mistakeCounts.entries()].sort((a, b) => b[1] - a[1]);

  return {
    totalTrades: entries.length,
    closedTrades,
    wins: wins.length,
    losses: losses.length,
    winRate: closedTrades ? +((wins.length / closedTrades) * 100).toFixed(1) : null,
    avgWin: wins.length ? +(grossWin / wins.length).toFixed(2) : null,
    avgLoss: losses.length ? +(-grossLoss / losses.length).toFixed(2) : null,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? Infinity : null,
    totalPnl: +withPnl.reduce((a, x) => a + x.pnl, 0).toFixed(2),
    bestSetup: setupSorted.length ? setupSorted[0][0] : null,
    worstSetup: setupSorted.length ? setupSorted[setupSorted.length - 1][0] : null,
    bestHour: hourSorted.length ? hourSorted[0][0] : null,
    mostCommonMistake: mistakeSorted.length ? mistakeSorted[0][0] : null,
  };
}
