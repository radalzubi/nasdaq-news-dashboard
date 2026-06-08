"use client";

import { NewsCard } from "@/components/dashboard/news-card";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/ui/data-status";
import { SkeletonCard } from "@/components/ui/skeleton";
import { DemoBanner, EmptyState, Unavailable } from "@/components/ui/states";
import { useNews } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import type { NewsCategory, NewsCluster } from "@/lib/types";
import { PartyPopper } from "lucide-react";
import { useMemo, useState } from "react";

type FilterKey = "all" | "top" | "bigtech" | "chips" | "rates" | "earnings";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All important" },
  { key: "top", label: "Biggest only" },
  { key: "bigtech", label: "Big Tech" },
  { key: "chips", label: "Chipmakers" },
  { key: "rates", label: "Rates & Fed" },
  { key: "earnings", label: "Earnings" },
];

const RATE_CATS: NewsCategory[] = ["fed", "inflation", "yields", "jobs"];

function matches(c: NewsCluster, filter: FilterKey): boolean {
  switch (filter) {
    case "all": return true;
    case "top": return c.importance === "market-moving";
    case "bigtech": return c.categories.includes("megacap");
    case "chips": return c.categories.includes("semis");
    case "rates": return c.categories.some((x) => RATE_CATS.includes(x));
    case "earnings": return c.categories.includes("earnings");
  }
}

export default function NewsPage() {
  const news = useNews();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [limit, setLimit] = useState(10);

  // Clusters arrive ranked by relevance (most important first). Filters narrow
  // by topic; "Biggest only" keeps just the highest-impact stories.
  const ranked = news.data?.clusters ?? [];
  const filtered = useMemo(() => ranked.filter((c) => matches(c, filter)), [ranked, filter]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Important News"
        description="Only the news that actually matters for the Nasdaq-100 — grouped, tagged, and explained in plain English."
        action={news.data ? <DataStatusBadge meta={news.data.meta} /> : null}
      />

      {news.data?.meta.status === "demo" ? <DemoBanner /> : null}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setLimit(10); }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              filter === f.key ? "border-accent bg-accent/15 text-accent" : "border-border bg-card text-muted hover:text-fg",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {news.isLoading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : filtered.length ? (
          filtered.slice(0, limit).map((c) => <NewsCard key={c.id} cluster={c} />)
        ) : news.data ? (
          <Card>
            <EmptyState
              title="Nothing important here right now"
              hint="It's quiet for this filter. We only surface news that genuinely matters for the Nasdaq-100."
              icon={<PartyPopper className="h-5 w-5" />}
            />
          </Card>
        ) : (
          <Card><Unavailable what="News" /></Card>
        )}
      </div>

      {filtered.length > limit ? (
        <div className="text-center">
          <button onClick={() => setLimit((l) => l + 10)} className="text-sm font-medium text-accent hover:underline">
            Show more
          </button>
        </div>
      ) : null}
    </div>
  );
}
