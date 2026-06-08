import { handle } from "@/lib/api";
import { buildConfidenceBreakdown } from "@/lib/analysis-engine";
import { getAnalysis } from "@/lib/services/analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const a = await getAnalysis();
    return {
      marketClarity: a.marketClarity,
      directionalBias: a.directionalBias,
      componentScores: a.componentScores,
      factorContributions: a.factorContributions,
      confidenceBreakdown: buildConfidenceBreakdown(a.marketClarity, a.factorContributions),
    };
  });
}
