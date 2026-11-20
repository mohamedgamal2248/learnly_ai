"use client";

export type BotInfo = {
  id: string; name: string; name_en?: string; subject: string; subject_en?: string; track: string;
  description: string; description_en?: string; fee: number;
  official: boolean; teacher_name: string | null; has_knowledge: boolean; status?: string; teacher_id?: string | null;
};

let cache: { at: number; bots: BotInfo[] } | null = null;

/** Bot list is fetched once per visit (and cached at the CDN), not on every page. */
export async function loadBots(): Promise<BotInfo[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.bots;
  const r = await fetch("/api/bots");
  const d = await r.json();
  cache = { at: Date.now(), bots: d.bots || [] };
  return cache.bots;
}

export const TRACK_KEYS = {
  school: "tSchool", uni: "tUni", job: "tJob", code: "tCode", lang: "tLang", academy: "tAcademy",
} as const;

export function lastBot(): { id: string; name: string } | null {
  try { return JSON.parse(localStorage.getItem("ln-last-bot") || "null"); } catch { return null; }
}

/** Shows a bot in the visitor's language, falling back to the other one. */
export function botText(b: BotInfo, lang: "ar" | "en") {
  const en = lang === "en";
  return {
    name: (en ? b.name_en : b.name) || b.name || b.name_en || "",
    subject: (en ? b.subject_en : b.subject) || b.subject || b.subject_en || "",
    description: (en ? b.description_en : b.description) || b.description || b.description_en || "",
  };
}
