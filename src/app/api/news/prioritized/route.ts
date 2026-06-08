import { handle } from "@/lib/api";
import { getNews } from "@/lib/services/market";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickers = (url.searchParams.get("tickers") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const limit = Number(url.searchParams.get("limit") ?? "0") || 0;

  return handle(async () => {
    const res = await getNews(tickers);
    const clusters = limit > 0 ? res.clusters.slice(0, limit) : res.clusters;
    return { clusters, items: res.items, meta: res.meta };
  });
}
