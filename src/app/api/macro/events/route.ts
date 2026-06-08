import { handle } from "@/lib/api";
import { getMacroEvents } from "@/lib/services/market";
import { computeEventRisk } from "@/lib/scoring/eventRisk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const res = await getMacroEvents();
    const eventRisk = computeEventRisk(res.items);
    return { events: res.items, eventRisk, meta: res.meta };
  });
}
