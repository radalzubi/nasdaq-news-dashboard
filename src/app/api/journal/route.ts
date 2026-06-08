import { badRequest, json } from "@/lib/api";
import { computeJournalAnalytics, derivePnl } from "@/lib/journalAnalytics";
import { readCollection, writeCollection, makeId } from "@/lib/store";
import { journalInputSchema, type JournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLLECTION = "journal";

async function entries(): Promise<JournalEntry[]> {
  return readCollection<JournalEntry[]>(COLLECTION, []);
}

export async function GET() {
  const list = await entries();
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  return json({ entries: sorted, analytics: computeJournalAnalytics(list) });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const list = await entries();

  if (typeof body.deleteId === "string") {
    const next = list.filter((e) => e.id !== body.deleteId);
    await writeCollection(COLLECTION, next);
    return json({ entries: next, analytics: computeJournalAnalytics(next) });
  }

  const parsed = journalInputSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid journal entry", parsed.error.flatten());

  const entry: JournalEntry = {
    id: makeId("trade"),
    ...parsed.data,
    mistakes: parsed.data.mistakes ?? [],
  };
  entry.pnl = derivePnl(entry);

  const next = [entry, ...list];
  await writeCollection(COLLECTION, next);
  return json({ entries: next, analytics: computeJournalAnalytics(next), created: entry });
}
