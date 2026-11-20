import "server-only";
import { rpc } from "./db";
import { moderate } from "./moderation";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "");
export const toList = (v: unknown, max: number, n: number): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,،\n]/) : []).filter((x): x is string => typeof x === "string").map((x) => clean(x, max)).filter((x) => x.length >= 2).slice(0, n);
const USES = ["ai", "manual", "both"];

export type ProfileInput = { headline?: unknown; bio?: unknown; skills?: unknown; uses_ai?: unknown; available?: unknown; rate_from?: unknown; visible?: unknown };

/** Saves the caller's public profile after the same AI safety check as the rest of the site. */
export async function saveProfile(uid: string, a: ProfileInput): Promise<{ ok: true } | { ok: false; error: string; why?: string }> {
  const headline = clean(a.headline, 100), bio = clean(a.bio, 800), skills = toList(a.skills, 30, 10);
  const uses = USES.includes(a.uses_ai as string) ? (a.uses_ai as string) : "both";
  const rate = a.rate_from === undefined || a.rate_from === null || a.rate_from === "" ? null : Math.round(Number(a.rate_from) * 1e4) / 1e4;
  if (rate !== null && !(rate >= 0.05 && rate <= 1000)) return { ok: false, error: "bad_rate" };
  const m = await moderate(`${headline}\n${bio}\n${skills.join(", ")}`);
  if (!m.ok) return { ok: false, error: "blocked", why: m.why };
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_profile_save", {
    p_user: uid, p_headline: headline, p_bio: bio, p_skills: skills, p_uses_ai: uses,
    p_available: a.available !== false && a.available !== "false", p_rate_from: rate, p_visible: a.visible !== false && a.visible !== "false",
  });
  return r.ok ? { ok: true } : { ok: false, error: r.reason || "bad_request" };
}

export type PortfolioInput = { title?: unknown; description?: unknown; made_with?: unknown; tags?: unknown };

/** Adds one portfolio item (what the person can do, made with AI or by hand). `image` is an already validated small image. */
export async function addPortfolio(uid: string, a: PortfolioInput, image?: { mime: string; data: string }): Promise<{ ok: true; id: string } | { ok: false; error: string; why?: string }> {
  const title = clean(a.title, 100), description = clean(a.description, 600), tags = toList(a.tags, 30, 8);
  if (title.length < 3) return { ok: false, error: "bad_title" };
  const made = USES.includes(a.made_with as string) ? (a.made_with as string) : "both";
  const m = await moderate(`${title}\n${description}\n${tags.join(", ")}`);
  if (!m.ok) return { ok: false, error: "blocked", why: m.why };
  const r = await rpc<{ ok: boolean; reason?: string; id?: string }>("ln_portfolio_add", {
    p_user: uid, p_title: title, p_desc: description, p_made_with: made, p_tags: tags, p_mime: image?.mime ?? null, p_data: image?.data ?? null,
  });
  return r.ok ? { ok: true, id: r.id as string } : { ok: false, error: r.reason || "bad_request" };
}

export type DealInput = { username?: unknown; title?: unknown; brief?: unknown; category?: unknown; delivery?: unknown; price?: unknown };
const DELIVERIES = ["text", "pdf", "ppt", "image", "file"];

export async function createDeal(uid: string, a: DealInput): Promise<{ ok: true; id: string } | { ok: false; error: string; why?: string }> {
  const title = clean(a.title, 120), brief = clean(a.brief, 1000), category = clean(a.category, 40);
  const price = Math.round(Number(a.price) * 1e4) / 1e4;
  if (!DELIVERIES.includes(a.delivery as string)) return { ok: false, error: "bad_delivery" };
  if (!(price >= 0.05 && price <= 50)) return { ok: false, error: "bad_price" };
  const m = await moderate(`${title}\n${brief}`);
  if (!m.ok) return { ok: false, error: "blocked", why: m.why };
  const r = await rpc<{ ok: boolean; reason?: string; id?: string }>("ln_deal_create", {
    p_user: uid, p_username: clean(a.username, 60), p_title: title, p_brief: brief, p_category: category, p_delivery: a.delivery, p_price: price,
  });
  return r.ok ? { ok: true, id: r.id as string } : { ok: false, error: r.reason || "bad_request" };
}

export async function dealMessage(uid: string, deal: string, body: unknown, price: unknown): Promise<{ ok: true } | { ok: false; error: string; why?: string }> {
  const text = clean(body, 1000);
  const p = price === undefined || price === null || price === "" ? null : Math.round(Number(price) * 1e4) / 1e4;
  if (p !== null && !(p >= 0.05 && p <= 50)) return { ok: false, error: "bad_price" };
  if (text) {
    const m = await moderate(text);
    if (!m.ok) return { ok: false, error: "blocked", why: m.why };
  }
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_deal_msg", { p_user: uid, p_deal: deal, p_body: text, p_price: p });
  return r.ok ? { ok: true } : { ok: false, error: r.reason || "closed" };
}
