import "server-only";
import { env } from "./env";

export class DbError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Calls a Learnly Postgres function. Every function checks the server secret itself. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: env.supabaseKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.dbSecret, ...args }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch {}
    throw new DbError(msg, res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export type DbUser = {
  id: string; pi_uid: string; username: string; role: "user" | "teacher" | "admin";
  credits: number; earned: number; paid: boolean; banned: boolean;
};

export type Limits = {
  markup: number; credit_usd: number; welcome_credits: number; free_daily_msgs: number;
  daily_budget_usd: number; max_reserve: number; file_fee: number; kill_free: boolean;
  max_per_minute?: number; daily_credit_cap?: number; min_withdraw?: number;
};

let cfgCache: { at: number; value: Limits } | null = null;

/** Limits change rarely; keep them for 60s per server instance to save database calls. */
export async function getLimits(fresh = false): Promise<Limits> {
  if (!fresh && cfgCache && Date.now() - cfgCache.at < 60_000) return cfgCache.value;
  const value = await rpc<Limits>("ln_get_config");
  cfgCache = { at: Date.now(), value };
  return value;
}

export function setLimitsCache(value: Limits) {
  cfgCache = { at: Date.now(), value };
}
