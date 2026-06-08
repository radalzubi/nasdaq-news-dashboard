import { handle } from "@/lib/api";
import { getEarnings } from "@/lib/services/market";
import { NASDAQ_LEADERS } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return handle(() => getEarnings(symbols.length ? symbols : [...NASDAQ_LEADERS]));
}
