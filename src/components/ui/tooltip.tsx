"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Dependency-free hover tooltip. Positioned below the trigger by default. */
export function Tooltip({
  content,
  children,
  className,
  align = "center",
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const pos =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="relative inline-flex group/tt">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-50 mt-1.5 hidden w-max max-w-xs rounded-md border border-border-strong bg-bg-elevated px-2.5 py-1.5 text-2xs leading-relaxed text-fg shadow-lg group-hover/tt:block",
          pos,
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
