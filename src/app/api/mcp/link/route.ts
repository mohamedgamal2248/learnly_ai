import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { newLinkCode, sha256hex } from "@/lib/server/mcp-auth";

export const runtime = "nodejs";

/** A one-time pairing code (10 minutes). Opened in Pi Browser, typed on the AI app's consent page. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`link:${a.u.id}`, 10, 3600_000)) return fail("slow_down", 429);
  const code = newLinkCode();
  await rpc("ln_link_code_create", { p_user: a.u.id, p_hash: sha256hex(code) });
  return json({ code: `${code.slice(0, 4)}-${code.slice(4)}`, expires_in: 600 });
}
