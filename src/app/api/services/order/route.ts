import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { orderService } from "@/lib/server/people";

export const runtime = "nodejs";

/** One-click order of a fixed-price service. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`order:${a.u.id}`, 20, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await orderService(a.u.id, b.id, b.brief, null);
  return r.ok ? json(r) : fail(r.error, 400, r.extra || {});
}
