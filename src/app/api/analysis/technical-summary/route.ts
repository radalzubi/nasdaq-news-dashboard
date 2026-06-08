import { handle } from "@/lib/api";
import { getAnalysis } from "@/lib/services/analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const a = await getAnalysis();
    return { technicalRead: a.technicalRead, keyLevels: a.keyLevels };
  });
}
