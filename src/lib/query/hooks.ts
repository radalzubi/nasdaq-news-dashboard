import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventRisk } from "@/lib/scoring/eventRisk";
import type { JournalAnalytics } from "@/lib/journalAnalytics";
import type { QuotesResult } from "@/lib/services/market";
import type {
  AlertRule,
  Bar,
  DataListEnvelope,
  DataMeta,
  EarningsEvent,
  EconomicEvent,
  JournalEntry,
  MarketBrief,
  MoversReport,
  NewsCluster,
  NewsItem,
  ProviderStatus,
  TechnicalSummary,
  Timeframe,
  WatchlistItem,
} from "@/lib/types";

import type { AnalysisEngineOutput } from "@/lib/analysis-engine/core/types";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

// ---- Response shapes -------------------------------------------------------
export interface Envelope<T> {
  data: T;
  meta: DataMeta;
}
export interface BriefResponse extends Envelope<MarketBrief> {}
export interface NewsResponse {
  clusters: NewsCluster[];
  items: NewsItem[];
  meta: DataMeta;
}
export interface MacroResponse {
  events: EconomicEvent[];
  eventRisk: EventRisk;
  meta: DataMeta;
}
export interface MoversResponse extends Envelope<MoversReport> {}
export interface TechnicalResponse {
  data: TechnicalSummary | null;
  meta: DataMeta;
}
export interface WatchlistResponse {
  symbols: string[];
  items: WatchlistItem[];
  meta: DataMeta;
}
export interface EarningsResponse {
  items: EarningsEvent[];
  meta: DataMeta;
}
export interface ProvidersResponse {
  providers: ProviderStatus[];
  order: Record<string, string[]>;
  checkedAt: string;
}
export interface JournalResponse {
  entries: JournalEntry[];
  analytics: JournalAnalytics;
}

// ---- Hooks -----------------------------------------------------------------
export function useMarketBrief() {
  return useQuery({ queryKey: ["brief"], queryFn: () => apiGet<BriefResponse>("/api/market/brief"), refetchInterval: 60_000 });
}

export function useNews(tickers: string[] = []) {
  const q = tickers.map((t) => t.toUpperCase()).sort().join(",");
  return useQuery({
    queryKey: ["news", q],
    queryFn: () => apiGet<NewsResponse>(`/api/news/prioritized${q ? `?tickers=${q}` : ""}`),
    refetchInterval: 45_000,
  });
}

export function useQuotes(symbols: string[]) {
  const q = symbols.map((s) => s.toUpperCase()).sort().join(",");
  return useQuery({
    queryKey: ["quotes", q],
    queryFn: () => apiGet<QuotesResult>(`/api/quotes?symbols=${q}`),
    refetchInterval: 15_000,
    enabled: symbols.length > 0,
  });
}

export function useTechnical(symbol: string) {
  return useQuery({
    queryKey: ["technical", symbol.toUpperCase()],
    queryFn: () => apiGet<TechnicalResponse>(`/api/technicals/summary?symbol=${symbol.toUpperCase()}`),
    refetchInterval: 30_000,
  });
}

export function useBars(symbol: string, timeframe: Timeframe = "5m") {
  return useQuery({
    queryKey: ["bars", symbol.toUpperCase(), timeframe],
    queryFn: () => apiGet<DataListEnvelope<Bar>>(`/api/bars?symbol=${symbol.toUpperCase()}&timeframe=${timeframe}`),
    refetchInterval: 60_000,
  });
}

export function useMacro() {
  return useQuery({ queryKey: ["macro"], queryFn: () => apiGet<MacroResponse>("/api/macro/events"), refetchInterval: 300_000 });
}

export function useMovers() {
  return useQuery({ queryKey: ["movers"], queryFn: () => apiGet<MoversResponse>("/api/movers"), refetchInterval: 20_000 });
}

export function useWatchlist() {
  return useQuery({ queryKey: ["watchlist"], queryFn: () => apiGet<WatchlistResponse>("/api/watchlist"), refetchInterval: 20_000 });
}

export function useSaveWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbols: string[]) => apiPost<WatchlistResponse>("/api/watchlist", { symbols }),
    onSuccess: (data) => qc.setQueryData(["watchlist"], data),
  });
}

export function useEarnings(symbols: string[] = []) {
  const q = symbols.map((s) => s.toUpperCase()).sort().join(",");
  return useQuery({ queryKey: ["earnings", q], queryFn: () => apiGet<EarningsResponse>(`/api/earnings${q ? `?symbols=${q}` : ""}`), refetchInterval: 3_600_000 });
}

export function useAnalysis() {
  return useQuery({ queryKey: ["analysis"], queryFn: () => apiGet<AnalysisEngineOutput>("/api/analysis/market-brief"), refetchInterval: 60_000 });
}

export function useProviders() {
  return useQuery({ queryKey: ["providers"], queryFn: () => apiGet<ProvidersResponse>("/api/providers/status"), refetchInterval: 30_000 });
}

export function useAlerts() {
  return useQuery({ queryKey: ["alerts"], queryFn: () => apiGet<{ rules: AlertRule[] }>("/api/alerts") });
}
export function useAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiPost<{ rules: AlertRule[] }>("/api/alerts", body),
    onSuccess: (data) => qc.setQueryData(["alerts"], data),
  });
}

export function useJournal() {
  return useQuery({ queryKey: ["journal"], queryFn: () => apiGet<JournalResponse>("/api/journal") });
}
export function useJournalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => apiPost<JournalResponse>("/api/journal", body),
    onSuccess: (data) => qc.setQueryData(["journal"], data),
  });
}
