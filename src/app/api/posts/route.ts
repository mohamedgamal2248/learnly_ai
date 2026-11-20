import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireSession } from "@/lib/server/http";

export const runtime = "nodejs";

const GROUPS = ["general", "school", "uni", "job", "code", "lang", "pi"];

export async function GET(req: Request) {
  const u = new URL(req.url);
  const group = u.searchParams.get("g");
  const parent = u.searchParams.get("parent");
  const before = u.searchParams.get("before");
  const posts = await rpc("ln_posts_list", {
    p_group: group && GROUPS.includes(group) ? group : null,
    p_parent: parent ? parseInt(parent, 10) || null : null,
    p_before: before ? parseInt(before, 10) || null : null,
  });
  return json({ posts }, { cache: "public, s-maxage=10, stale-while-revalidate=60" });
}

export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`post:${s.uid}`, 5, 60_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const body = typeof b?.body === "string" ? b.body.trim() : "";
  if (body.length < 2 || body.length > 2000) return fail("bad_length");
  // Never let a wallet passphrase sit in a public post.
  if (body.split(/\s+/).filter((w: string) => /^[a-z]{3,8}$/.test(w)).length >= 12) return fail("looks_like_passphrase");
  const r = await rpc<{ ok: boolean; reason?: string; id?: number }>("ln_post_create", {
    p_user: s.uid, p_group: GROUPS.includes(b?.group) ? b.group : "general", p_body: body,
    p_parent: Number.isInteger(b?.parent) ? b.parent : null,
  });
  return r.ok ? json(r) : fail(r.reason || "server_error", 429);
}
