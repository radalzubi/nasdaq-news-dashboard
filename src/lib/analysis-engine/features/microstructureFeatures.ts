import type { Bias, MicrostructureRead } from "../core/types";

/** Optional Level-2 / order-book snapshot (rarely available on retail feeds). */
export interface OrderBookSnapshot {
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

/**
 * OPTIONAL module. Order-book signals are noisy and short-term only; they must
 * never override news/macro/technical context. Returns "unavailable" when no
 * order-book data is connected.
 */
export function buildMicrostructureRead(book?: OrderBookSnapshot | null): MicrostructureRead {
  if (!book || book.bid <= 0 || book.ask <= 0) {
    return {
      available: false,
      bias: "neutral",
      plain: "Order-book (Level 2) data isn't connected, so short-term order-flow context isn't available.",
    };
  }
  const mid = (book.bid + book.ask) / 2;
  const spreadPct = ((book.ask - book.bid) / mid) * 100;
  const imbalance = (book.bidSize - book.askSize) / (book.bidSize + book.askSize || 1);
  const bias: Bias = imbalance > 0.15 ? "bullish" : imbalance < -0.15 ? "bearish" : "neutral";
  const lean = bias === "bullish" ? "buyer-leaning" : bias === "bearish" ? "seller-leaning" : "balanced";
  const spreadNote = spreadPct > 0.1 ? " The spread is a touch wide, so be careful with timing." : "";
  return {
    available: true,
    bias,
    plain: `Short-term order flow looks ${lean}, but this can change in seconds and shouldn't override the broader read.${spreadNote}`,
  };
}
