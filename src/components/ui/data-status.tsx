"use client";

import type { DataMeta, DataStatus } from "@/lib/types";
import { cn, fmtClock, timeAgo } from "@/lib/utils";
import { TIMEZONE } from "@/lib/config";
import { Tooltip } from "./tooltip";

const META: Record<DataStatus, { label: string; dot: string; text: string }> = {
  live: { label: "Live", dot: "bg-bull", text: "text-bull" },
  delayed: { label: "Delayed", dot: "bg-caution", text: "text-caution" },
  cached: { label: "Cached", dot: "bg-info", text: "text-info" },
  demo: { label: "Sample data", dot: "bg-macro", text: "text-macro" },
  unavailable: { label: "Unavailable", dot: "bg-bear", text: "text-bear" },
};

export function StatusDot({ status, className }: { status: DataStatus; className?: string }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full", META[status].dot, status === "live" && "animate-pulse-dot", className)}
      aria-hidden
    />
  );
}

/** Compact provenance badge: source + freshness, with a hover detail. */
export function DataStatusBadge({ meta, className }: { meta: DataMeta; className?: string }) {
  const m = META[meta.status];
  return (
    <Tooltip
      align="right"
      content={
        <div className="space-y-0.5">
          <div className="font-medium text-fg">{m.label} · {meta.source}</div>
          {meta.asOf ? <div className="text-muted">As of {fmtClock(meta.asOf, TIMEZONE)}</div> : null}
          <div className="text-muted">Updated {timeAgo(meta.fetchedAt)}</div>
          {meta.note ? <div className="mt-1 text-faint">{meta.note}</div> : null}
        </div>
      }
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-2xs text-muted",
          className,
        )}
      >
        <StatusDot status={meta.status} />
        <span className={cn("font-medium", m.text)}>{m.label}</span>
        <span className="text-faint">· {meta.source}</span>
      </span>
    </Tooltip>
  );
}
