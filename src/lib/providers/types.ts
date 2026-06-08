import type {
  Bar,
  DataListEnvelope,
  EarningsEvent,
  EconomicEvent,
  Filing,
  Quote,
  Sentiment,
  Timeframe,
} from "@/lib/types";

/** Raw news as a provider returns it — before our scoring/classification. */
export interface RawNewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  tickers: string[];
  summary?: string | null;
  sentiment?: Sentiment | null;
  image?: string | null;
}

export interface ProviderCapabilities {
  quotes?: boolean;
  bars?: boolean;
  news?: boolean;
  earnings?: boolean;
  macro?: boolean;
  filings?: boolean;
}

export interface NewsQuery {
  /** Restrict to these tickers (company news); empty = general market news. */
  tickers?: string[];
  limit?: number;
}

/**
 * A market-data provider. Every method returns a DataListEnvelope so the source
 * + freshness travel with the payload. Methods are optional; capabilities
 * declare what a provider can answer.
 */
export interface MarketProvider {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  /** True when the required API key(s) are present. */
  isConfigured(): boolean;

  getQuotes?(symbols: string[]): Promise<DataListEnvelope<Quote>>;
  getBars?(symbol: string, timeframe: Timeframe): Promise<DataListEnvelope<Bar>>;
  getNews?(query: NewsQuery): Promise<DataListEnvelope<RawNewsItem>>;
  getEarnings?(symbols: string[]): Promise<DataListEnvelope<EarningsEvent>>;
  getMacroEvents?(): Promise<DataListEnvelope<EconomicEvent>>;
  getFilings?(symbols: string[]): Promise<DataListEnvelope<Filing>>;
}
