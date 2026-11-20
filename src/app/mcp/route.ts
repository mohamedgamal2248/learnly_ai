import { rpc } from "@/lib/server/db";
import { CORS, originOf, rateLimitedIp, sha256hex } from "@/lib/server/mcp-auth";
import { callTool, INSTRUCTIONS, TOOLS } from "@/lib/server/mcp-tools";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Learnly AI Tasks as a remote MCP server (Streamable HTTP, stateless JSON responses).
 * Auth: Bearer token from the website (personal token) or from the OAuth flow used by ChatGPT / Claude.
 */
const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const cache = new Map<string, { at: number; uid: string; banned: boolean }>();

async function authUser(req: Request) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(lnt_[A-Za-z0-9_-]{20,80})$/);
  if (!m) return null;
  const hash = sha256hex(m[1]);
  const hit = cache.get(hash);
  if (hit && Date.now() - hit.at < 30_000) return hit;
  const u = await rpc<{ user_id: string; banned: boolean } | null>("ln_mcp_token_verify", { p_hash: hash });
  if (!u) { cache.delete(hash); return null; }
  const v = { at: Date.now(), uid: u.user_id, banned: u.banned };
  cache.set(hash, v);
  if (cache.size > 500) cache.clear();
  return v;
}

const rpcOk = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

export async function POST(req: Request) {
  const origin = originOf(req);
  const user = await authUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json", "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` },
    });
  }
  if (user.banned) return Response.json({ error: "banned" }, { status: 403, headers: CORS });
  if (rateLimitedIp(req, `mcp:${user.uid}`, 120, 60_000)) return Response.json(rpcErr(null, -32000, "Too many requests, slow down."), { status: 429, headers: CORS });

  const body = await req.json().catch(() => null);
  if (!body) return Response.json(rpcErr(null, -32700, "Parse error"), { status: 400, headers: CORS });

  async function handle(msg: any) {
    const id = msg?.id;
    const isNote = id === undefined || id === null;
    switch (msg?.method) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        return rpcOk(id, {
          protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "learnly-tasks", title: "Learnly AI Tasks", version: "0.1.0" },
          instructions: INSTRUCTIONS,
        });
      }
      case "ping": return rpcOk(id, {});
      case "tools/list": return rpcOk(id, { tools: TOOLS });
      case "tools/call": {
        const name = String(msg.params?.name || "");
        if (!TOOLS.some((t) => t.name === name)) return rpcErr(id, -32602, `Unknown tool: ${name}`);
        try { return rpcOk(id, await callTool(name, msg.params?.arguments || {}, { uid: user!.uid, origin })); }
        catch (e: any) {
          console.error("mcp tool error", name, e?.message);
          return rpcOk(id, { content: [{ type: "text", text: "Something went wrong on our side. Try again in a moment." }], isError: true });
        }
      }
      default:
        return isNote || String(msg?.method || "").startsWith("notifications/") ? null : rpcErr(id, -32601, "Method not found");
    }
  }

  const batch = Array.isArray(body);
  const out = (await Promise.all((batch ? body : [body]).slice(0, 20).map(handle))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? out : out[0], { headers: { ...CORS, "Cache-Control": "no-store" } });
}

// Stateless server: no standalone SSE stream and no sessions to end.
export const GET = () => new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
export const DELETE = () => new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
