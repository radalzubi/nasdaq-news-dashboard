import { badRequest, json } from "@/lib/api";
import { readCollection, writeCollection, makeId } from "@/lib/store";
import { alertRuleInputSchema, type AlertRule } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLLECTION = "alerts";

const DEFAULT_RULES: AlertRule[] = [
  { id: "seed-news", type: "major-news", label: "Any market-moving Nasdaq news", severity: "market-moving", enabled: true, createdAt: new Date(0).toISOString() },
  { id: "seed-vwap", type: "qqq-vwap", label: "QQQ loses or reclaims VWAP", severity: "important", enabled: true, createdAt: new Date(0).toISOString() },
  { id: "seed-vix", type: "vix-spike", label: "VIX spikes more than 8%", symbol: "VIX", threshold: 8, severity: "high", enabled: true, createdAt: new Date(0).toISOString() },
  { id: "seed-event", type: "macro-event", label: "High-impact economic event within 30 min", severity: "high", enabled: true, createdAt: new Date(0).toISOString() },
  { id: "seed-stale", type: "stale-feed", label: "A data feed becomes stale", severity: "info", enabled: true, createdAt: new Date(0).toISOString() },
];

async function rules(): Promise<AlertRule[]> {
  return readCollection<AlertRule[]>(COLLECTION, DEFAULT_RULES);
}

export async function GET() {
  return json({ rules: await rules() });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const list = await rules();

  // Delete
  if (typeof body.deleteId === "string") {
    const next = list.filter((r) => r.id !== body.deleteId);
    await writeCollection(COLLECTION, next);
    return json({ rules: next });
  }
  // Toggle enabled
  if (typeof body.id === "string" && typeof body.enabled === "boolean") {
    const next = list.map((r) => (r.id === body.id ? { ...r, enabled: body.enabled as boolean } : r));
    await writeCollection(COLLECTION, next);
    return json({ rules: next });
  }
  // Create
  const parsed = alertRuleInputSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid alert rule", parsed.error.flatten());
  const rule: AlertRule = { id: makeId("alert"), createdAt: new Date().toISOString(), ...parsed.data };
  const next = [rule, ...list];
  await writeCollection(COLLECTION, next);
  return json({ rules: next, created: rule });
}
