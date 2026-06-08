import { changeTone } from "@/components/ui/change";
import { Tooltip } from "@/components/ui/tooltip";
import { isIndexSymbol, SYMBOL_NAMES } from "@/lib/config";
import type { DataStatus, Quote } from "@/lib/types";
import { cn, fmtPct, fmtPrice } from "@/lib/utils";

/** Compact instrument tile used in the index strip. */
export function QuoteChip({
  quote,
  symbol,
  status,
}: {
  quote: Quote | null | undefined;
  symbol: string;
  status?: DataStatus;
}) {
  const sym = symbol.toUpperCase();
  const label = SYMBOL_NAMES[sym]?.split(" ")[0] ?? sym;
  const isSample = status === "demo";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold text-fg">
          {sym}
          {isSample ? (
            <Tooltip align="left" content="Sample data — no live feed for this symbol. Add a macro provider (FRED) to go live.">
              <span className="h-1.5 w-1.5 rounded-full bg-macro" aria-label="sample data" />
            </Tooltip>
          ) : null}
        </span>
        <span className={cn("tabular text-xs font-medium", changeTone(quote?.changePct))}>{fmtPct(quote?.changePct)}</span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="tabular text-sm text-fg">{fmtPrice(quote?.price ?? null, !isIndexSymbol(sym))}</span>
      </div>
      <p className="mt-0.5 truncate text-2xs text-faint">{label}</p>
    </div>
  );
}
