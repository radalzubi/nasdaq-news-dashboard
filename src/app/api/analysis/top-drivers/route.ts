import { handle } from "@/lib/api";
import { getAnalysis } from "@/lib/services/analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(async () => ({ topMarketDrivers: (await getAnalysis()).topMarketDrivers }));
}
