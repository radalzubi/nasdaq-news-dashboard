import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const badge = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-bg-elevated text-muted",
        bull: "border-transparent bg-bull-soft text-bull",
        bear: "border-transparent bg-bear-soft text-bear",
        caution: "border-transparent bg-caution-soft text-caution",
        info: "border-transparent bg-info-soft text-info",
        macro: "border-transparent bg-macro-soft text-macro",
        outline: "border-border-strong bg-transparent text-fg",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
