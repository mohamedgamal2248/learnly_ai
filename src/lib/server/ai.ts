import "server-only";
import { env } from "./env";

/** Meta Model API, OpenAI-compatible Chat Completions. Docs: https://dev.meta.ai/docs/protocols/chat-completions */
const URL = "https://api.meta.ai/v1/chat/completions";

export type ToolCall = { id: string; name: string; arguments: string };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "done"; toolCalls: ToolCall[]; finish: string | null; usage: { input: number; cached: number; output: number } };

export async function* streamChat(opts: {
  messages: ChatMessage[];
  tools?: unknown[];
  maxTokens: number;
  cacheKey: string;
  signal?: AbortSignal;
}): AsyncGenerator<StreamEvent> {
  const res = await fetch(URL, {
    method: "POST",
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${env.metaApiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: env.metaModel,
      messages: opts.messages,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: opts.maxTokens,
      // Ember defaults to "max" reasoning, which is slow and billed as output. Tutoring needs little.
      reasoning_effort: "low",
      // Automatic prefix caching: same system prompt + tools first, then history. Stable key per bot.
      prompt_cache_key: opts.cacheKey,
      prompt_cache_retention: "24h",
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`meta_${res.status}: ${detail.slice(0, 300)}`);
  }

  const calls = new Map<number, ToolCall>();
  let finish: string | null = null;
  const usage = { input: 0, cached: 0, output: 0 };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: any;
      try { chunk = JSON.parse(data); } catch { continue; }
      if (chunk.usage) {
        usage.input = chunk.usage.prompt_tokens || 0;
        usage.output = chunk.usage.completion_tokens || 0;
        usage.cached = chunk.usage.prompt_tokens_details?.cached_tokens || 0;
      }
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finish = choice.finish_reason;
      const delta = choice.delta || {};
      if (typeof delta.content === "string" && delta.content) yield { type: "text", text: delta.content };
      for (const tc of delta.tool_calls || []) {
        const i = tc.index ?? 0;
        if (!calls.has(i) && tc.function?.name) yield { type: "tool_start", name: tc.function.name };
        const cur = calls.get(i) || { id: "", name: "", arguments: "" };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.arguments += tc.function.arguments;
        calls.set(i, cur);
      }
    }
  }
  yield { type: "done", toolCalls: [...calls.values()].filter((c) => c.name), finish, usage };
}

/** One-shot call that waits for the whole reply. Used for short helper jobs (bot drafts, translation). */
export async function completeChat(opts: { messages: ChatMessage[]; tools?: unknown[]; maxTokens: number; cacheKey: string }) {
  let text = "";
  let toolCalls: ToolCall[] = [];
  let usage = { input: 0, cached: 0, output: 0 };
  for await (const ev of streamChat(opts)) {
    if (ev.type === "text") text += ev.text;
    else if (ev.type === "done") { toolCalls = ev.toolCalls; usage = ev.usage; }
  }
  return { text, toolCalls, usage };
}

/** Pulls a JSON object out of a tool call or, failing that, out of the reply text. */
export function pickJson(r: { text: string; toolCalls: ToolCall[] }, tool: string): Record<string, any> | null {
  const call = r.toolCalls.find((c) => c.name === tool);
  const tryParse = (s: string) => { try { const v = JSON.parse(s); return v && typeof v === "object" ? v : null; } catch { return null; } };
  if (call) { const v = tryParse(call.arguments); if (v) return v; }
  const m = r.text.match(/\{[\s\S]*\}/);
  return m ? tryParse(m[0]) : null;
}

export const PROPOSE_BOT_TOOL = {
  type: "function",
  function: {
    name: "propose_bot",
    description: "Return the complete draft of a tutor bot, in Arabic and English.",
    parameters: {
      type: "object",
      properties: {
        name_ar: { type: "string" }, name_en: { type: "string" },
        subject_ar: { type: "string", description: "Subject and level, e.g. كيمياء — تالتة ثانوي" }, subject_en: { type: "string" },
        description_ar: { type: "string", description: "1-2 sentences for students" }, description_en: { type: "string" },
        track: { type: "string", enum: ["school", "uni", "job", "code", "lang", "academy"] },
        instructions: { type: "string", description: "Teaching instructions for the bot: audience, level, style, what to focus on, what to avoid. 80-200 words." },
        fee: { type: "integer", description: "Suggested credits per message for the teacher, 0-10" },
        starters_ar: { type: "array", items: { type: "string" }, description: "3 example questions a student could ask" },
      },
      required: ["name_ar", "name_en", "subject_ar", "subject_en", "description_ar", "description_en", "track", "instructions"],
    },
  },
};

export const TRANSLATE_TOOL = {
  type: "function",
  function: {
    name: "bilingual",
    description: "Return each field in both Arabic and English.",
    parameters: {
      type: "object",
      properties: {
        name_ar: { type: "string" }, name_en: { type: "string" },
        subject_ar: { type: "string" }, subject_en: { type: "string" },
        description_ar: { type: "string" }, description_en: { type: "string" },
      },
      required: ["name_ar", "name_en", "subject_ar", "subject_en", "description_ar", "description_en"],
    },
  },
};

/* ---------- tools the tutor can use ---------- */

export const CREATE_FILE_TOOL = {
  type: "function",
  function: {
    name: "create_file",
    description:
      "Create a downloadable file for the student: a PDF or Word document (use sections), a PowerPoint deck (use slides), or an Excel workbook (use sheets). Call it only when the student asks for a file. Write the content in the student's language.",
    parameters: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["pdf", "docx", "pptx", "xlsx"] },
        title: { type: "string", description: "Short file title" },
        lang: { type: "string", enum: ["ar", "en"], description: "Main language of the content" },
        sections: {
          type: "array",
          description: "For pdf and docx",
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              paragraphs: { type: "array", items: { type: "string" } },
              bullets: { type: "array", items: { type: "string" } },
              table: { type: "array", description: "First row is the header", items: { type: "array", items: { type: "string" } } },
            },
          },
        },
        slides: {
          type: "array",
          description: "For pptx. 5 to 12 slides, at most 6 short bullets each",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
              notes: { type: "string" },
            },
            required: ["title"],
          },
        },
        sheets: {
          type: "array",
          description: "For xlsx. First row of each sheet is the header. Use numbers as numbers.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              rows: { type: "array", items: { type: "array", items: { type: ["string", "number"] } } },
            },
            required: ["name", "rows"],
          },
        },
      },
      required: ["format", "title", "lang"],
    },
  },
};
