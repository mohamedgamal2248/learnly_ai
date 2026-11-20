import { rpc } from "@/lib/server/db";
import { fail, json, requireSession } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const b = await req.json().catch(() => null);
  if (!Number.isInteger(b?.id)) return fail("bad_request");
  return json(await rpc("ln_post_report", { p_user: s.uid, p_post: b.id }));
}
