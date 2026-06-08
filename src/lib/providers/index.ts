import type { DataStatus, ProviderStatus } from "@/lib/types";
import { alphaVantageProvider } from "./alphaVantage";
import { demoProvider } from "./demo";
import { finnhubProvider } from "./finnhub";
import { fredProvider } from "./fred";
import { yahooProvider } from "./yahoo";
import type { MarketProvider } from "./types";

export const PROVIDERS: MarketProvider[] = [yahooProvider, finnhubProvider, alphaVantageProvider, fredProvider, demoProvider];

export const PROVIDERS_BY_ID: Record<string, MarketProvider> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
);

/** Lightweight runtime health, updated whenever the service calls a provider. */
interface Health {
  lastFetchAt?: string;
  latencyMs?: number;
  lastStatus?: DataStatus;
  lastError?: string;
}
const HEALTH: Record<string, Health> = {};

export function recordHealth(id: string, patch: Health) {
  HEALTH[id] = { ...HEALTH[id], ...patch };
}

/**
 * Resolve providers for a capability in priority order. Always ends with demo
 * so something is always returnable (clearly labeled as sample data).
 */
export function resolveProviders(
  capability: keyof MarketProvider["capabilities"],
  order: string[],
): MarketProvider[] {
  const seen = new Set<string>();
  const out: MarketProvider[] = [];
  for (const id of order) {
    const p = PROVIDERS_BY_ID[id];
    if (p && p.capabilities[capability] && p.isConfigured() && !seen.has(id)) {
      out.push(p);
      seen.add(id);
    }
  }
  if (!seen.has("demo")) out.push(demoProvider);
  return out;
}

const CAP_LABEL: Record<string, string> = {
  quotes: "Quotes",
  bars: "Charts",
  news: "News",
  earnings: "Earnings",
  macro: "Macro",
  filings: "Filings",
};

export function providerStatuses(): ProviderStatus[] {
  return PROVIDERS.map((p) => {
    const configured = p.isConfigured();
    const h = HEALTH[p.id] ?? {};
    const capabilities = Object.entries(p.capabilities)
      .filter(([, v]) => v)
      .map(([k]) => CAP_LABEL[k] ?? k);

    let status: ProviderStatus["status"];
    if (p.id === "demo") status = "connected";
    else if (!configured) status = "not-configured";
    else if (h.lastError) status = "error";
    else if (h.lastFetchAt) status = "connected";
    else status = "disconnected";

    const mode: DataStatus =
      p.id === "demo" ? "demo" : h.lastStatus ?? (configured ? "delayed" : "unavailable");

    return {
      id: p.id,
      name: p.name,
      configured,
      capabilities,
      status,
      lastFetchAt: h.lastFetchAt ?? null,
      latencyMs: h.latencyMs ?? null,
      mode,
      message:
        p.id === "demo"
          ? "Always available. Returns clearly-labeled sample data."
          : !configured
          ? "No API key set — add one in .env.local to enable this source."
          : h.lastError ?? (h.lastFetchAt ? "Responding normally." : "Configured; not yet used this session."),
    };
  });
}

export type { MarketProvider } from "./types";
