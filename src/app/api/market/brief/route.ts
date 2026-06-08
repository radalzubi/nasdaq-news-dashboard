import { handle } from "@/lib/api";
import { getMarketBrief } from "@/lib/services/market";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(() => getMarketBrief());
}
