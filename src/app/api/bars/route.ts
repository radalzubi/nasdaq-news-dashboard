import { badRequest, handle } from "@/lib/api";
import { getBars } from "@/lib/services/market";
import type { Timeframe } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  const timeframe = (url.searchParams.get("timeframe") ?? "5m") as Timeframe;
  if (!symbol) return badRequest("Provide ?symbol=QQQ");
  if (!VALID.includes(timeframe)) return badRequest(`timeframe must be one of ${VALID.join(", ")}`);
  return handle(() => getBars(symbol, timeframe));
}
