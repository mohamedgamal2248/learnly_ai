import { CORS, originOf } from "@/lib/server/mcp-auth";

export const runtime = "nodejs";

export function GET(req: Request) {
  const o = originOf(req);
  return Response.json({ resource: `${o}/mcp`, authorization_servers: [o], bearer_methods_supported: ["header"], scopes_supported: ["tasks"] }, { headers: CORS });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
