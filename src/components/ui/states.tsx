import { cn } from "@/lib/utils";
import { AlertTriangle, Info, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="text-faint">{icon ?? <Info className="h-5 w-5" />}</span>
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

/** Clean "feed unavailable" state — used instead of ever showing fake data. */
export function Unavailable({ what, note }: { what: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <WifiOff className="h-5 w-5 text-bear" />
      <p className="text-sm font-medium text-fg">{what} is unavailable</p>
      <p className="max-w-sm text-xs text-muted">
        {note ?? "The data source did not respond. Nothing is shown rather than guessed — try again shortly or check Settings → Data sources."}
      </p>
    </div>
  );
}

/** Prominent banner shown when the dashboard is running on sample data. */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-macro/30 bg-macro-soft/50 px-3.5 py-2.5 text-xs",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-macro" />
      <div className="text-fg">
        <span className="font-semibold text-macro">Sample data mode.</span> No live API keys are
        configured, so prices, news, and events below are <span className="font-medium">illustrative samples — not real market data</span>.
        Add keys in{" "}
        <a href="/settings" className="underline underline-offset-2 hover:text-macro">
          Settings
        </a>{" "}
        to go live.
      </div>
    </div>
  );
}
