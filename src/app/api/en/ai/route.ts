import { fail, rateLimited, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { streamChat } from "@/lib/server/ai";
import { getCatalog } from "@/lib/server/pricing";
import { getLesson } from "@/lib/server/learn";
import { loadState } from "@/lib/server/learn/api";
import { isNative, type Native } from "@/lib/server/learn/types";
import { buildMessages, lessonContext, systemFor, type Mode } from "@/lib/server/learn/tutor";

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
    ? b.history.filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string").slice(-6)
    : [];
  const messages = buildMessages(systemFor(mode, native, st.profile.level, ctx), history, text);

  const enc = new TextEncoder();
  let produced = false;
  const body = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const ev of streamChat({ messages, maxTokens: mode === "correct" ? 700 : 500, cacheKey: `en-${mode}-${native}`, effort: "low", signal: req.signal })) {
          if (ev.type === "text") {
            // Plain text only: strip any markdown the model still adds.
            const t = ev.text.replace(/\*+/g, "").replace(/^#{1,6}\s+/gm, "").replace(/`+/g, "");
            if (t) { produced = true; ctrl.enqueue(enc.encode(t)); }
          }
        }
        if (!produced) throw new Error("empty_reply");
        ctrl.close();
      } catch {
        if (!produced) {
          await rpc("ln_en_refund", { p_user: s.uid, p_cost: cost, p_ref: `fail:${key}` }).catch(() => {});
          ctrl.enqueue(enc.encode("[[error]]"));
        }
        try { ctrl.close(); } catch {}
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Credits": String(spend.credits ?? ""), "X-Cost": String(cost) },
  });
}
