import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { newToken, sha256hex } from "@/lib/server/mcp-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  return json({ tokens: await rpc("ln_mcp_tokens_list", { p_user: a.u.id }) });
}

/** action "create": a personal access token for MCP clients that accept a header (shown once). action "off": switch one off. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (b?.action === "off") {
    if (typeof b.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
    await rpc("ln_mcp_token_off", { p_user: a.u.id, p_id: b.id });
    return json({ ok: true });
  }
  if (b?.action === "post") {
    if (typeof b.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
    await rpc("ln_mcp_token_set_post", { p_user: a.u.id, p_id: b.id, p_on: b.on === true });
    return json({ ok: true });
  }
  if (rateLimited(`pat:${a.u.id}`, 10, 3600_000)) return fail("slow_down", 429);
  const token = newToken();
  await rpc("ln_mcp_token_create", { p_user: a.u.id, p_hash: sha256hex(token), p_name: typeof b?.name === "string" ? b.name.slice(0, 60) : "Personal token" });
  return json({ token });
}
