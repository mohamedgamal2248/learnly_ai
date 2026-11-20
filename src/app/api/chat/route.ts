import { rpc, getLimits } from "@/lib/server/db";
import { fail, rateLimited, requireSession } from "@/lib/server/http";
import { getBot } from "@/lib/server/bots";
import { streamChat, type ChatMessage, type ContentPart, type WebSource } from "@/lib/server/ai";
import { creditsForCost, estimateTokens, usageCost, INPUT_TOKEN_BUDGET, MAX_ROUNDS, type Usage } from "@/lib/server/pricing";
import {
  attachmentNote, buildSystem, SEARCH_EST_USD, toolsFor, wantsSearch, compactionPlan, fitHistory, langDirective, outputCap, pickEffort, runTool, summarize, wantsFile,
  type Attachment, type ChatContext, type FileRef,
} from "@/lib/server/harness";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Most tool calls one message may trigger (stops prompt-injected loops from burning credits). */
const MAX_TOOL_CALLS = 4;
const TOOLS_TOKENS = 1000;
/** Rough input cost of one resized image (~1280px). */
const IMAGE_TOKENS = 1600;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`chat:${s.uid}`, 8, 60_000)) return fail("slow_down", 429);

  let body: any;
  try { body = await req.json(); } catch { return fail("bad_request"); }
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const chatId = typeof body?.chatId === "string" && /^[0-9a-f-]{36}$/i.test(body.chatId) ? body.chatId : null;
  const replyChoice = ["ar", "en"].includes(body?.replyLang) ? body.replyLang : null;
  const images: string[] = Array.isArray(body?.images) ? body.images.filter((x: unknown) => typeof x === "string" && x.length < 1_400_000 && IMAGE_RE.test(x)).slice(0, 2) : [];
  const attIds: string[] = Array.isArray(body?.attachments) ? body.attachments.filter((x: unknown) => typeof x === "string" && UUID_RE.test(x)).slice(0, 3) : [];
  if ((!message && !images.length && !attIds.length) || typeof body?.botId !== "string" || !UUID_RE.test(body.botId)) return fail("bad_request");
  const text = message || (images.length ? "اشرحلي الصورة دي" : "لخّصلي الملف ده");

  const [bot, cfg, ctxRaw, atts] = await Promise.all([
    getBot(body.botId),
    getLimits(),
    chatId ? rpc<ChatContext | null>("ln_chat_context", { p_user: s.uid, p_chat: chatId }) : Promise.resolve(null),
    attIds.length ? rpc<Attachment[]>("ln_att_get", { p_user: s.uid, p_ids: attIds }) : Promise.resolve([] as Attachment[]),
  ]);
  if (attIds.length && atts.length !== attIds.length) return fail("att_missing", 404);
  if (!bot) return fail("bot_not_found", 404);
  if (bot.status !== "live" && bot.teacher_id !== s.uid && s.r !== "admin") return fail("bot_not_found", 404);
  const ctx: ChatContext = ctxRaw || { summary: "", upto: 0, messages: [] };

  // ---- what the model sees: [tools + system] (cached) → summary → recent turns → this message ----
  const system = buildSystem(bot);
  const notes = atts.map(attachmentNote).join("\n\n");
  const fixed = estimateTokens(system) + TOOLS_TOKENS + estimateTokens(text + notes) + images.length * IMAGE_TOKENS + 100;
  const hist = fitHistory(ctx, INPUT_TOKEN_BUDGET - fixed);
  const used = fixed + hist.tokens;

  const lastAssistant = [...ctx.messages].reverse().find((m) => m.role === "assistant")?.content;
  const fileLikely = wantsFile(text, lastAssistant);
  const effort = pickEffort(text, { image: images.length > 0 });
  // Turns that may read attachments need room for a second round with the passage it read.
  const toolish = fileLikely || atts.length > 0 || ctx.messages.some((m) => m.content.includes("[📎"));
  const outCap = outputCap(effort, fileLikely);
  const plan = chatId ? compactionPlan(ctx) : null;
  const tools = toolsFor(bot);
  const searchLikely = !!bot.web && wantsSearch(text);
  const modelText = (notes ? `${notes}\n\n` : "") + text + langDirective(replyChoice || bot.reply_lang || "auto");
  const modelContent: string | ContentPart[] = images.length
    ? [{ type: "text", text: modelText }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url } }))]
    : modelText;
  // What is stored with the chat: the text plus small markers (never the image or file itself).
  const storedMsg = [message, ...atts.map((a) => `[📎 ${a.name} #${a.id}]`), ...images.map(() => "[🖼]")].filter(Boolean).join("\n");

  // ---- reserve credits before calling the model (never more than the admin cap) ----
  const perRound = (used * 0.10 + outCap * 0.50) / 1_000_000;
  const aiUsd = perRound * (toolish || searchLikely ? 2 : 1) + (searchLikely ? SEARCH_EST_USD : 0) + (atts.length ? (3 * 3500 * 0.10) / 1_000_000 : 0) + (plan?.estCost || 0);
  const reserve = Math.min(cfg.max_reserve, creditsForCost(aiUsd, cfg) + bot.fee + (fileLikely ? cfg.file_fee : 0));
  const r = await rpc<{ ok: boolean; reason?: string; credits?: number; need?: number }>("ln_reserve", { p_user: s.uid, p_amount: reserve });
  if (!r.ok) return fail(r.reason || "no_credits", 402, { credits: r.credits, need: r.need });

  const encoder = new TextEncoder();
  const usage: Usage = { input: 0, cached: 0, output: 0 };
  let cost = 0;
  let reply = "";
  const files: FileRef[] = [];
  const sources: WebSource[] = [];
  const searches = { n: 0 };
  const addUsage = (u: Usage) => { cost += usageCost(u); usage.input += u.input; usage.cached += u.cached; usage.output += u.output; };
  const charge = () => creditsForCost(cost, cfg) + bot.fee + files.length * cfg.file_fee;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: object) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`)); } catch {} };
      const messages: ChatMessage[] = [{ role: "system", content: system }, ...hist.messages, { role: "user", content: modelContent }];
      const attMap = new Map(atts.map((a) => [a.id, a]));
      let errored = false;
      let toolCalls = 0;
      // Hard ceiling on model spend so the charge never exceeds the reservation.
      const usdLeft = () => ((reserve - bot.fee - files.length * cfg.file_fee) * cfg.credit_usd) / cfg.markup - cost;
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          if (round > 0) send({ t: "think" });
          const estIn = estimateTokens(messages.map((m) => (typeof m.content === "string" ? m.content : Array.isArray(m.content) ? modelText : "")).join("")) + TOOLS_TOKENS + images.length * IMAGE_TOKENS;
          const left = usdLeft() - (estIn * 0.10) / 1_000_000;
          const maxTokens = Math.min(outCap, Math.floor(left / (0.50 / 1_000_000)));
          if (maxTokens < 300) break; // out of budget: keep what we have rather than overspend
          let text = "";
          let gotUsage = false;
          let calls: { id: string; name: string; arguments: string }[] = [];
          for await (const ev of streamChat({
            // Tools stay in the request every round (stable cache prefix); after the cap the model is told to answer.
            messages, tools, maxTokens, cacheKey: `ln-bot-${bot.id}`, signal: req.signal,
            effort: round === 0 ? effort : "low",
          })) {
            if (ev.type === "text") { text += ev.text; reply += ev.text; send({ t: "d", v: ev.text }); }
            else if (ev.type === "tool_start") { if (ev.name === "create_file") send({ t: "making" }); else if (ev.name === "web_search") send({ t: "searching", v: "" }); }
            else { calls = ev.toolCalls; if (ev.usage.input || ev.usage.output) { gotUsage = true; addUsage(ev.usage); } }
          }
          if (!gotUsage) addUsage({ input: estIn, cached: 0, output: estimateTokens(text) + 200 });
          if (!calls.length) break;

          messages.push({
            role: "assistant", content: text || null,
            tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
          });
          for (const c of calls) {
            toolCalls++;
            const result = toolCalls > MAX_TOOL_CALLS
              ? { ok: false, error: "Tool limit reached. Answer now with what you have." }
              : await runTool(c.name, c.arguments, {
                uid: s.uid, attachments: attMap, files, send, signal: req.signal,
                web: !!bot.web, sources, searches,
                addCost: (usd, u) => { cost += usd; usage.input += u.input; usage.cached += u.cached; usage.output += u.output; },
                canAffordSearch: () => usdLeft() >= SEARCH_EST_USD,
                canAffordFile: () => reserve - charge() >= cfg.file_fee,
              });
            messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
          }
        }
      } catch (e: any) {
        errored = true;
        if (!req.signal.aborted) send({ t: "err", v: "ai_error" });
        console.error("chat error", e?.message);
      }

      if (!cost && reply) addUsage({ input: used, cached: 0, output: Math.ceil(reply.length / 2.5) });
      const nothingHappened = !reply && !files.length;
      if (nothingHappened && !errored && !req.signal.aborted) send({ t: "err", v: "ai_error" });

      // ---- compaction: fold older turns into the summary (paid from this turn's reservation) ----
      if (plan && !nothingHappened && !errored && chatId && usdLeft() >= plan.estCost) {
        try {
          const sm = await summarize(ctx, plan.fold);
          if (sm.summary) {
            addUsage(sm.usage);
            await rpc("ln_chat_set_summary", { p_user: s.uid, p_chat: chatId, p_summary: sm.summary, p_upto: plan.upto });
          }
        } catch (e: any) { console.error("compaction error", e?.message); }
      }

      // ---- settle: charge what was actually used, refund the rest, store the exchange ----
      const actual = nothingHappened ? 0 : Math.min(reserve, charge());
      try {
        const done = await rpc<{ credits: number; charged: number; chat_id: string | null }>("ln_chat_finish", {
          p_user: s.uid, p_bot: bot.id, p_chat: chatId, p_user_msg: nothingHappened ? null : storedMsg,
          p_reply: reply,
          // Web sources ride along with file refs (format "link") so the chat history can show them again.
          p_files: files.length || sources.length ? [...files, ...sources.map((x) => ({ id: "", format: "link", title: x.title, url: x.url }))] : null,
          p_reserved: reserve, p_actual: actual, p_cost_usd: Number(cost.toFixed(8)),
          p_teacher_share: nothingHappened ? 0 : Math.floor(bot.fee * 0.7),
          p_meta: { in: usage.input, cached: usage.cached, out: usage.output, files: files.length, effort, compact: !!plan, images: images.length, atts: atts.length, searches: searches.n },
        });
        send({ t: "done", charged: done.charged, credits: done.credits, chatId: done.chat_id });
        if (!nothingHappened) await rpc("ln_touch_streak", { p_user: s.uid }).catch(() => null);
      } catch (e: any) {
        console.error("settle error", e?.message);
      }
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
