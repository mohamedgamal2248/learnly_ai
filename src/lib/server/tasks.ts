import "server-only";
import { rpc } from "./db";
import { normalizeSpec } from "./files/spec";
import { moderate } from "./moderation";

/** What the worker hands back: plain text, a PDF/Word document, or a PowerPoint. */
export type Delivery = "text" | "pdf" | "ppt";
export const DELIVERIES: Delivery[] = ["text", "pdf", "ppt"];

export const DELIVERY_GUIDE: Record<Delivery, string> = {
  text: "Deliver the finished work as Markdown in `text` (clear, complete, in the requested language). If the task is research, end with the sources you actually read (title + URL).",
  pdf: "Deliver a document in `file` with format \"pdf\": {format, title, lang, sections:[{heading, paragraphs[], bullets[], table[][]}]}. `text` can hold a one-line note.",
  ppt: "Deliver a presentation in `file` with format \"pptx\": {format, title, lang, slides:[{title, bullets[], notes}]} (max 6 bullets per slide). `text` can hold a one-line note.",
};

type TaskView = { id: string; delivery: Delivery; net_reward: number; role: "requester" | "worker" | "viewer"; status: string };

/**
 * Validates and stores a worker's result. Shared by the MCP tool and the website's manual submit form,
 * so a person and an AI are held to the same rules.
 */
export async function submitTaskResult(uid: string, taskId: string, rawText: unknown, rawFile: unknown): Promise<{ ok: true; net: number } | { ok: false; error: string }> {
  const t = await rpc<TaskView | null>("ln_task_get", { p_user: uid, p_task: taskId });
  if (!t || t.role !== "worker" || t.status !== "claimed") return { ok: false, error: "not_claimed" };
  const body = typeof rawText === "string" ? rawText.trim().slice(0, 20000) : "";
  let file: ReturnType<typeof normalizeSpec> = null;
  if (t.delivery === "pdf" || t.delivery === "ppt") {
    file = normalizeSpec(rawFile);
    const want = t.delivery === "pdf" ? ["pdf", "docx"] : ["pptx"];
    if (!file || !want.includes(file.format)) return { ok: false, error: `need_file:${want.join("|")}:${DELIVERY_GUIDE[t.delivery]}` };
    if (JSON.stringify(file).length > 150_000) return { ok: false, error: "file_too_big" };
  } else if (body.length < 20) {
    return { ok: false, error: "need_text" };
  }
  const r = await rpc<{ ok: boolean }>("ln_task_submit", { p_user: uid, p_task: taskId, p_result: { text: body, file, at: new Date().toISOString() } });
  return r.ok ? { ok: true, net: Number(t.net_reward) } : { ok: false, error: "not_claimed" };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "");

export type NewTask = { category?: unknown; delivery?: unknown; title?: unknown; brief?: unknown; input_text?: unknown; reward?: unknown; lang?: unknown };

/**
 * Posts a task: validation, the same AI safety check as the community, then the database holds the reward from the
 * poster's Pi balance. `source` "mcp" additionally counts against the daily AI-posting cap.
 */
export async function postTask(uid: string, a: NewTask, source: "web" | "mcp"): Promise<{ ok: true; id: string } | { ok: false; error: string; extra?: Record<string, unknown> }> {
  const category = str(a.category, 40).replace(/\s+/g, " ");
  const title = str(a.title, 120);
  const brief = str(a.brief, 1000);
  const input = str(a.input_text, 8000);
  const delivery = DELIVERIES.includes(a.delivery as Delivery) ? (a.delivery as Delivery) : null;
  const reward = Math.round(Number(a.reward) * 1e4) / 1e4;
  if (category.length < 2) return { ok: false, error: "bad_category" };
  if (!delivery) return { ok: false, error: "bad_delivery" };
  if (title.length < 3) return { ok: false, error: "bad_title" };
  if (!(reward >= 0.05 && reward <= 50)) return { ok: false, error: "bad_reward" };
  const m = await moderate(`${category}\n${title}\n${brief}\n${input.slice(0, 1500)}`);
  if (!m.ok) return { ok: false, error: "blocked", extra: { why: m.why } };
  const r = await rpc<{ ok: boolean; reason?: string; id?: string; balance?: number; cap?: number; spent?: number }>("ln_task_create2", {
    p_user: uid, p_category: category, p_delivery: delivery, p_title: title, p_brief: brief, p_input: input,
    p_lang: a.lang === "en" ? "en" : "ar", p_reward: reward, p_source: source,
  });
  return r.ok ? { ok: true, id: r.id as string } : { ok: false, error: r.reason || "bad_request", extra: { balance: r.balance, cap: r.cap, spent: r.spent } };
}
