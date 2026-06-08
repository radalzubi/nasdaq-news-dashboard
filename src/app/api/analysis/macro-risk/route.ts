import { handle } from "@/lib/api";
import { getAnalysis } from "@/lib/services/analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const a = await getAnalysis();
    return { macro: a.componentScores.macro, topRisks: a.topRisks, alerts: a.alerts.filter((x) => x.type === "macro-event-window") };
  });
}
