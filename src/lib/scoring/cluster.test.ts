import { describe, expect, it } from "vitest";
import { clusterNews, isSameStory, jaccard, tokenize } from "./cluster";
import type { NewsItem } from "@/lib/types";

function item(partial: Partial<NewsItem> & Pick<NewsItem, "id" | "headline">): NewsItem {
  return {
    source: "Reuters",
    url: "https://example.com",
    publishedAt: new Date().toISOString(),
    tickers: [],
    sentiment: "neutral",
    importance: "medium",
    relevanceScore: 60,
    categories: ["nasdaq"],
    affectedAreas: ["QQQ"],
    ...partial,
  };
}

describe("jaccard", () => {
  it("is 1 for identical sets", () => {
    expect(jaccard(tokenize("nvidia chip demand"), tokenize("nvidia chip demand"))).toBe(1);
  });
  it("is 0 for disjoint sets", () => {
    expect(jaccard(tokenize("apple"), tokenize("microsoft"))).toBe(0);
  });
});

describe("isSameStory", () => {
  it("matches near-duplicate headlines", () => {
    const a = item({ id: "1", headline: "Nvidia shares rise on strong AI demand forecast", tickers: ["NVDA"] });
    const b = item({ id: "2", headline: "Nvidia stock rises after strong AI demand forecast", tickers: ["NVDA"], source: "CNBC" });
    expect(isSameStory(a, b)).toBe(true);
  });
  it("does not match unrelated stories", () => {
    const a = item({ id: "1", headline: "Apple unveils new iPhone lineup", tickers: ["AAPL"] });
    const b = item({ id: "2", headline: "Fed holds interest rates steady", tickers: [] });
    expect(isSameStory(a, b)).toBe(false);
  });
});

describe("clusterNews", () => {
  it("collapses duplicates into one cluster with multiple sources", () => {
    const items = [
      item({ id: "1", headline: "Nvidia shares rise on strong AI demand forecast", tickers: ["NVDA"], source: "Reuters" }),
      item({ id: "2", headline: "Nvidia stock climbs after strong AI demand forecast", tickers: ["NVDA"], source: "CNBC" }),
      item({ id: "3", headline: "Nvidia rises as AI demand forecast raised", tickers: ["NVDA"], source: "Bloomberg" }),
      item({ id: "4", headline: "Fed holds rates steady, signals patience", tickers: [], source: "AP" }),
    ];
    const clusters = clusterNews(items);
    expect(clusters.length).toBe(2);
    const nvda = clusters.find((c) => c.tickers.includes("NVDA"))!;
    expect(nvda.articleCount).toBe(3);
    expect(nvda.sources.length).toBe(3);
  });

  it("sorts clusters by relevance descending", () => {
    const items = [
      item({ id: "low", headline: "Minor product note", relevanceScore: 30, tickers: [] }),
      item({ id: "high", headline: "Major Fed decision shocks markets", relevanceScore: 90, tickers: [] }),
    ];
    const clusters = clusterNews(items);
    expect(clusters[0].relevanceScore).toBeGreaterThanOrEqual(clusters[1].relevanceScore);
  });
});
