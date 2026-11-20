import { rpc, getLimits } from "@/lib/server/db";
import { fail, rateLimited, requireSession } from "@/lib/server/http";
import { streamChat, CREATE_FILE_TOOL, type ChatMessage } from "@/lib/server/ai";
import {
  creditsForCost, estimateTokens, usageCost, INPUT_TOKEN_BUDGET, MAX_OUTPUT_TOKENS, MAX_ROUNDS, type Usage,
} from "@/lib/server/pricing";
import { normalizeSpec } from "@/lib/server/files/spec";

export const runtime = "nodejs";
export const maxDuration = 60;

type Bot = {
  id: string; teacher_id: string | null; name: string; subject: string; instructions: string;
  knowledge: string; fee: number; status: string;
};

const BASE_RULES = `You are a tutor on Learnly AI, a learning app for adults (18+) inside the Pi Network ecosystem.
Rules:
- Reply in the student's language and dialect (Egyptian Arabic stays Egyptian Arabic). Keep answers short and clear: small paragraphs, bullet lists, no long preambles.
- Teach, don't just answer: check understanding with a short question when it helps. Do not write graded homework or exam answers for submission; explain the method instead.
- If teacher materials are provided, answer from them first and cite them like (المصدر: file, page or slide). If the materials don't cover the question, say so, then answer from general knowledge and mark it as general.
- Never ask for, store or repeat a Pi wallet passphrase, private key or password. If someone shares one, tell them to move their funds to a new wallet.
- No Pi price predictions, gambling, or medical, legal or financial advice beyond general education.
- Files: when the student asks for a PDF, Word, PowerPoint or Excel file, call create_file once with the complete content. After it succeeds, reply with one short sentence. Never paste the file contents or any link; the app shows a download button.`;

function buildSystem(bot: Bot) {
  const parts = [BASE_RULES, `\n## This bot\nName: ${bot.name}\nSubject: ${bot.subject}`];
  if (bot.instructions) parts.push(`\n## Teacher instructions\n${bot.instructions}`);
  let system = parts.join("\n");
  if (bot.knowledge) {
    // Keep the system prompt (which is cached) to at most 60% of the input budget.
    const room = Math.floor(INPUT_TOKEN_BUDGET * 0.6 - estimateTokens(system)) * 2.5;
    const k = bot.knowledge.length > room ? bot.knowledge.slice(0, Math.max(0, room)) : bot.knowledge;
    system += `\n\n## Teacher materials\n${k}`;
  }
  return system;
}

function cleanHistory(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-60).flatMap((m: any) => {
    if (m?.role !== "user" && m?.role !== "assistant") return [];
    const content = typeof m.content === "string" ? m.content.slice(0, m.role === "user" ? 4000 : 12000) : "";
    return content.trim() ? [{ role: m.role, content }] : [];
  });
}

export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`chat:${s.uid}`, 8, 60_000)) return fail("slow_down", 429);

  let body: any;
  try { body = await req.json(); } catch { return fail("bad_request"); }
  const history = cleanHistory(body?.messages);
  if (!history.length || history[history.length - 1].role !== "user") return fail("bad_request");
  if (typeof body?.botId !== "string") return fail("bad_request");

  const [bot, cfg] = await Promise.all([rpc<Bot | null>("ln_get_bot", { p_bot: body.botId }), getLimits()]);
  if (!bot) return fail("bot_not_found", 404);
  if (bot.status !== "live" && bot.teacher_id !== s.uid && s.r !== "admin") return fail("bot_not_found", 404);

  // ---- fit everything under the input budget (cheaper tier, predictable cost) ----
  const system = buildSystem(bot);
  const fixed = estimateTokens(system) + 1200; // tool schema
  let used = fixed;
  const kept: typeof history = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const t = estimateTokens(history[i].content) + 8;
    if (used + t > INPUT_TOKEN_BUDGET) break;
    used += t;
    kept.unshift(history[i]);
  }
  if (!kept.length) return fail("message_too_long");

  // ---- reserve credits before calling the model ----
  const perRound = (used * 0.10 + MAX_OUTPUT_TOKENS * 0.50) / 1_000_000;
  const reserve = Math.min(cfg.max_reserve, creditsForCost(perRound * 2, cfg) + bot.fee + cfg.file_fee);
  const r = await rpc<{ ok: boolean; reason?: string; credits?: number; need?: number }>("ln_reserve", {
    p_user: s.uid, p_amount: reserve,
  });
  if (!r.ok) return fail(r.reason || "no_credits", 402, { credits: r.credits, need: r.need });

  const encoder = new TextEncoder();
  const usage: Usage = { input: 0, cached: 0, output: 0 };
  let cost = 0;
  let streamedChars = 0;
  let files = 0;
  // Every round is its own request and is priced on its own tier, then summed.
  const addRound = (u: Usage) => {
    cost += usageCost(u);
    usage.input += u.input; usage.cached += u.cached; usage.output += u.output;
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      const messages: ChatMessage[] = [{ role: "system", content: system }, ...kept];
      let errored = false;
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          if (round > 0) send({ t: "think" });
          let text = "";
          let gotUsage = false;
          let calls: { id: string; name: string; arguments: string }[] = [];
          for await (const ev of streamChat({
            messages, tools: [CREATE_FILE_TOOL], maxTokens: MAX_OUTPUT_TOKENS, cacheKey: `ln-bot-${bot.id}`, signal: req.signal,
          })) {
            if (ev.type === "text") {
              text += ev.text;
              streamedChars += ev.text.length;
              send({ t: "d", v: ev.text });
            } else {
              calls = ev.toolCalls;
              if (ev.usage.input || ev.usage.output) {
                gotUsage = true;
                addRound(ev.usage);
              }
            }
          }
          // No usage chunk (rare): bill a pessimistic estimate instead of nothing.
          if (!gotUsage) addRound({ input: used, cached: 0, output: estimateTokens(text) + 200 });
          if (!calls.length) break;

          messages.push({
            role: "assistant", content: text || null,
            tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
          });
          for (const c of calls) {
            let result: object = { ok: false, error: "unknown tool" };
            if (c.name === "create_file") {
              if (files >= 2) result = { ok: false, error: "File limit reached for this message." };
              else {
                let parsed: unknown = null;
                try { parsed = JSON.parse(c.arguments || "{}"); } catch {}
                const spec = normalizeSpec(parsed);
                if (!spec) result = { ok: false, error: "The file content was empty or invalid. Fill sections, slides or sheets." };
                else {
                  send({ t: "making", format: spec.format });
                  const id = await rpc<string>("ln_file_save", {
                    p_user: s.uid, p_format: spec.format, p_title: spec.title, p_spec: spec,
                  });
                  files++;
                  send({ t: "file", id, format: spec.format, title: spec.title });
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

      // ---- settle: charge what was actually used, refund the rest ----
      // Aborted mid-stream before the usage chunk arrived: estimate what was spent.
      if (!cost && streamedChars) addRound({ input: used, cached: 0, output: Math.ceil(streamedChars / 2.5) });
      const nothingHappened = errored && !streamedChars && !files;
      const actual = nothingHappened ? 0 : Math.min(reserve, creditsForCost(cost, cfg) + bot.fee + files * cfg.file_fee);
      try {
        const settled = await rpc<{ credits: number; charged: number }>("ln_settle", {
          p_user: s.uid, p_reserved: reserve, p_actual: actual, p_cost_usd: Number(cost.toFixed(8)),
          p_bot: bot.id, p_teacher_share: nothingHappened ? 0 : Math.floor(bot.fee * 0.7),
          p_meta: { in: usage.input, cached: usage.cached, out: usage.output, files },
        });
        if (!req.signal.aborted) send({ t: "done", charged: settled.charged, credits: settled.credits });
      } catch (e: any) {
        console.error("settle error", e?.message);
      }
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
