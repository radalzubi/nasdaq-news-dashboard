"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/data-status";
import { Skeleton } from "@/components/ui/skeleton";
import { DISCLAIMER, TIMEZONE } from "@/lib/config";
import { useProviders } from "@/lib/query/hooks";
import type { ProviderStatus } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";

const STATUS_TONE: Record<ProviderStatus["status"], "bull" | "caution" | "neutral" | "bear"> = {
  connected: "bull",
  disconnected: "caution",
  "not-configured": "neutral",
  error: "bear",
};

const ENV_KEYS: { provider: string; env: string; powers: string }[] = [
  { provider: "finnhub", env: "FINNHUB_API_KEY", powers: "Quotes, news, earnings" },
  { provider: "alphaVantage", env: "ALPHA_VANTAGE_API_KEY", powers: "Quotes, intraday bars, news sentiment" },
  { provider: "fred", env: "FRED_API_KEY", powers: "VIX & 10-year yield levels" },
];

export default function SettingsPage() {
  const providers = useProviders();
  const list = providers.data?.providers ?? [];
  const configuredById = Object.fromEntries(list.map((p) => [p.id, p.configured]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Settings" description="Data sources, API keys, and preferences." />

      <Card>
        <CardHeader title="Data sources" description="Live status of each connected provider." />
        {providers.isLoading ? (
          <div className="p-4"><Skeleton className="h-40" /></div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={p.mode} />
                    <span className="text-sm font-medium text-fg">{p.name}</span>
                  </div>
                  <Badge tone={STATUS_TONE[p.status]} className="capitalize">{p.status.replace("-", " ")}</Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {p.capabilities.map((c) => (
                    <span key={c} className="rounded border border-border px-1.5 py-px text-2xs text-faint">{c}</span>
                  ))}
                </div>
                <p className="mt-1.5 text-2xs text-muted">{p.message}</p>
                {p.lastFetchAt ? (
                  <p className="text-2xs text-faint">
                    Last fetch {timeAgo(p.lastFetchAt)}
                    {p.latencyMs != null ? ` · ${p.latencyMs}ms` : ""} · mode: {p.mode}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="API keys" icon={<KeyRound className="h-4 w-4" />} description="Keys live server-side in .env.local and are never sent to the browser." />
        <ul className="divide-y divide-border">
          {ENV_KEYS.map((k) => {
            const ok = configuredById[k.provider];
            return (
              <li key={k.env} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <code className="text-xs text-fg">{k.env}</code>
                  <p className="text-2xs text-faint">{k.powers}</p>
                </div>
                {ok ? (
                  <span className="flex items-center gap-1 text-2xs text-bull"><CheckCircle2 className="h-3.5 w-3.5" /> Configured</span>
                ) : (
                  <span className="flex items-center gap-1 text-2xs text-faint"><XCircle className="h-3.5 w-3.5" /> Not set</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-4 py-3 text-2xs text-muted">
          To add a key: copy <code className="text-fg">.env.example</code> to <code className="text-fg">.env.local</code>,
          paste your key, and restart the dev server. With no keys, the app runs in clearly-labeled sample-data mode.
        </p>
      </Card>

      <Card>
        <CardHeader title="Preferences" />
        <div className="divide-y divide-border text-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted">Focus</span>
            <span className="text-fg">Nasdaq-100 only</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted">Timezone</span>
            <span className="text-fg">{TIMEZONE}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted">Language</span>
            <span className="text-fg">Plain English (no jargon)</span>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-bg-elevated p-4 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-fg">Disclaimer</p>
        <p className="mt-1">{DISCLAIMER}</p>
      </Card>
    </div>
  );
}
