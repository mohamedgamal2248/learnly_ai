import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** Report a person (profile, deal or task). An admin reviews it. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`report:${a.u.id}`, 10, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.username !== "string" || typeof b?.reason !== "string") return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_report_add", {
    p_user: a.u.id, p_username: b.username.slice(0, 60), p_kind: typeof b.kind === "string" ? b.kind.slice(0, 20) : "profile", p_ref: typeof b.ref === "string" ? b.ref.slice(0, 80) : null, p_reason: b.reason.slice(0, 500),
  });
  return r.ok ? json({ ok: true }) : fail(r.reason || "bad_request");
}
