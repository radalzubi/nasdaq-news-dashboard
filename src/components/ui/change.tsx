import { cn, fmtPct, fmtPrice, fmtSigned } from "@/lib/utils";

export function changeTone(v: number | null | undefined) {
  if (v === null || v === undefined || v === 0) return "text-muted";
  return v > 0 ? "text-bull" : "text-bear";
}

/** Signed percent, colored. */
export function ChangePct({ value, className, digits }: { value: number | null | undefined; className?: string; digits?: number }) {
  return <span className={cn("tabular font-medium", changeTone(value), className)}>{fmtPct(value, digits)}</span>;
}

/** Price + signed % together (e.g. for a quote header). */
export function PriceChange({
  price,
  change,
  changePct,
  currency = true,
}: {
  price: number | null;
  change?: number | null;
  changePct: number | null;
  currency?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="tabular text-lg font-semibold text-fg">{fmtPrice(price, currency)}</span>
      <span className={cn("tabular text-sm font-medium", changeTone(changePct))}>
        {fmtSigned(change)} ({fmtPct(changePct)})
      </span>
    </div>
  );
}
