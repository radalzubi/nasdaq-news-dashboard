"use client";

import { Badge } from "@/components/ui/badge";
import { Expandable, WhyItMatters } from "@/components/ui/explain";
import type { Importance, NewsCluster, Sentiment } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

// Plain-English "good/bad for stocks" instead of sentiment jargon.
const SENTIMENT: Record<Sentiment, { tone: "bull" | "bear" | "neutral" | "caution"; label: string }> = {
  positive: { tone: "bull", label: "Good for stocks" },
  negative: { tone: "bear", label: "Bad for stocks" },
  neutral: { tone: "neutral", label: "Neutral" },
  mixed: { tone: "caution", label: "Mixed" },
};

// Relevance to the Nasdaq-100, in plain words.
const RELEVANCE: Record<Importance, { tone: "caution" | "info" | "neutral"; label: string }> = {
  "market-moving": { tone: "caution", label: "Very relevant" },
  high: { tone: "info", label: "Relevant" },
  medium: { tone: "neutral", label: "Somewhat relevant" },
  low: { tone: "neutral", label: "Minor" },
};

export function NewsCard({ cluster, className }: { cluster: NewsCluster; className?: string }) {
  const s = SENTIMENT[cluster.sentiment];
  const rel = RELEVANCE[cluster.importance];
  const primaryUrl = cluster.items[0]?.url ?? "#";

  return (
    <article className={cn("group rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-border-strong", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={rel.tone}>{rel.label}</Badge>
        <Badge tone={s.tone}>{s.label}</Badge>
        <span className="ml-auto text-2xs text-faint">{timeAgo(cluster.lastSeen)}</span>
      </div>

      <a
        href={primaryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-sm font-semibold leading-snug text-fg hover:text-accent"
      >
        {cluster.headline}
        <ExternalLink className="ml-1 inline h-3 w-3 align-baseline text-faint" />
      </a>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-faint">
        <span className="text-muted">{cluster.sources[0]}</span>
        {cluster.articleCount > 1 ? <span>· also covered by {cluster.articleCount - 1} other{cluster.articleCount - 1 === 1 ? "" : "s"}</span> : null}
      </div>

      {cluster.summary ? <p className="mt-2 text-xs leading-relaxed text-muted">{cluster.summary}</p> : null}

      {cluster.whyItMatters ? <WhyItMatters className="mt-2">{cluster.whyItMatters}</WhyItMatters> : null}

      {cluster.articleCount > 1 ? (
        <Expandable label={`See the other ${cluster.sources.length - 1 > 0 ? cluster.sources.length - 1 : ""} report${cluster.articleCount - 1 === 1 ? "" : "s"}`.replace("  ", " ")} className="mt-2.5">
          <ul className="space-y-1">
            {cluster.items.slice(0, 6).map((it) => (
              <li key={it.id} className="text-2xs">
                <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent">
                  <span className="text-faint">{it.source}:</span> {it.headline}
                </a>
              </li>
            ))}
          </ul>
        </Expandable>
      ) : null}
    </article>
  );
}
