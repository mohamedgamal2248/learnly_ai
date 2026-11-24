import { fail, rateLimited, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { streamChat } from "@/lib/server/ai";
import { getCatalog, usageCost } from "@/lib/server/pricing";
import { getLesson } from "@/lib/server/learn";
import { loadState } from "@/lib/server/learn/api";
import { isNative, type Native } from "@/lib/server/learn/types";
import { buildMessages, lessonContext, profileBlock, type Mode } from "@/lib/server/learn/tutor";

/** The tutor always runs on Muse Ember, with one stable cache key so every request shares the same cached prompt prefix. */
const TUTOR_MODEL = "muse-ember-1.0";
const TUTOR_CACHE_KEY = "learnly-tutor-v1";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The AI tutor (Muse Ember). Paid plans only. Each request costs a fixed number of credits that is taken first
 * and given back if the AI fails before producing anything. The answer streams back as plain text.
 */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`ai:${s.uid}`, 20, 60_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const mode: Mode = b?.mode === "chat" || b?.mode === "correct" ? b.mode : "explain";
  const text = String(b?.text || "").trim().slice(0, 1200);
  if (text.length < 2) return fail("empty");

  const st = await loadState(s.uid);
  if (!st) return fail("login_required", 401);
  if (!st.sub.plan) return fail("no_plan", 402);

  const cat = await getCatalog();
  const key = mode === "correct" && text.length > 300 ? "write" : mode;
  const cost = Math.min(Math.max(cat.costs[key] ?? 1, 1), 20);
  const spend = await rpc<{ ok: boolean; reason?: string; credits?: number }>("ln_en_spend", { p_user: s.uid, p_cost: cost, p_kind: key, p_ref: String(b?.lessonId || "").slice(0, 40) });
  if (!spend.ok) return fail(spend.reason || "no_credits", 402, { credits: spend.credits ?? st.credits });

  const lesson = typeof b?.lessonId === "string" ? getLesson(b.lessonId) : null;
  // Answers come in the language of the site when it is one of the four learner languages, otherwise in the learner's own language.
  const native: Native = isNative(b?.ui) ? b.ui : st.profile.native;
  const ctx = lesson ? lessonContext({ title: lesson.title, level: lesson.level, tip: lesson.intro[native], words: lesson.words.map((w) => ({ en: w.en, tr: w.tr[native], ex: w.ex })) }) : "";
  const history = Array.isArray(b?.history)
    ? b.history.filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-6)
    : [];
  const messages = buildMessages(profileBlock(mode, native, st.profile.level, ctx), history, text);

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      let produced = false;
      // "minimal" reasoning keeps answers fast and cheap. Reasoning tokens count against the output budget, so if the first try
      // ends with no visible text, one more try with a bigger budget runs before the credits are returned.
      const attempts = [{ max: 1500 }, { max: 3500 }];
      let lastError = "";
      for (const at of attempts) {
        try {
          let finish: string | null = null; let usage = { input: 0, cached: 0, output: 0 }; let got = false;
          for await (const ev of streamChat({ messages, maxTokens: at.max, cacheKey: TUTOR_CACHE_KEY, effort: "minimal", model: TUTOR_MODEL, signal: req.signal })) {
            if (ev.type === "text") {
              // Plain text only: strip any markdown the model still adds.
              const t = ev.text.replace(/\*+/g, "").replace(/^#{1,6}\s+/gm, "").replace(/`+/g, "");
              if (t) { produced = true; got = true; ctrl.enqueue(enc.encode(t)); }
            } else if (ev.type === "done") { finish = ev.finish; usage = ev.usage; }
          }
          console.log(`[tutor] ${mode} ok=${produced} finish=${finish} in=${usage.input} cached=${usage.cached} out=${usage.output}`);
          // Every call is recorded with its tokens and cost at the model price, for the admin profit view.
          await rpc("ln_ai_log_add", { p_user: s.uid, p_kind: key, p_model: TUTOR_MODEL, p_in: usage.input, p_cached: usage.cached, p_out: usage.output, p_cost: usageCost(usage), p_ok: got }).catch(() => {});
          if (produced) break;
          lastError = `empty reply (finish=${finish})`;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.error(`[tutor] ${mode} failed: ${lastError}`);
          if (produced) break;
        }
      }
      if (!produced) {
        console.error(`[tutor] giving up: ${lastError}`);
        await rpc("ln_en_refund", { p_user: s.uid, p_cost: cost, p_ref: `fail:${key}` }).catch(() => {});
        ctrl.enqueue(enc.encode("[[error]]" + (s.r === "admin" ? ` ${lastError}`.slice(0, 300) : "")));
      }
      try { ctrl.close(); } catch {}
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Credits": String(spend.credits ?? ""), "X-Cost": String(cost) },
  });
}
