"use client";

import { EventRiskCard } from "@/components/dashboard/event-risk";
import { MarketBriefCard } from "@/components/dashboard/market-brief-card";
import { NewsCard } from "@/components/dashboard/news-card";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/data-status";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { DemoBanner, EmptyState, Unavailable } from "@/components/ui/states";
import { TIMEZONE } from "@/lib/config";
import { useMacro, useMarketBrief, useNews } from "@/lib/query/hooks";
import { fmtClock } from "@/lib/utils";
import { CalendarClock, ChevronRight, Newspaper, PartyPopper } from "lucide-react";
import Link from "next/link";

export default function TodaysReadPage() {
  const brief = useMarketBrief();
  const news = useNews();
  const macro = useMacro();

  const isDemo = brief.data?.meta.status === "demo";

  // The most important news — clusters are already ranked by relevance, so the
  // top few are the ones that matter most for the Nasdaq-100.
  const important = (news.data?.clusters ?? []).slice(0, 6);

  const todaysEvents = (macro.data?.events ?? [])
    .filter((e) => new Date(e.time).toDateString() === new Date().toDateString())
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {isDemo ? <DemoBanner /> : null}

      {/* Today's Read — the hero: direction + confidence + why */}
      {brief.isLoading ? (
        <SkeletonCard lines={6} className="h-72" />
      ) : brief.data ? (
        <MarketBriefCard brief={brief.data.data} meta={brief.data.meta} />
      ) : (
        <Card>
          <Unavailable what="Today's read" />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Important news (2/3) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Important news"
              description="Only what matters for the Nasdaq-100 — tagged by how relevant it is."
              icon={<Newspaper className="h-4 w-4" />}
              action={
                <Link href="/news" className="flex items-center gap-0.5 text-xs text-muted hover:text-fg">
                  See more <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="space-y-2.5 p-3">
              {news.isLoading ? (
                <>
                  <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
                </>
              ) : important.length ? (
                important.map((c) => <NewsCard key={c.id} cluster={c} />)
              ) : news.data ? (
                <EmptyState
                  title="No major Nasdaq-100 news right now"
                  hint="It's quiet. We only show news that actually matters — nothing important has come through."
                  icon={<PartyPopper className="h-5 w-5" />}
                />
              ) : (
                <Unavailable what="News" />
              )}
            </div>
          </Card>
        </div>

        {/* What to watch (1/3) */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="What to watch"
              description="Scheduled events that could move things."
              icon={<CalendarClock className="h-4 w-4" />}
              action={
                <Link href="/macro" className="flex items-center gap-0.5 text-xs text-muted hover:text-fg">
                  All <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="space-y-2.5 p-3">
              {macro.isLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <>
                  {macro.data?.eventRisk ? <EventRiskCard risk={macro.data.eventRisk} /> : null}
                  {todaysEvents.length ? (
                    <ul className="divide-y divide-border">
                      {todaysEvents.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <StatusDot status={e.importance === "high" ? "unavailable" : e.importance === "medium" ? "delayed" : "cached"} />
                            <span className="truncate text-fg">{e.title}</span>
                          </span>
                          <span className="tabular shrink-0 text-faint">{fmtClock(e.time, TIMEZONE)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-1 py-2 text-xs text-faint">Nothing else scheduled today.</p>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <p className="pt-1 text-center text-2xs text-faint">
        Near-term, plain-English read for day-trading the Nasdaq-100. Informational only — not financial advice.
      </p>
    </div>
  );
}
