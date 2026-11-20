import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";
import { moderate } from "@/lib/server/moderation";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind");
  const id = u.searchParams.get("id") || "";
  if (!["bot", "course"].includes(kind || "") || !UUID.test(id)) return fail("bad_request");
  const s = getSession(req);
  return json(await rpc("ln_reviews_list", { p_kind: kind, p_target: id, p_user: s?.uid ?? null }));
}

/** Rate a bot you chatted with, or a course you're enrolled in. Text reviews pass the AI check. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`review:${s.uid}`, 10, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const stars = Math.round(Number(b?.stars));
  const body = typeof b?.body === "string" ? b.body.trim().slice(0, 500) : "";
  if (!["bot", "course"].includes(b?.kind) || !UUID.test(b?.id || "") || !(stars >= 1 && stars <= 5)) return fail("bad_request");
  if (body) {
    const m = await moderate(body);
    if (!m.ok) return fail("blocked", 400, { why: m.why });
  }
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_review_save", { p_user: s.uid, p_kind: b.kind, p_target: b.id, p_stars: stars, p_body: body });
  return r.ok ? json(r) : fail(r.reason || "bad_request", 403);
}
