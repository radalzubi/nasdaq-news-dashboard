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

  return handle(async () => {
    const res = await getNews(tickers);
    return { clusters: res.clusters, meta: res.meta };
  });
}
