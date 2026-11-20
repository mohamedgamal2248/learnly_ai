import { rpc } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { normalizeLinkCode, oauthSign, oauthVerify, rateLimitedIp, sha256hex, type OauthClient } from "@/lib/server/mcp-auth";

export const runtime = "nodejs";

const REASON: Record<string, string> = { not_found: "bad_code", expired: "code_expired", used_up: "code_used", replaced: "code_replaced" };

/**
 * The consent page (opened by ChatGPT/Claude in a normal browser) sends the pairing code the user copied
 * from Pi Browser. A valid code proves who they are; we hand back an authorization code for the AI app.
 * Errors are specific so the page can tell the user what to do.
 */
export async function POST(req: Request) {
  if (rateLimitedIp(req, "oauth-approve", 15, 60_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const client = oauthVerify<OauthClient>(b?.client_id, "client");
  if (!client) return fail("invalid_client");
  const ru = String(b?.redirect_uri || "");
  if (!client.ru.includes(ru)) return fail("invalid_redirect");
  const challenge = String(b?.code_challenge || "");
  if (b?.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return fail("invalid_pkce");
  const code = normalizeLinkCode(String(b?.code || ""));
  if (code.length !== 8) return fail("bad_code");
  const r = await rpc<{ uid?: string; reason?: string }>("ln_link_code_use2", { p_hash: sha256hex(code) });
  if (!r?.uid) return fail(REASON[r?.reason || ""] || "bad_code");
  const auth = oauthSign({ t: "code", uid: r.uid, ch: challenge, ru, cid: b.client_id, exp: Date.now() + 5 * 60_000 });
  const u = new URL(ru);
  u.searchParams.set("code", auth);
  if (typeof b?.state === "string" && b.state) u.searchParams.set("state", b.state.slice(0, 500));
  return json({ redirect: u.toString(), app: client.n });
}
