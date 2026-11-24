import "server-only";
import { sign, verify } from "./session";
import type { Limits } from "./db";

import { rpc } from "./db";

/** The shop: subscription plans and AI credit packs, priced in USD and always sold in whole Pi at the live OKX rate. */
export type Catalog = {
  plans: Record<string, { name: string; usd: number; days: number; credits: number }>;
  packs: { id: string; usd: number; credits: number }[];
  costs: Record<string, number>;
  ai_daily_cap: number;
};

let catCache: { at: number; value: Catalog } | null = null;
export async function getCatalog(fresh = false): Promise<Catalog> {
  if (!fresh && catCache && Date.now() - catCache.at < 60_000) return catCache.value;
  const value = await rpc<Catalog>("ln_en_catalog");
  catCache = { at: Date.now(), value };
  return value;
}
export function forgetCatalog() { catCache = null; }

export type Quote = { t: "q"; kind: "plan" | "pack"; id: string; credits: number; usd: number; pi: number; rate: number; exp: number };

let priceCache: { at: number; rate: number; ok: boolean } | null = null;

/** A price outside this range is a data error or an attack, never a real Pi price. */
const sane = (r: number) => Number.isFinite(r) && r >= 0.001 && r <= 50;

async function okx(): Promise<number> {
  const res = await fetch("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT", { cache: "no-store", signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`okx_${res.status}`);
  const data = await res.json();
  const rate = parseFloat(data?.data?.[0]?.last);
  if (!sane(rate)) throw new Error("okx_bad_price");
  return rate;
}
async function gate(): Promise<number> {
  const res = await fetch("https://api.gateio.ws/api/v4/spot/tickers?currency_pair=PI_USDT", { cache: "no-store", signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`gate_${res.status}`);
  const rate = parseFloat((await res.json())?.[0]?.last);
  if (!sane(rate)) throw new Error("gate_bad_price");
  return rate;
}

/** PI/USDT last price from OKX (Gate.io only if OKX is down). Cached 30s per instance; an hour-old price is still used if both fail. */
export async function piUsdRate(): Promise<number> {
  if (priceCache && Date.now() - priceCache.at < 30_000) return priceCache.rate;
  try {
    let rate: number;
    try { rate = await okx(); } catch { rate = await gate(); }
    priceCache = { at: Date.now(), rate, ok: true };
    return rate;
  } catch (e) {
    if (priceCache && Date.now() - priceCache.at < 3600_000) return priceCache.rate;
    throw e;
  }
}

/** Whole Pi, always rounded up: 5.5 becomes 6. */
export const piFor = (usd: number, rate: number) => Math.max(1, Math.ceil(usd / rate - 1e-9));

export function makeQuotes(rate: number, cat: Catalog) {
  const exp = Date.now() + 10 * 60_000;
  const mk = (q: Quote) => ({ ...q, token: sign(q) });
  return {
    plans: Object.entries(cat.plans).map(([id, p]) => ({ ...mk({ t: "q", kind: "plan", id, credits: p.credits, usd: p.usd, pi: piFor(p.usd, rate), rate, exp }), name: p.name, days: p.days })),
    packs: cat.packs.map((p) => mk({ t: "q", kind: "pack", id: p.id, credits: p.credits, usd: p.usd, pi: piFor(p.usd, rate), rate, exp })),
  };
}

export function readQuote(token: unknown): Quote | null {
  if (typeof token !== "string") return null;
  const q = verify<Quote>(token);
  // Quotes are shown for 10 minutes; allow 10 more for a slow wallet confirmation.
  if (!q || q.t !== "q" || (q.kind !== "plan" && q.kind !== "pack") || typeof q.id !== "string") return null;
  if (!Number.isFinite(q.pi) || q.pi < 1 || !Number.isFinite(q.usd) || !Number.isInteger(q.credits) || q.credits < 0) return null;
  if (q.exp + 10 * 60_000 < Date.now()) return null;
  return q;
}

/* ---------- Muse Ember cost ---------- */

const TIER_LIMIT = 200_000;
const RATES = {
  low: { input: 0.10, cached: 0.004, output: 0.50 },
  high: { input: 0.30, cached: 0.012, output: 1.50 },
};

export type Usage = { input: number; cached: number; output: number };

export function usageCost(u: Usage) {
  const r = u.input > TIER_LIMIT ? RATES.high : RATES.low;
  const fresh = Math.max(0, u.input - u.cached);
  return (fresh * r.input + u.cached * r.cached + u.output * r.output) / 1_000_000;
}

export function creditsForCost(costUsd: number, cfg: Limits) {
  return Math.max(1, Math.ceil((costUsd * cfg.markup) / cfg.credit_usd));
}

/** Conservative token estimate. Arabic packs fewer characters per token than English. */
export function estimateTokens(text: string) {
  return Math.ceil(text.length / 2.5);
}

/** Inputs are trimmed to stay well under the 200K tier where every token costs 3x. */
export const INPUT_TOKEN_BUDGET = 150_000;
export const MAX_OUTPUT_TOKENS = 6_000;
export const MAX_ROUNDS = 3;
