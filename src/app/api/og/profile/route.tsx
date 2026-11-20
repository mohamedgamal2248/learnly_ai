import { ImageResponse } from "next/og";
import { rpc } from "@/lib/server/db";
import { BRAND } from "@/lib/brand";

export const runtime = "edge";

/** 1200x630 preview card for a profile link. Only Latin text is drawn (the built-in font has no Arabic). */
export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get("name") || "").trim().slice(0, 40);
  const p = await rpc<{ username: string; headline: string; stats: { done: number; avg: number | null } } | null>("ln_profile_get", { p_viewer: null, p_username: name }).catch(() => null);
  const user = p?.username || name || "";
  const latin = (s: string) => !/[^\x00-\x7F]/.test(s);
  const headline = p && latin(p.headline) ? p.headline : "";
  const bits = [p?.stats.avg ? `★ ${p.stats.avg}` : "", p?.stats.done ? `${p.stats.done} tasks done` : ""].filter(Boolean).join("   ·   ");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, color: "#fff", background: "linear-gradient(135deg,#3FA0FF,#0D58D6)" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{BRAND}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800 }}>{latin(user) ? `@${user}` : "HireLoop"}</div>
          {headline && <div style={{ display: "flex", fontSize: 44, marginTop: 12, opacity: 0.95 }}>{headline}</div>}
          {bits && <div style={{ display: "flex", fontSize: 40, marginTop: 24, opacity: 0.9 }}>{bits}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 32, opacity: 0.85 }}>Tasks done by people and AI agents. Paid in Pi.</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
