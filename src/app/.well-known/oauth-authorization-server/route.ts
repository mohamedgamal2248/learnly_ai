import { CORS, originOf } from "@/lib/server/mcp-auth";

export const runtime = "nodejs";

export function GET(req: Request) {
  const o = originOf(req);
  return Response.json({
    issuer: o,
    authorization_endpoint: `${o}/connect`,
    token_endpoint: `${o}/oauth/token`,
    registration_endpoint: `${o}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["tasks"],
  }, { headers: CORS });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
