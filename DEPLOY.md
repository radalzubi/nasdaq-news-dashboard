# Deploy this as a private link (≈3 minutes)

Everything is ready: the code is on GitHub (private), it builds clean, and it has
a built-in password gate. The only step left needs your Vercel login (a one-time
browser sign-in — nobody else can do that for you).

## Steps

1. **Open [vercel.com/new](https://vercel.com/new)** and **Continue with GitHub**
   (sign in as `radalzubi`). First time only: click **Install / Authorize** so
   Vercel can see your repos.

2. Find **`nasdaq-news-dashboard`** in the list → click **Import**.
   (Vercel auto-detects Next.js — leave all build settings as-is.)

3. Expand **Environment Variables** and add these three:

   | Name | Value |
   | --- | --- |
   | `FINNHUB_API_KEY` | copy from your local `.env.local` |
   | `FRED_API_KEY` | copy from your local `.env.local` |
   | `SITE_PASSWORD` | **a password you choose** (this makes the link private) |

   Optional: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_TIMEZONE=America/New_York`.

4. Click **Deploy**. After ~1–2 minutes you get a URL like
   `https://nasdaq-news-dashboard.vercel.app`.

## Your private link

Open the URL → the browser asks for a login → enter **any username + your
`SITE_PASSWORD`**. Done. Send that link + password to whoever should have access;
everyone else hits a login wall. It's a private link, not a public domain.

## Updating later

Any time you (or Claude Code) push to the `main` branch, Vercel rebuilds and
redeploys automatically. To change the password, edit `SITE_PASSWORD` in
Vercel → Project → Settings → Environment Variables, then redeploy.

## Notes

- **Always live on the cloud:** the Bullish/Bearish call, confidence, prioritized
  news (Finnhub), and VIX / 10-year yield / 40-year history (FRED).
- **Best-effort on the cloud:** the exact NDX index number + dollar/gold cross-checks
  come from Yahoo's free endpoint, which rate-limits shared cloud IPs more than a
  laptop — they may show "sample" more often. The core read is unaffected.
- The `.data/` local file store isn't used by the live pages, so serverless
  (ephemeral disk) is fine.

Informational only — not financial advice. The app places no trades.
