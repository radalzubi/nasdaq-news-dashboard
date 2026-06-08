"use client";

import { EventRiskCard } from "@/components/dashboard/event-risk";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/ui/data-status";
import { Expandable, WhyItMatters } from "@/components/ui/explain";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBanner, Unavailable } from "@/components/ui/states";
import { TIMEZONE } from "@/lib/config";
import { useMacro } from "@/lib/query/hooks";
import type { EconomicEvent } from "@/lib/types";
import { fmtClock } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: TIMEZONE });
}

const impTone = (i: EconomicEvent["importance"]): "bear" | "caution" | "neutral" =>
  i === "high" ? "bear" : i === "medium" ? "caution" : "neutral";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="text-center">
      <p className="text-2xs uppercase tracking-wide text-faint">{label}</p>
      <p className="tabular text-xs font-medium text-fg">{value ?? "—"}</p>
    </div>
  );
}

function EventRow({ e }: { e: EconomicEvent }) {
  const released = e.actual !== null && e.actual !== undefined;
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={impTone(e.importance)}>{e.importance === "high" ? "High impact" : e.importance === "medium" ? "Medium" : "Low"}</Badge>
            {released ? (
              <span className="flex items-center gap-0.5 text-2xs text-info">
                {e.surprise === "above" ? <ArrowUp className="h-3 w-3" /> : e.surprise === "below" ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {e.surprise === "inline" ? "As expected" : e.surprise === "above" ? "Higher than expected" : e.surprise === "below" ? "Lower than expected" : "Just released"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-fg">{e.title}</p>
        </div>
        <span className="tabular shrink-0 text-xs text-muted">{fmtClock(e.time, TIMEZONE)}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-md border border-border bg-bg-elevated px-3 py-2">
        <Field label="Last time" value={e.previous} />
        <Field label="Expected" value={e.forecast} />
        <Field label="Actual" value={e.actual} />
      </div>

      <Expandable label="Why this matters" className="mt-2">
        <WhyItMatters>{e.whyItMatters}</WhyItMatters>
      </Expandable>
    </div>
  );
}

export default function MacroPage() {
  const macro = useMacro();
  const events = macro.data?.events ?? [];

  // Group by day label, preserving chronological order.
  const groups: { label: string; events: EconomicEvent[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.time);
    const g = groups.find((x) => x.label === label);
    if (g) g.events.push(e);
    else groups.push({ label, events: [e] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="What to Watch"
        description="Upcoming events that could move the Nasdaq-100 — and why each one matters, in plain English."
        action={macro.data ? <DataStatusBadge meta={macro.data.meta} /> : null}
      />

      {macro.data?.meta.status === "demo" ? <DemoBanner /> : null}

      {macro.isLoading ? (
        <Skeleton className="h-24" />
      ) : macro.data?.eventRisk ? (
        <EventRiskCard risk={macro.data.eventRisk} />
      ) : null}

      {macro.isLoading ? (
        <Skeleton className="h-64" />
      ) : groups.length ? (
        groups.map((g) => (
          <Card key={g.label}>
            <CardHeader title={g.label} description={`${g.events.length} ${g.events.length === 1 ? "event" : "events"}`} />
            <div className="divide-y divide-border">
              {g.events.map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </div>
          </Card>
        ))
      ) : (
        <Card><Unavailable what="Economic calendar" /></Card>
      )}
    </div>
  );
}
