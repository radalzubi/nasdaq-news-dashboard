# Nasdaq News Dashboard

A clean, **news-first market-awareness dashboard** for a casual-but-serious Nasdaq / QQQ trader.
It helps you understand, in under 30 seconds, *what* the Nasdaq is doing, *why* it might be
moving, *which* news matters, and *whether* the environment looks clear or risky — all in plain
English, with technical indicators used only to support the story.

> **Informational only. Not financial advice. This dashboard does not place trades and should not
> be treated as a buy or sell recommendation.**

This is **not** an execution platform, **not** a financial-advice tool, and **not** a hyper-technical
Bloomberg clone. It's a calm financial briefing room.

---

## Highlights

- **News Command Center** — a one-glance market brief: mood, a plain-English summary, a 0–100
  Market Clarity score, the top 3 reasons the market is moving, and the top 3 risks.
- **Prioritized, de-duplicated news** — headlines are scored 0–100 for Nasdaq relevance, clustered
  so you see *one card per story* (with a source count), and tagged with sentiment, importance,
  affected areas, and a "why this matters".
- **Market Clarity Meter** — answers *"how clear and supportive is the environment?"*, never
  *"should I buy?"*. Weighted across news, macro risk, technicals, breadth, volume/volatility, and
  data quality.
- **Simple Technical Summary** — trend / momentum / volume / chop-risk and a key level, with every
  indicator explained in plain language ("QQQ is trading above its average price for the day, which
  usually means buyers are in control").
- **Macro & event briefing** with an event-risk read, **major movers** with catalysts, a
  **watchlist**, **alerts**, a **risk calculator**, and a **trading journal** with analytics.
- **Honest data** — every panel shows its **source, freshness, and status** (live / delayed /
  cached / sample / unavailable). When a feed is down you get a clean *unavailable* state, never
  fabricated numbers. With no API keys, the app runs in clearly-labeled **sample-data mode**.

---

## Tech stack

| Layer       | Choice                                            |
| ----------- | ------------------------------------------------- |
| Framework   | Next.js 15 (App Router) + TypeScript              |
| Styling     | Tailwind CSS (hand-rolled, shadcn-style primitives) |
| Charts      | Recharts                                          |
| Data layer  | TanStack Query (client) + Next.js API routes (server) |
| Validation  | Zod                                               |
| Persistence | JSON file store (`.data/`) — no DB required       |
| Testing     | Vitest                                            |

---

## Install & run locally

Requires **Node 18.18+** (Node 20 recommended).

```bash
# 1. Install dependencies
npm install

# 2. (Optional) add API keys — the app runs without them in sample-data mode
cp .env.example .env.local
#    then edit .env.local and paste any keys you have

# 3. Start the dev server
npm run dev
#    open http://localhost:3000
```

Other scripts:

```bash
npm run build       # production build
npm start           # run the production build
npm test            # run the unit tests (scoring + risk logic)
npm run typecheck   # tsc --noEmit
```

---

## Adding API keys

Keys live **server-side only** in `.env.local` and are **never** exposed to the browser (all
provider calls happen in API routes). Add what you have — the app degrades gracefully:

| Env var                 | Provider       | Powers                                        | Free tier |
| ----------------------- | -------------- | --------------------------------------------- | --------- |
| `FINNHUB_API_KEY`       | Finnhub        | Quotes (US stocks/ETFs), market & company news, earnings calendar | ✅ |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage  | Quotes (with volume), intraday/daily bars, news sentiment | ✅ (rate-limited) |
| `FRED_API_KEY`          | FRED (St. Louis Fed) | VIX & 10-year Treasury yield levels      | ✅ |
| `ALPACA_API_KEY` / `_SECRET_KEY` | Alpaca | (scaffolded) higher-quality quotes/bars       | ✅ |
| `POLYGON_API_KEY`       | Polygon        | (scaffolded) market data / news               | ✅ (limited) |
| `NASDAQ_DATA_LINK_API_KEY` | Nasdaq Data Link | (scaffolded) exchange datasets           | ✅ |
| `TRADING_ECONOMICS_KEY` / `_SECRET` | Trading Economics | (scaffolded) economic calendar    | trial |

After editing `.env.local`, **restart the dev server**. The **Settings → Data sources** page shows
which keys are detected and the live status of each provider.

Provider priority is configurable via `PROVIDER_ORDER_QUOTES`, `PROVIDER_ORDER_NEWS`, and
`PROVIDER_ORDER_MACRO` (comma-separated). `demo` is always the final fallback.

---

## Which providers power which features

| Feature              | Primary source(s)                 | Fallback |
| -------------------- | --------------------------------- | -------- |
| Quotes (QQQ, leaders) | Finnhub → Alpha Vantage            | Demo     |
| VIX & 10-year yield   | FRED (`VIXCLS`, `DGS10`)           | Demo     |
| Charts / bars         | Alpha Vantage                     | Demo     |
| Prioritized news      | Finnhub → Alpha Vantage           | Demo     |
| Earnings calendar     | Finnhub                           | Demo     |
| Economic calendar     | Demo (sample schedule)¹           | —        |

¹ A real forward-looking economic calendar needs a paid provider (e.g. Trading Economics). Until
one is wired, the macro calendar shows a **clearly-labeled sample schedule** — verify against an
official source.

### Data that may be delayed

- **Alpha Vantage** quotes/bars are typically **end-of-day or delayed**, and the free tier is
  heavily rate-limited (~25 requests/day) — some symbols may be skipped and labeled accordingly.
- **FRED** macro series are **end-of-day** levels.
- **Finnhub** US-equity quotes are real-time on the free tier; index symbols (VIX, TNX) are not
  available and fall back to FRED or sample data.
- The market clock does **not** account for exchange holidays.

Every panel surfaces its own status badge, so you always know whether a number is live, delayed,
cached, sample, or unavailable.

---

## How the Market Clarity Meter works

The meter scores **how clear and supportive** the environment is (0–100) — it is **not** a buy/sell
signal. It's a weighted blend of six components:

| Component            | Weight | What it looks at |
| -------------------- | ------ | ---------------- |
| News & sentiment     | 30%    | Are the important, fresh Nasdaq headlines positive, negative, or mixed? Are mega-caps affected? |
| Macro / event risk   | 20%    | Is a major release imminent? Are yields / VIX moving against risk appetite? |
| Technical picture    | 20%    | Is QQQ above VWAP, trending or chopping, momentum strong or fading? |
| Market breadth       | 15%    | Are many leaders participating, or is one/two names carrying the index? |
| Volume & volatility  | 10%    | Is volume confirming the move? Is volatility calm or elevated? |
| Data quality         | 5%     | Are feeds fresh and responding? |

**Behavior:** stale/missing data is penalized heavily (and caps the score); mixed news + choppy
price action is penalized; an imminent high-impact event is penalized; a narrow, one-name move is
penalized; when news, macro, technicals, breadth, and volume all agree, the score gets a small
boost. Labels: 0–20 *Very unclear*, 21–40 *Weak signal*, 41–60 *Mixed*, 61–75 *Reasonably clear*,
76–90 *Strong environment*, 91–100 *Very strong, but verify*.

See `src/lib/scoring/clarity.ts` (unit-tested in `clarity.test.ts`).

## How news prioritization works

Each headline gets a **0–100 relevance score** combining: source credibility, recency, the
importance of related tickers (by Nasdaq-100 weight), Nasdaq/QQQ relevance, mega-cap impact,
rates/Fed/inflation relevance, whether it's earnings-related, multi-source corroboration, and
whether price is reacting. Scores map to importance: *Low / Medium / High / Market-moving*.

Headlines are then **clustered** (token-overlap + shared tickers) so near-duplicate stories collapse
into a single card showing the source count — quality over quantity. The home page shows at most a
handful; the **News Feed** page offers filters and "show more".

See `src/lib/scoring/news.ts` and `cluster.ts` (unit-tested).

---

## Architecture

```
src/
├── app/                      # App Router pages + API routes
│   ├── page.tsx              # News Command Center (home)
│   ├── news, technicals, macro, movers, watchlist, alerts, risk, journal, settings
│   └── api/                  # /market/brief, /news/*, /quotes, /bars, /technicals/summary,
│                             #   /macro/events, /movers, /earnings, /watchlist, /alerts,
│                             #   /journal, /providers/status
├── components/
│   ├── ui/                   # Card, Badge, Button, Tooltip, DataStatusBadge, states, …
│   ├── dashboard/            # MarketBriefCard, ClarityMeter, NewsCard, TechnicalRead, …
│   └── layout/               # AppShell, Sidebar, MarketClock, PageHeader
└── lib/
    ├── types.ts              # Normalized types + Zod schemas (Quote, NewsItem, NewsCluster,
    │                         #   EconomicEvent, MarketBrief, TechnicalSummary, MarketClarityScore, …)
    ├── providers/            # Provider abstraction: demo, finnhub, alphaVantage, fred + registry
    ├── services/market.ts    # Composition layer: caching, fallback, brief/movers/watchlist
    ├── scoring/              # news, cluster, technicals, clarity, eventRisk (pure + tested)
    ├── risk.ts               # position-size calculator (pure + tested)
    └── query/hooks.ts        # TanStack Query hooks
```

**Data-source abstraction:** every provider implements a common `MarketProvider` interface and
declares its capabilities. The service resolves providers per capability in priority order and
always falls back to the clearly-labeled `demo` provider, so the app is never broken and never
guesses.

**Refresh cadence:** quotes 15s · news ~45s · movers/watchlist ~20s · technicals ~30s · macro 5min ·
earnings hourly. Server responses are cached briefly to avoid hammering rate-limited APIs.

---

## Analysis engine (institutional-grade, decision-support only)

`src/lib/analysis-engine/` is a **pure, modular** engine that turns normalized inputs into a
structured, auditable read. It **does not execute trades, never says "buy/sell now", and never
promises returns** — it is informational, explainable, and risk-aware. Principle: *complex engine,
simple explanation* — all the depth lives behind the "Under the hood" panel and the analysis API.

```
analysis-engine/
  core/        engine.ts (orchestrator) · types.ts · config.ts (weights) · scoring.ts · explanation.ts
  features/    news · technical · macro · breadth · volatility · liquidity · correlation (cross-asset)
               · regime · microstructure (optional) · sentiment · earnings
  models/      clarityScoreModel · marketRegimeModel · newsImpactModel · riskModel · anomalyDetectionModel
  risk/        riskControls · eventRisk · staleDataGuard · volatilityGuard · conflictGuard
  explainability/  factorAttribution · plainEnglish · confidenceBreakdown
  validation/  backtest · walkForward · leakageChecks · dataQualityChecks · performanceMetrics
  tests/
```

**What it produces** (`AnalysisEngineOutput`): market mood, directional bias + strength, a 0–100
Market Clarity score (institutional weights: news 25 · macro 20 · technicals 17.5 · breadth 15 ·
volatility 6 · liquidity 4 · cross-asset 5 · data quality 7.5), a market-regime classification,
news-impact scoring, plain-English technical read + key levels, breadth/volatility/liquidity reads,
cross-asset confirmation, conflicts, anomalies (robust z-score), alerts, factor attribution
(+/- points), a plain-English summary, a data-quality report, and an audit trail.

**Safety / guardrails.** Clarity is hard-capped and a "Signal quality reduced because…" notice is
shown when the live price is stale, a major event is in-window, volatility is extreme, signals
conflict, or critical inputs are missing. Backtests run leakage / look-ahead checks and warn on
small samples — they validate signal quality, never promise returns.

**Analysis API:** `GET /api/analysis/{market-brief, clarity-score, news-impact, technical-summary,
macro-risk, breadth, regime, top-drivers, top-risks, data-quality, audit-trail}` and
`GET /api/analysis/backtest?signalType=&symbol=&window=`.

## Testing

```bash
npm test
```

Covers: news relevance scoring & classification, news clustering/dedup, technical-indicator math
and summary logic, market-clarity scoring (including stale-data and event-risk penalties), and the
risk calculator. UI pages are kept resilient with skeleton loaders and clean unavailable states.

CI (`.github/workflows/ci.yml`) runs `npm run typecheck`, `npm test` and `npm run build` on every
push to `main` and every pull request.

---

## Deployment

Standard Next.js deployment (e.g. **Vercel**):

1. Push the repo to GitHub and import it into Vercel.
2. Add your API keys as **Environment Variables** (same names as `.env.example`).
3. Deploy. The build command is `npm run build`.

> Note: the local `.data/` JSON store is per-instance and ephemeral on serverless platforms. For
> durable watchlist/alerts/journal data in production, point those at a real database
> (set `DATABASE_URL` and swap the `src/lib/store.ts` implementation).

Any Node host works too: `npm run build && npm start`.

---

## Known limitations

- **Sample-data mode** is the default with no keys. It is internally consistent and clearly labeled,
  but it is **not real market data**.
- The **economic calendar** is sample data until a calendar provider (e.g. Trading Economics) is
  wired up.
- **Alpha Vantage** free tier is rate-limited; **FRED** and Alpha Vantage data are delayed/EOD.
- The market clock ignores **exchange holidays**.
- **Alerts** are configured and shown in-app; external delivery (push/email) is not enabled in this
  build. WebSocket streaming is not yet implemented (polling is used).
- News sentiment/summaries are lightweight (provider-supplied where available, otherwise a
  transparent lexicon/heuristic) — they are aids, not ground truth.

---

## Disclaimer

**Informational only. Not financial advice. This dashboard does not place trades and should not be
treated as a buy or sell recommendation.** Market data may be delayed, sampled, or unavailable —
always confirm with an official source before making any decision.
