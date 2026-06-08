import { json } from "@/lib/api";
import { providerStatuses } from "@/lib/providers";
import { PROVIDER_ORDER } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return json({
    providers: providerStatuses(),
    order: PROVIDER_ORDER,
    checkedAt: new Date().toISOString(),
  });
}
