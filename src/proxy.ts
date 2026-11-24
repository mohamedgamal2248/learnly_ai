import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF guard for the cookie-based API. Our login cookie is SameSite=None (Pi Browser needs it), so a foreign website could
 * otherwise make a signed-in visitor's browser send state-changing requests. Reads are always allowed; any other request
 * must come from our own site.
 */
/** Features that are switched off (see next.config.ts): their endpoints answer 404 too, not only their pages. */
const LEGACY = /^\/api\/(bots|certs|chat|chats|courses|files|learning|posts|ratings|reviews|stats|i18n|teach\/(?!apply\b))/;
const MARKET = /^\/(api\/(blocks|deals|earnings|ledger|mcp|notifs|oauth|onboarding|people|profile|reports|services|tasks|og)|mcp|oauth)(\/|$)/;

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const off = (LEGACY.test(path) && process.env.SHOW_LEGACY !== "1") || (MARKET.test(path) && process.env.SHOW_MARKET !== "1");
  if (off) return new NextResponse(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return NextResponse.next();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  let ok = true;
  if (origin && origin !== "null") {
    try { ok = new URL(origin).host === host; } catch { ok = false; }
  } else if (site) {
    ok = site === "same-origin" || site === "none";
  }
  if (!ok) return new NextResponse(JSON.stringify({ error: "cross_site" }), { status: 403, headers: { "Content-Type": "application/json" } });
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/mcp", "/oauth/:path*"] };
