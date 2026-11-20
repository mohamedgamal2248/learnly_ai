import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { completeChat, pickJson, TRANSLATE_TOOL } from "@/lib/server/ai";
import { forgetBot } from "@/lib/server/bots";

export const runtime = "nodejs";
export const maxDuration = 30;

const TRACKS = ["school", "uni", "job", "code", "lang", "academy"];
const UUID = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Full details of one of the teacher's bots, for the editor (materials listed by name, not content). */
export async function GET(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID.test(id)) return fail("bad_request");
  const bot = await rpc("ln_bot_detail", { p_user: a.u.id, p_bot: id });
  return bot ? json({ bot }) : fail("not_found", 404);
}

/** Fills whichever language the teacher left empty, so every bot shows in Arabic and English. */
async function fillLanguages(b: Record<string, string>) {
  const pairs: [string, string][] = [["name", "name_en"], ["subject", "subject_en"], ["description", "description_en"]];
  if (pairs.every(([ar, en]) => !b[ar] === !b[en])) return b;
  try {
    const r = await completeChat({
      messages: [
        { role: "system", content: "You translate short labels for an education app between Arabic (Egyptian-friendly Modern Standard) and English. Keep names natural, not literal. Call the bilingual tool." },
        { role: "user", content: JSON.stringify({ name_ar: b.name, name_en: b.name_en, subject_ar: b.subject, subject_en: b.subject_en, description_ar: b.description, description_en: b.description_en }) },
      ],
      tools: [TRANSLATE_TOOL], maxTokens: 800, cacheKey: "ln-translate",
    });
    const t = pickJson(r, "bilingual");
    if (t) {
      return {
        ...b,
        name: b.name || str(t.name_ar, 80), name_en: b.name_en || str(t.name_en, 80),
        subject: b.subject || str(t.subject_ar, 80), subject_en: b.subject_en || str(t.subject_en, 80),
        description: b.description || str(t.description_ar, 400), description_en: b.description_en || str(t.description_en, 400),
      };
    }
  } catch (e: any) {
    console.error("translate failed", e?.message);
  }
  // Never leave a side blank: fall back to the language the teacher wrote.
  return {
    ...b,
    name: b.name || b.name_en, name_en: b.name_en || b.name,
    subject: b.subject || b.subject_en, subject_en: b.subject_en || b.subject,
    description: b.description || b.description_en, description_en: b.description_en || b.description,
  };
}

/** Create or update a teacher bot. Any change sends it back to admin review before it goes live. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  if (rateLimited(`savebot:${a.u.id}`, 10, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad_request");
  let bot: Record<string, any> = {
    name: str(b.name, 80), name_en: str(b.name_en, 80), subject: str(b.subject, 80), subject_en: str(b.subject_en, 80),
    description: str(b.description, 400), description_en: str(b.description_en, 400),
  };
  if (!(bot.name || bot.name_en) || !(bot.subject || bot.subject_en)) return fail("missing_fields");
  bot = await fillLanguages(bot);
  Object.assign(bot, {
    ...(typeof b.id === "string" && UUID.test(b.id) ? { id: b.id } : {}),
    track: TRACKS.includes(b.track) ? b.track : "school",
    instructions: str(b.instructions, 4000), notes: str(b.notes, 100_000),
    reply_lang: ["ar", "en"].includes(b.reply_lang) ? b.reply_lang : "auto",
    fee: Math.max(0, Math.min(20, parseInt(b.fee, 10) || 0)),
  });
  const files = (Array.isArray(b.files) ? b.files : []).slice(0, 30).flatMap((f: any) =>
    typeof f?.id === "string" && UUID.test(f.id) ? [{ id: f.id }]
      : typeof f?.body === "string" && f.body.trim() ? [{ name: str(f.name, 160) || "file", body: f.body.slice(0, 300_000) }] : []);
  try {
    const r = await rpc<{ id: string }>("ln_save_bot2", { p_user: a.u.id, p_bot: bot, p_files: files });
    forgetBot(r.id);
    return json(r);
  } catch (e: any) {
    return fail(String(e.message).includes("too many") ? "too_many_bots" : "server_error");
  }
}
