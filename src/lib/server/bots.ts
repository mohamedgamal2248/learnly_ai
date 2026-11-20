import "server-only";
import { rpc } from "./db";

export type Bot = {
  id: string; teacher_id: string | null; name: string; name_en: string; subject: string; subject_en: string;
  description: string; description_en: string; instructions: string; knowledge: string; fee: number;
  status: string; official: boolean; teacher_name: string | null; track: string;
};

const cache = new Map<string, { at: number; bot: Bot | null }>();

/** Bots change rarely; keep each one for 60s per server instance to save a database call per message. */
export async function getBot(id: string, fresh = false): Promise<Bot | null> {
  const hit = cache.get(id);
  if (!fresh && hit && Date.now() - hit.at < 60_000) return hit.bot;
  const bot = await rpc<Bot | null>("ln_get_bot", { p_bot: id });
  cache.set(id, { at: Date.now(), bot });
  if (cache.size > 500) cache.clear();
  return bot;
}

export function forgetBot(id: string) {
  cache.delete(id);
}
