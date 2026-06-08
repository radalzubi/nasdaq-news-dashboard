import { handle } from "@/lib/api";
import { getTrackRecord } from "@/lib/services/analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(() => getTrackRecord());
}
