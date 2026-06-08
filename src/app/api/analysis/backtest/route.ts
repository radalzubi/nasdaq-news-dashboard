import { badRequest, handle } from "@/lib/api";
import { PRIMARY_SYMBOL } from "@/lib/config";
import { getBacktest } from "@/lib/services/analysis";
import type { SignalType } from "@/lib/analysis-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: SignalType[] = ["trend-up", "trend-down", "oversold", "overbought"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const signalType = (url.searchParams.get("signalType") ?? "trend-up") as SignalType;
  const symbol = (url.searchParams.get("symbol") ?? PRIMARY_SYMBOL).toUpperCase();
  const window = url.searchParams.get("window") ?? "next-session";
  if (!VALID.includes(signalType)) return badRequest(`signalType must be one of ${VALID.join(", ")}`);
  return handle(() => getBacktest(signalType, symbol, window));
}
