import { randomUUID } from "crypto";
import { rpc, getLimits } from "@/lib/server/db";
import { fail, rateLimited, requireSession } from "@/lib/server/http";
import { getBot, type Bot } from "@/lib/server/bots";
import { streamChat, CREATE_FILE_TOOL, type ChatMessage } from "@/lib/server/ai";
import {
  creditsForCost, estimateTokens, usageCost, INPUT_TOKEN_BUDGET, MAX_OUTPUT_TOKENS, MAX_ROUNDS, type Usage,
} from "@/lib/server/pricing";
import { normalizeSpec } from "@/lib/server/files/spec";

export const runtime = "nodejs";
export const maxDuration = 60;

type FileRef = { id: string; format: string; title: string };
type Stored = { role: "user" | "assistant"; content: string; files: FileRef[] | null };

const BASE_RULES = `You are a tutor on Learnly AI, a learning app for adults (18+) inside the Pi Network ecosystem.
Rules:
- Reply in the student's language and dialect (Egyptian Arabic stays Egyptian Arabic, English stays English). Keep answers short and clear: small paragraphs, bullet lists, no long preambles.
- Teach, don't just answer: check understanding with a short question when it helps. Do not write graded homework or exam answers for submission; explain the method instead.
- If teacher materials are provided, answer from them first and cite them like (المصدر: file, page or slide) / (Source: file, page or slide). If the materials don't cover the question, say so, then answer from general knowledge and mark it as general.
- Never ask for, store or repeat a Pi wallet passphrase, private key or password. If someone shares one, tell them to move their funds to a new wallet.
- No Pi price predictions, gambling, or medical, legal or financial advice beyond general education.
- Files: when the student asks for a PDF, Word, PowerPoint or Excel file, call create_file once with the complete content. After it succeeds, reply with one short sentence. Never paste the file contents or any link; the app shows a download button.`;

function buildSystem(bot: Bot) {
  const parts = [BASE_RULES, `\n## This bot\nName: ${bot.name}${bot.name_en ? ` / ${bot.name_en}` : ""}\nSubject: ${bot.subject}${bot.subject_en ? ` / ${bot.subject_en}` : ""}`];
  if (bot.instructions) parts.push(`\n## Teacher instructions\n${bot.instructions}`);
  let system = parts.join("\n");
  if (bot.knowledge) {
    // The system prompt is the cached part; keep it to at most 60% of the input budget.
    const room = Math.floor((INPUT_TOKEN_BUDGET * 0.6 - estimateTokens(system)) * 2.5);
    system += `\n\n## Teacher materials\n${bot.knowledge.length > room ? bot.knowledge.slice(0, Math.max(0, room)) : bot.knowledge}`;
  }
  return system;
}

/**
 * The file tool's schema is only sent when the conversation is about making a file.
 * Most messages are plain tutoring, so they go out without it (smaller, faster requests).
 */
const FILE_WORDS = /\b(pdf|pdt|pfd|docx?|word|pptx?|power ?point|slides?|presentation|excel|xlsx|sheet|spreadsheet|file|download)\b|ملف|ملخص|عرض|شرائح|سلايد|بوربوينت|باوربوينت|وورد|ورد|اكسل|إكسل|جدول|شيت|تحميل|نزّل|نزل|بي ?دي ?[اإ]ف/i;
function wantsFile(message: string, lastAssistant?: string) {
  if (FILE_WORDS.test(message)) return true;
  // "yes, do it" right after the tutor offered a file
  return !!lastAssistant && FILE_WORDS.test(lastAssistant.slice(-400)) && message.length < 60;
}

/** Explanation language: the student's choice in the chat, else the teacher's default for the bot. */
function langDirective(choice: string) {
  if (choice === "ar") return "\n\n[App setting: explain in simple Egyptian Arabic. Keep English only for the words, sentences or code being taught, and give their Arabic meaning.]";
  if (choice === "en") return "\n\n[App setting: reply in English only.]";
  return "";
}

const asModelText = (m: Stored) =>
  m.files?.length ? `${m.content}\n${m.files.map((f) => `[file created: ${f.title}.${f.format}]`).join("\n")}` : m.content;

export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`chat:${s.uid}`, 8, 60_000)) return fail("slow_down", 429);

  let body: any;
  try { body = await req.json(); } catch { return fail("bad_request"); }
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const chatId = typeof body?.chatId === "string" && /^[0-9a-f-]{36}$/i.test(body.chatId) ? body.chatId : null;
  const replyChoice = ["ar", "en"].includes(body?.replyLang) ? body.replyLang : null;
  if (!message || typeof body?.botId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.botId)) return fail("bad_request");

  const [bot, cfg, stored] = await Promise.all([
    getBot(body.botId),
    getLimits(),
    chatId ? rpc<Stored[] | null>("ln_chat_history", { p_user: s.uid, p_chat: chatId }) : Promise.resolve([] as Stored[]),
  ]);
  if (!bot) return fail("bot_not_found", 404);
  if (bot.status !== "live" && bot.teacher_id !== s.uid && s.r !== "admin") return fail("bot_not_found", 404);

  // ---- fit everything under the input budget (cheaper tier, predictable cost) ----
  const system = buildSystem(bot);
  let used = estimateTokens(system) + 1200 + estimateTokens(message);
  const kept: ChatMessage[] = [];
  const history = stored || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const text = asModelText(history[i]);
    const t = estimateTokens(text) + 8;
    if (used + t > INPUT_TOKEN_BUDGET) break;
    used += t;
    kept.unshift({ role: history[i].role, content: text });
  }
  // The model expects user/assistant turns to start with the user.
  while (kept.length && kept[0].role !== "user") kept.shift();

  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content;
  const tools = wantsFile(message, lastAssistant) ? [CREATE_FILE_TOOL] : [];
  const modelMessage = message + langDirective(replyChoice || bot.reply_lang || "auto");

  // ---- reserve credits before calling the model ----
  const perRound = (used * 0.10 + MAX_OUTPUT_TOKENS * 0.50) / 1_000_000;
  const reserve = Math.min(cfg.max_reserve, creditsForCost(perRound * (tools.length ? 2 : 1), cfg) + bot.fee + (tools.length ? cfg.file_fee : 0));
  const r = await rpc<{ ok: boolean; reason?: string; credits?: number; need?: number }>("ln_reserve", {
    p_user: s.uid, p_amount: reserve,
  });
  if (!r.ok) return fail(r.reason || "no_credits", 402, { credits: r.credits, need: r.need });

  const encoder = new TextEncoder();
  const usage: Usage = { input: 0, cached: 0, output: 0 };
  let cost = 0;
  let reply = "";
  const files: FileRef[] = [];
  const addRound = (u: Usage) => {
    cost += usageCost(u);
    usage.input += u.input; usage.cached += u.cached; usage.output += u.output;
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`)); } catch {}
      };
      const messages: ChatMessage[] = [{ role: "system", content: system }, ...kept, { role: "user", content: modelMessage }];
      let errored = false;
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          if (round > 0) send({ t: "think" });
          let text = "";
          let gotUsage = false;
          let calls: { id: string; name: string; arguments: string }[] = [];
          for await (const ev of streamChat({
            messages, tools, maxTokens: MAX_OUTPUT_TOKENS, cacheKey: `ln-bot-${bot.id}`, signal: req.signal,
          })) {
            if (ev.type === "text") { text += ev.text; reply += ev.text; send({ t: "d", v: ev.text }); }
            else if (ev.type === "tool_start") { if (ev.name === "create_file") send({ t: "making" }); }
            else {
              calls = ev.toolCalls;
              if (ev.usage.input || ev.usage.output) { gotUsage = true; addRound(ev.usage); }
            }
          }
          if (!gotUsage) addRound({ input: used, cached: 0, output: estimateTokens(text) + 200 });
          if (!calls.length) break;

          messages.push({
            role: "assistant", content: text || null,
            tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
          });
          for (const c of calls) {
            let result: object = { ok: false, error: "unknown tool" };
            if (c.name === "create_file") {
              if (files.length >= 2) result = { ok: false, error: "File limit reached for this message." };
              else {
                let parsed: unknown = null;
                try { parsed = JSON.parse(c.arguments || "{}"); } catch {}
                const spec = normalizeSpec(parsed);
                if (!spec) result = { ok: false, error: "The file content was empty or invalid. Fill sections, slides or sheets." };
                else {
                  // The file itself is kept on the student's device; only a reference is stored with the chat.
                  const ref = { id: randomUUID(), format: spec.format, title: spec.title };
                  files.push(ref);
                  send({ t: "file", ...ref, spec });
                  result = { ok: true, note: "The student now sees a download button. Reply with one short sentence." };
                }
              }
            }
            messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
          }
        }
      } catch (e: any) {
        errored = true;
        if (!req.signal.aborted) send({ t: "err", v: "ai_error" });
        console.error("chat error", e?.message);
      }

      // ---- settle: charge what was actually used, refund the rest, store the exchange ----
      if (!cost && reply) addRound({ input: used, cached: 0, output: Math.ceil(reply.length / 2.5) });
      const nothingHappened = errored && !reply && !files.length;
      const actual = nothingHappened ? 0 : Math.min(reserve, creditsForCost(cost, cfg) + bot.fee + files.length * cfg.file_fee);
      try {
        const done = await rpc<{ credits: number; charged: number; chat_id: string | null }>("ln_chat_finish", {
          p_user: s.uid, p_bot: bot.id, p_chat: chatId, p_user_msg: nothingHappened ? null : message,
          p_reply: reply, p_files: files.length ? files : null,
          p_reserved: reserve, p_actual: actual, p_cost_usd: Number(cost.toFixed(8)),
          p_teacher_share: nothingHappened ? 0 : Math.floor(bot.fee * 0.7),
          p_meta: { in: usage.input, cached: usage.cached, out: usage.output, files: files.length },
        });
        send({ t: "done", charged: done.charged, credits: done.credits, chatId: done.chat_id });
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
