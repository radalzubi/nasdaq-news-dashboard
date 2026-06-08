"use client";

import { isIndexSymbol } from "@/lib/config";
import { useMarketBrief } from "@/lib/query/hooks";
import { cn, fmtPct, fmtPrice } from "@/lib/utils";
import { changeTone } from "@/components/ui/change";
import { MoodBadge } from "@/components/dashboard/mood-badge";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { MarketClock } from "./market-clock";
import { SidebarContent } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-bg-elevated lg:block lg:h-screen lg:sticky lg:top-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-bg-elevated">
            <button
              className="absolute right-2 top-3 text-muted hover:text-fg"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur">
          <button className="text-muted hover:text-fg lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <MarketClock />
          <div className="ml-auto">
            <GlobalPulse />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function GlobalPulse() {
  const { data } = useMarketBrief();
  const q = data?.data.headlineQuote;
  if (!data) return null;
  return (
    <div className="flex items-center gap-3">
      {q ? (
        <div className="hidden items-baseline gap-1.5 sm:flex">
          <span className="text-xs font-semibold text-fg">{q.symbol === "NDX" ? "NDX" : q.symbol}</span>
          <span className="tabular text-xs text-muted">{fmtPrice(q.price, !isIndexSymbol(q.symbol))}</span>
          <span className={cn("tabular text-xs font-medium", changeTone(q.changePct))}>{fmtPct(q.changePct)}</span>
        </div>
      ) : null}
      <MoodBadge mood={data.data.mood} />
    </div>
  );
}
