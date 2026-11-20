import "server-only";
import { sign, verify } from "./session";
import type { Limits } from "./db";

/** Credit packs. Priced in USD internally, always sold in Pi at the live OKX rate. */
export const PACKS = [
  { id: "s", credits: 1000, usd: 1 },
  { id: "m", credits: 5500, usd: 5 },
  { id: "l", credits: 12000, usd: 10 },
] as const;

export type Quote = { pack: string; credits: number; usd: number; pi: number; rate: number; exp: number };

let priceCache: { at: number; rate: number } | null = null;

/** PI/USDT last price from OKX. Cached 30s per instance so a busy buy page doesn't hammer OKX. */
export async function piUsdRate(): Promise<number> {
  if (priceCache && Date.now() - priceCache.at < 30_000) return priceCache.rate;
  const res = await fetch("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT", { cache: "no-store" });
  if (!res.ok) throw new Error(`okx_${res.status}`);
  const data = await res.json();
  const rate = parseFloat(data?.data?.[0]?.last);
  if (!(rate > 0)) throw new Error("okx_bad_price");
  priceCache = { at: Date.now(), rate };
  return rate;
}

export function makeQuotes(rate: number) {
  const exp = Date.now() + 10 * 60_000;
  return PACKS.map((p) => {
    const pi = Math.ceil((p.usd / rate) * 10_000) / 10_000;
    const q: Quote = { pack: p.id, credits: p.credits, usd: p.usd, pi, rate, exp };
    return { ...q, token: sign(q) };
  });
}

export function readQuote(token: unknown): Quote | null {
  if (typeof token !== "string") return null;
  const q = verify<Quote>(token);
  // Quotes are shown for 10 minutes; allow 10 more for a slow wallet confirmation.
  if (!q || q.exp + 10 * 60_000 < Date.now()) return null;
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
