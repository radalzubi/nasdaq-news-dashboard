import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/ui/data-status";
import type { DataMeta, Direction, MarketBrief } from "@/lib/types";
import { cn, fmtPct } from "@/lib/utils";
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, HelpCircle } from "lucide-react";
import { FactorList, plainConfidence } from "./clarity";

const VERDICT: Record<Direction["state"], { word: string; tone: string; Icon: typeof ArrowUpRight; chip: string }> = {
  up: { word: "Bullish", tone: "text-bull", Icon: ArrowUpRight, chip: "bg-bull-soft text-bull" },
  down: { word: "Bearish", tone: "text-bear", Icon: ArrowDownRight, chip: "bg-bear-soft text-bear" },
  sideways: { word: "Mixed", tone: "text-caution", Icon: ArrowRightLeft, chip: "bg-caution-soft text-caution" },
  unclear: { word: "Unclear", tone: "text-muted", Icon: HelpCircle, chip: "bg-bg-elevated text-muted" },
};

function Tile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-bg-elevated p-3.5", className)}>
      <p className="text-2xs font-semibold uppercase tracking-wide text-faint">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function MarketBriefCard({ brief, meta }: { brief: MarketBrief; meta: DataMeta }) {
  const c = brief.clarity;
  const move = brief.headlineQuote?.changePct ?? null;
  const v = VERDICT[brief.direction.state];
  const VIcon = v.Icon;
  const moveTone = move === null ? "text-muted" : move > 0 ? "text-bull" : move < 0 ? "text-bear" : "text-muted";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-fg">
          Nasdaq-100 · Right Now <span className="font-normal text-faint">· near-term read</span>
        </h2>
        <DataStatusBadge meta={meta} />
      </div>

      <div className="p-4">
        {/* The call + confidence — the two things that matter, front and center */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="The call">
            <div className="flex items-center gap-2">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", v.chip)}>
                <VIcon className="h-5 w-5" />
              </span>
              <span className={cn("text-2xl font-bold", v.tone)}>{v.word}</span>
            </div>
            <p className="mt-1 text-2xs text-faint">{brief.direction.sentence}</p>
          </Tile>

          <Tile label="Confidence">
            <div className="flex items-baseline gap-3">
              <span className={cn("tabular text-2xl font-bold", c.score <= 40 ? "text-bear" : c.score <= 60 ? "text-caution" : c.score <= 75 ? "text-info" : "text-bull")}>
                {c.score}
                <span className="text-sm font-normal text-faint">/100</span>
              </span>
              <span className="text-sm font-medium text-fg">{plainConfidence(c.score)}</span>
            </div>
            <p className="mt-1 text-2xs text-faint">How clear the near-term picture is</p>
          </Tile>

          <Tile label="Nasdaq-100 today">
            <div className="flex items-baseline gap-1.5">
              <span className={cn("tabular text-2xl font-bold", moveTone)}>{fmtPct(move)}</span>
            </div>
            <p className="mt-1 text-2xs text-faint">Change so far today</p>
          </Tile>
        </div>

        {/* What's happening — plain, news-framed */}
        <p className="mt-4 text-base leading-relaxed text-fg">{brief.summary}</p>

        {/* Honest day-trading disclaimer */}
        <p className="mt-2 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-2xs leading-relaxed text-faint">
          ⚡ <span className="text-muted">Near-term read for day trading.</span> Direction over the next 15–30 minutes is
          inherently noisy and is <span className="text-muted">not back-tested</span> at this timeframe — use it for
          awareness, not as a guaranteed signal. Informational only.
        </p>

        {c.dataQualityWarning ? (
          <p className="mt-2 rounded-md border border-caution/30 bg-caution-soft/40 px-2.5 py-1.5 text-xs text-caution">{c.dataQualityWarning}</p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-faint">Why</p>
            <FactorList kind="support" items={brief.reasons} />
          </div>
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-faint">What could change it</p>
            <FactorList kind="risk" items={brief.risks} />
          </div>
        </div>
      </div>
    </Card>
  );
}
