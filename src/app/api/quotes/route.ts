import { badRequest, handle } from "@/lib/api";
import { getQuotes } from "@/lib/services/market";
import { symbolsQuerySchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = symbolsQuerySchema.safeParse({ symbols: url.searchParams.get("symbols") ?? "" });
  if (!parsed.success || parsed.data.symbols.length === 0) {
    return badRequest("Provide ?symbols=QQQ,NVDA");
  }
  return handle(() => getQuotes(parsed.data.symbols));
}
