import { describe, expect, it } from "vitest";
import {
  classifyCategories,
  deriveAffectedAreas,
  importanceFromScore,
  lexiconSentiment,
  recencyScore,
  scoreNews,
} from "./news";

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

describe("classifyCategories", () => {
  it("detects Fed + rates language", () => {
    const cats = classifyCategories("Fed signals it may delay rate cuts as inflation stays sticky");
    expect(cats).toContain("fed");
    expect(cats).toContain("inflation");
  });

  it("classifies by ticker even without keywords", () => {
    expect(classifyCategories("Company posts update", ["NVDA"])).toContain("semis");
    expect(classifyCategories("Company posts update", ["AAPL"])).toContain("megacap");
  });

  it("falls back to general", () => {
    expect(classifyCategories("Local bakery wins award")).toEqual(["general"]);
  });
});

describe("lexiconSentiment", () => {
  it("reads positive", () => {
    expect(lexiconSentiment("Nvidia shares surge as analyst raises forecast")).toBe("positive");
  });
  it("reads negative", () => {
    expect(lexiconSentiment("Tech stocks plunge as fears of slowdown grow")).toBe("negative");
  });
  it("reads neutral when no signal", () => {
    expect(lexiconSentiment("Company schedules investor day for next month")).toBe("neutral");
  });
});

describe("recencyScore", () => {
  it("is ~1.0 for very fresh news", () => {
    expect(recencyScore(minsAgo(2))).toBeCloseTo(1, 1);
  });
  it("decays for older news", () => {
    expect(recencyScore(minsAgo(360))).toBeLessThan(0.4);
  });
  it("fresh news scores higher than old news", () => {
    expect(recencyScore(minsAgo(5))).toBeGreaterThan(recencyScore(minsAgo(300)));
  });
});

describe("importanceFromScore", () => {
  it("maps thresholds", () => {
    expect(importanceFromScore(85)).toBe("market-moving");
    expect(importanceFromScore(70)).toBe("high");
    expect(importanceFromScore(50)).toBe("medium");
    expect(importanceFromScore(20)).toBe("low");
  });
});

describe("deriveAffectedAreas", () => {
  it("maps semis to Semiconductors + QQQ", () => {
    const areas = deriveAffectedAreas(["semis"], ["NVDA"]);
    expect(areas).toContain("Semiconductors");
    expect(areas).toContain("QQQ");
  });
  it("maps fed to yields-sensitive + risk appetite", () => {
    const areas = deriveAffectedAreas(["fed"]);
    expect(areas).toContain("Yields-sensitive");
    expect(areas).toContain("Risk appetite");
  });
});

describe("scoreNews", () => {
  it("scores a fresh, credible, mega-cap chip story highly", () => {
    const r = scoreNews({
      headline: "Nvidia shares rise after analyst raises AI demand forecast",
      source: "Reuters",
      publishedAt: minsAgo(5),
      tickers: ["NVDA"],
    });
    expect(r.relevanceScore).toBeGreaterThanOrEqual(70);
    expect(r.sentiment).toBe("positive");
    expect(r.categories).toContain("semis");
    expect(r.affectedAreas).toContain("Semiconductors");
    expect(["high", "market-moving"]).toContain(r.importance);
  });

  it("scores an old, low-credibility, off-topic story low", () => {
    const r = scoreNews({
      headline: "Small-cap retailer opens new store location",
      source: "Some Blog",
      publishedAt: minsAgo(600),
      tickers: ["ZZZZ"],
    });
    expect(r.relevanceScore).toBeLessThan(45);
    expect(r.importance).toBe("low");
  });

  it("prefers provider sentiment when supplied", () => {
    const r = scoreNews({
      headline: "Apple announces event",
      source: "Bloomberg",
      publishedAt: minsAgo(10),
      tickers: ["AAPL"],
      sentiment: "negative",
    });
    expect(r.sentiment).toBe("negative");
  });

  it("rewards multi-source corroboration", () => {
    const base = {
      headline: "Fed official hints at slower rate cuts",
      source: "CNBC",
      publishedAt: minsAgo(15),
      tickers: [] as string[],
    };
    const single = scoreNews({ ...base, sourceCount: 1 });
    const many = scoreNews({ ...base, sourceCount: 5 });
    expect(many.relevanceScore).toBeGreaterThanOrEqual(single.relevanceScore);
  });
});
