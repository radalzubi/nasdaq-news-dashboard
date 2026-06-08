import type { Quote } from "@/lib/types";
import { clamp } from "../core/scoring";
import { checkStale } from "../risk/staleDataGuard";
import type { DataQualityMeta, DataQualityReport, MarketSession } from "../core/types";

export interface DQInput {
  quotes: Record<string, Quote | null>;
  primarySymbol: string;
  session: MarketSession;
  newsAvailable: boolean;
  macroAvailable: boolean;
  breadthAvailable: boolean;
  meta?: DataQualityMeta;
  now?: number;
}

/** Builds the data-quality report. Never silently ignores missing data. */
export function buildDataQualityReport(input: DQInput): DataQualityReport {
  const now = input.now ?? Date.now();
  let overall = 100;
  const staleInputs: string[] = [];
  const missingInputs: string[] = [];
  const delayedInputs: string[] = [];
  const providerErrors: string[] = [...(input.meta?.providerErrors ?? [])];

  // Stale primary price (only meaningful during regular hours).
  const stale = checkStale(input.quotes, input.primarySymbol, now, 12);
  if (input.session === "regular" && stale.stalePrimary) {
    overall -= 30;
    staleInputs.push(`${input.primarySymbol} price (${stale.ageMinutes}m old)`);
  }

  // Sample / delayed sources from provider metadata.
  for (const [sym, status] of Object.entries(input.meta?.sources ?? {})) {
    if (status === "demo") {
      delayedInputs.push(`${sym} (sample)`);
      overall -= 3;
    } else if (status === "delayed" || status === "cached") {
      delayedInputs.push(`${sym} (${status})`);
      overall -= 2;
    } else if (status === "unavailable") {
      missingInputs.push(sym);
      overall -= 3;
    }
  }

  if (!input.newsAvailable) {
    missingInputs.push("news");
    overall -= 12;
  }
  if (!input.macroAvailable) {
    missingInputs.push("economic calendar");
    overall -= 8;
  }
  if (!input.breadthAvailable) {
    missingInputs.push("breadth (index leaders)");
    overall -= 6;
  }
  overall -= Math.min(15, providerErrors.length * 5);

  overall = clamp(Math.round(overall));
  const confidencePenalty = clamp(100 - overall, 0, 40);

  const bits: string[] = [];
  if (input.session === "regular" && stale.stalePrimary) bits.push("the live price looks stale, so this read is less reliable");
  if (!input.newsAvailable) bits.push("the news feed is unavailable, so news impact is unknown");
  if (!input.macroAvailable) bits.push("the economic calendar is unavailable, so event risk may be incomplete");
  if (!input.breadthAvailable) bits.push("breadth data is missing, so we don't infer breadth from the index alone");
  if (delayedInputs.length) bits.push(`some inputs are delayed or sample data (${delayedInputs.slice(0, 4).join(", ")})`);
  const warning = bits.length ? capitalize(bits.join("; ")) + "." : null;

  return { overall, staleInputs, missingInputs, delayedInputs, providerErrors, confidencePenalty, warning };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
