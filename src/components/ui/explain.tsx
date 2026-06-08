import { cn } from "@/lib/utils";
import { ChevronDown, HelpCircle, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip";

/** Small "(i)" affordance that explains a metric on hover. */
export function InfoHint({ children, align = "center" }: { children: ReactNode; align?: "left" | "center" | "right" }) {
  return (
    <Tooltip align={align} content={<div className="max-w-[240px]">{children}</div>}>
      <HelpCircle className="h-3.5 w-3.5 text-faint hover:text-muted" />
    </Tooltip>
  );
}

/** "Why this matters" inline note — used on news + macro items. */
export function WhyItMatters({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex gap-1.5 text-xs text-muted", className)}>
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caution" />
      <span>
        <span className="font-medium text-fg/80">Why this matters: </span>
        {children}
      </span>
    </p>
  );
}

/** Native disclosure for deeper detail — keeps the page calm by default. */
export function Expandable({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <details className={cn("group", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted hover:text-fg">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        {label}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
