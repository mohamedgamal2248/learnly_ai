import { CORS, oauthSign, rateLimitedIp, validRedirect } from "@/lib/server/mcp-auth";

export const runtime = "nodejs";

/** Dynamic client registration (RFC 7591): the AI app tells us where it wants to be redirected. Nothing is stored. */
export async function POST(req: Request) {
  if (rateLimitedIp(req, "oauth-reg", 20, 60_000)) return Response.json({ error: "slow_down" }, { status: 429, headers: CORS });
  const b = await req.json().catch(() => null);
  const uris: unknown[] = Array.isArray(b?.redirect_uris) ? b.redirect_uris : [];
  if (!uris.length || uris.length > 5 || !uris.every(validRedirect)) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "redirect_uris must be https (or http on localhost)" }, { status: 400, headers: CORS });
  }
  const name = typeof b?.client_name === "string" ? b.client_name.slice(0, 80) : "AI app";
  const client_id = oauthSign({ t: "client", ru: uris, n: name });
  return Response.json({
    client_id, client_name: name, redirect_uris: uris, token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"], response_types: ["code"],
  }, { status: 201, headers: CORS });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
