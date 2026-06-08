"use client";

import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import { CandlestickChart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "./nav";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-accent">
          <CandlestickChart className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-fg">{APP_NAME}</span>
          <span className="block text-2xs text-faint">Informational only · not advice</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-faint">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active ? "bg-card-hover font-medium text-fg" : "text-muted hover:bg-card-hover/60 hover:text-fg",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-faint")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3 text-2xs leading-relaxed text-faint">
        Not financial advice. This tool does not place trades or recommend buying or selling.
      </div>
    </div>
  );
}
