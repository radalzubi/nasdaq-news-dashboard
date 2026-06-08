"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Expandable } from "@/components/ui/explain";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysis } from "@/lib/query/hooks";
import { cn, timeAgo } from "@/lib/utils";
import type { AnalysisEngineOutput, ComponentScore, FactorContribution } from "@/lib/analysis-engine/core/types";
import { Activity, FlaskConical, GitBranch, Layers, ShieldQuestion } from "lucide-react";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3 first:border-0 first:pt-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-fg">
        <span className="text-faint">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

function Bar({ c }: { c: ComponentScore }) {
  const color = c.score <= 40 ? "bg-bear" : c.score <= 60 ? "bg-caution" : c.score <= 75 ? "bg-info" : "bg-bull";
  return (
    <div>
      <div className="flex items-center justify-between text-2xs">
        <span className="text-muted">{c.label} <span className="text-faint">· {Math.round(c.weight * 100)}%</span></span>
        <span className="tabular text-faint">{c.score}</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${c.score}%` }} />
      </div>
      <p className="mt-0.5 text-2xs text-faint">{c.plain}</p>
    </div>
  );
}

function Factors({ factors }: { factors: FactorContribution[] }) {
  const pos = factors.filter((f) => f.points > 0).slice(0, 5);
  const neg = factors.filter((f) => f.points < 0).slice(0, 5);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-2xs uppercase tracking-wide text-faint">Helping the score</p>
        <ul className="space-y-0.5 text-xs">
          {pos.length ? pos.map((f, i) => <li key={i} className="text-muted"><span className="tabular font-medium text-bull">+{Math.round(f.points)}</span> {f.label}</li>) : <li className="text-faint">—</li>}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-2xs uppercase tracking-wide text-faint">Holding it back</p>
        <ul className="space-y-0.5 text-xs">
          {neg.length ? neg.map((f, i) => <li key={i} className="text-muted"><span className="tabular font-medium text-bear">{Math.round(f.points)}</span> {f.label}</li>) : <li className="text-faint">—</li>}
        </ul>
      </div>
    </div>
  );
}

export function AdvancedAnalysis() {
  const { data, isLoading } = useAnalysis();

  return (
    <Card>
      <CardHeader
        title="Under the hood"
        description="The full institutional read — kept out of the way unless you want it."
        icon={<Layers className="h-4 w-4" />}
        action={data ? <Badge tone="outline">{data.regime.regime}</Badge> : null}
      />
      <div className="p-3.5">
        {isLoading ? (
          <Skeleton className="h-10" />
        ) : data ? (
          <Expandable label="Show the full analysis">
            <AdvancedBody a={data} />
          </Expandable>
        ) : (
          <p className="text-xs text-faint">Advanced analysis is unavailable right now.</p>
        )}
      </div>
    </Card>
  );
}

function AdvancedBody({ a }: { a: AnalysisEngineOutput }) {
  const components = Object.values(a.componentScores);
  return (
    <div className="space-y-4">
      <Section title="The trading environment" icon={<GitBranch className="h-3.5 w-3.5" />}>
        <p className="text-xs text-muted">{a.regime.why}</p>
        <p className="mt-1 text-2xs text-faint">Watch next: {a.regime.watchNext}. This read would change if we saw {a.regime.invalidatedBy}.</p>
      </Section>

      <Section title="Why the confidence score" icon={<ShieldQuestion className="h-3.5 w-3.5" />}>
        <Factors factors={a.factorContributions} />
        <div className="mt-3 space-y-2">
          {components.map((c) => <Bar key={c.key} c={c} />)}
        </div>
      </Section>

      <Section title="Do other markets agree?" icon={<Activity className="h-3.5 w-3.5" />}>
        <p className="text-xs text-muted">{a.crossAsset.plain}</p>
        {a.crossAsset.signals.length ? (
          <ul className="mt-1 space-y-0.5 text-2xs text-faint">
            {a.crossAsset.signals.map((s, i) => <li key={i}>• {s}</li>)}
          </ul>
        ) : null}
      </Section>

      {a.conflicts.length ? (
        <Section title="Conflicting signals" icon={<GitBranch className="h-3.5 w-3.5" />}>
          <ul className="space-y-1.5 text-xs text-muted">
            {a.conflicts.map((c) => (
              <li key={c.id}>
                {c.explanation} <span className="text-faint">Watch {c.watch}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {a.anomalies.length ? (
        <Section title="Unusual activity" icon={<Activity className="h-3.5 w-3.5" />}>
          <ul className="space-y-1 text-xs text-muted">
            {a.anomalies.map((an, i) => (
              <li key={i}>{an.explanation} <span className="text-faint">({an.trust})</span></li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Data quality" icon={<ShieldQuestion className="h-3.5 w-3.5" />}>
        <p className="text-xs text-muted">Overall data freshness: <span className="font-medium text-fg">{a.dataQuality.overall}/100</span>.</p>
        {a.dataQuality.warning ? <p className="mt-1 text-2xs text-caution">{a.dataQuality.warning}</p> : <p className="mt-1 text-2xs text-faint">All key inputs look fresh.</p>}
        {a.dataQuality.delayedInputs.length ? <p className="mt-1 text-2xs text-faint">Delayed/sample: {a.dataQuality.delayedInputs.join(", ")}</p> : null}
      </Section>

      <Section title="Historical context (backtest)" icon={<FlaskConical className="h-3.5 w-3.5" />}>
        <BacktestNote regime={a.regime.regime} />
      </Section>

      <p className="border-t border-border pt-2 text-2xs text-faint">
        Engine {a.auditTrail.modelVersion} · inputs: {a.auditTrail.inputsUsed.join(", ")} · updated {timeAgo(a.auditTrail.calculationTimestamp)}.
        Informational only — not financial advice. No trades are placed.
      </p>
    </div>
  );
}

function BacktestNote({ regime }: { regime: string }) {
  // A light, honest historical-context line. (Detailed backtests live at /api/analysis/backtest.)
  return (
    <p className="text-2xs text-faint">
      This read is shown <span className="text-muted">as context, not a prediction</span>. The engine also runs historical
      replay + walk-forward validation (with look-ahead and small-sample guards) on the {regime.toLowerCase()} setup; results
      are available via the analysis API and never imply guaranteed outcomes.
    </p>
  );
}
