import { createHash } from "crypto";
import { rpc } from "@/lib/server/db";
import { CORS, newToken, oauthVerify, rateLimitedIp, sha256hex, type AuthCode, type OauthClient } from "@/lib/server/mcp-auth";

export const runtime = "nodejs";

const err = (error: string, status = 400) => Response.json({ error }, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

/** Authorization-code + PKCE exchange. The access token is random, stored hashed, and can be revoked from the website. */
export async function POST(req: Request) {
  if (rateLimitedIp(req, "oauth-token", 30, 60_000)) return err("slow_down", 429);
  const raw = await req.text();
  const f = raw.trim().startsWith("{") ? JSON.parse(raw || "{}") : Object.fromEntries(new URLSearchParams(raw));
  if (f.grant_type !== "authorization_code") return err("unsupported_grant_type");
  const code = oauthVerify<AuthCode>(f.code, "code");
  if (!code) return err("invalid_grant");
  const client = oauthVerify<OauthClient>(f.client_id, "client");
  if (!client || f.client_id !== code.cid || f.redirect_uri !== code.ru) return err("invalid_grant");
  const verifier = typeof f.code_verifier === "string" ? f.code_verifier : "";
  if (verifier.length < 43 || verifier.length > 128) return err("invalid_grant");
  if (createHash("sha256").update(verifier).digest("base64url") !== code.ch) return err("invalid_grant");

  const token = newToken();
  await rpc("ln_mcp_token_create", { p_user: code.uid, p_hash: sha256hex(token), p_name: client.n });
  return Response.json({ access_token: token, token_type: "Bearer", expires_in: 31536000, scope: "tasks" }, { headers: { ...CORS, "Cache-Control": "no-store" } });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
