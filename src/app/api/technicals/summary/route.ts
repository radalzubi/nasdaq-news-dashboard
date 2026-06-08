import { badRequest, handle } from "@/lib/api";
import { getTechnicalSummary } from "@/lib/services/market";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "QQQ").trim().toUpperCase();
  if (!symbol) return badRequest("Provide ?symbol=QQQ");
  return handle(() => getTechnicalSummary(symbol));
}
