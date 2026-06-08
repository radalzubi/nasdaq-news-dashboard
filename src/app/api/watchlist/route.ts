import { badRequest, handle, json } from "@/lib/api";
import { DEFAULT_WATCHLIST } from "@/lib/config";
import { getWatchlist } from "@/lib/services/market";
import { readCollection, writeCollection } from "@/lib/store";
import { watchlistInputSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLLECTION = "watchlist";

async function symbols(): Promise<string[]> {
  return readCollection<string[]>(COLLECTION, [...DEFAULT_WATCHLIST]);
}

export async function GET() {
  return handle(async () => {
    const syms = await symbols();
    const res = await getWatchlist(syms);
    return { symbols: syms, items: res.items, meta: res.meta };
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = watchlistInputSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid watchlist", parsed.error.flatten());
  const syms = [...new Set(parsed.data.symbols)];
  await writeCollection(COLLECTION, syms);
  const res = await getWatchlist(syms);
  return json({ symbols: syms, items: res.items, meta: res.meta });
}
