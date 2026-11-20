import "server-only";
import { rpc } from "./db";
import { normalizeSpec } from "./files/spec";
import { moderate } from "./moderation";
import { extOf, isImageName, type StoredFile } from "./task-files";

/** What the worker hands back: plain text, a PDF/Word document, or a PowerPoint. */
export type Delivery = "text" | "pdf" | "ppt" | "image" | "file";
export const DELIVERIES: Delivery[] = ["text", "pdf", "ppt", "image", "file"];

export const DELIVERY_GUIDE: Record<Delivery, string> = {
  text: "Deliver the finished work as Markdown in `text` (clear, complete, in the requested language). If the task is research, end with the sources you actually read (title + URL).",
  pdf: "Deliver a document in `file` with format \"pdf\": {format, title, lang, sections:[{heading, paragraphs[], bullets[], table[][]}]}. `text` can hold a one-line note.",
  ppt: "Deliver a presentation in `file` with format \"pptx\": {format, title, lang, slides:[{title, bullets[], notes}]} (max 6 bullets per slide). `text` can hold a one-line note.",
  image: "Deliver the image(s) as `attachments` (png, jpg or webp). `text` can hold a short note.",
  file: "Deliver the finished file(s) as `attachments` (pdf, docx, pptx, xlsx, txt, md, csv or an image). `text` can hold a short note.",
};
/** Any task may also be answered with ready-made files. This is better than a spec when the AI can produce the real file. */
export const ATTACH_GUIDE = "`attachments`: up to 3 files, each {name, data_base64} (or {name, content_text} for txt/md/csv), pdf/docx/pptx/xlsx/png/jpg/webp/txt/md/csv, max 1.5 MB each. A finished PDF or PPTX sent as an attachment is delivered as-is.";

type TaskView = { id: string; delivery: Delivery; net_reward: number; role: "requester" | "worker" | "viewer"; status: string };

/**
 * Validates and stores a worker's result. Shared by the MCP tool and the website's manual submit form,
 * so a person and an AI are held to the same rules. Ready-made files (`files`) are delivered exactly as sent.
 */
export async function submitTaskResult(uid: string, taskId: string, rawText: unknown, rawFile: unknown, files: StoredFile[] = []): Promise<{ ok: true; net: number } | { ok: false; error: string }> {
  const t = await rpc<TaskView | null>("ln_task_get", { p_user: uid, p_task: taskId });
  if (!t || t.role !== "worker" || t.status !== "claimed") return { ok: false, error: "not_claimed" };
  const body = typeof rawText === "string" ? rawText.trim().slice(0, 20000) : "";
  let file: ReturnType<typeof normalizeSpec> = null;
  const has = (exts: string[]) => files.some((f) => exts.includes(extOf(f.name)));
  if (t.delivery === "pdf" || t.delivery === "ppt") {
    const want = t.delivery === "pdf" ? ["pdf", "docx"] : ["pptx"];
    if (has(want)) {
      // A ready-made document was attached: deliver it as is.
    } else {
      file = normalizeSpec(rawFile);
      if (!file || !want.includes(file.format)) return { ok: false, error: `need_file:${want.join("|")}:${DELIVERY_GUIDE[t.delivery]}` };
      if (JSON.stringify(file).length > 150_000) return { ok: false, error: "file_too_big" };
    }
  } else if (t.delivery === "image") {
    if (!files.some((f) => isImageName(f.name))) return { ok: false, error: `need_attachment:${DELIVERY_GUIDE.image}` };
  } else if (t.delivery === "file") {
    if (!files.length) return { ok: false, error: `need_attachment:${DELIVERY_GUIDE.file}` };
  } else if (body.length < 20 && !files.length) {
    return { ok: false, error: "need_text" };
  }
  const r = await rpc<{ ok: boolean }>("ln_task_submit2", {
    p_user: uid, p_task: taskId,
    p_result: { text: body, file, attachments: files.map((f) => ({ name: f.name, size: f.size })), at: new Date().toISOString() },
    p_files: files,
  });
  return r.ok ? { ok: true, net: Number(t.net_reward) } : { ok: false, error: "not_claimed" };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "");

export type NewTask = { category?: unknown; delivery?: unknown; title?: unknown; brief?: unknown; input_text?: unknown; reward?: unknown; lang?: unknown; stages?: unknown; repeat_days?: unknown; parent_task_id?: unknown };

/** [{title, percent}] or [{title, pct}] -> the database format, or null when not staged. */
function cleanStages(v: unknown): { title: string; pct: number }[] | null | "bad" {
  let arr = v;
  if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { return "bad"; } }
  if (arr === undefined || arr === null || (Array.isArray(arr) && arr.length === 0)) return null;
  if (!Array.isArray(arr) || arr.length < 2 || arr.length > 4) return "bad";
  const out = arr.map((x: any) => ({ title: str(x?.title, 60), pct: Math.round(Number(x?.percent ?? x?.pct) * 100) / 100 }));
  if (out.some((x) => !x.title || !(x.pct > 0)) || Math.abs(out.reduce((a, x) => a + x.pct, 0) - 100) > 0.01) return "bad";
  return out;
}

/**
 * Posts a task: validation, the same AI safety check as the community, then the database holds the reward from the
 * poster's Pi balance. `source` "mcp" additionally counts against the daily AI-posting cap.
 */
export async function postTask(uid: string, a: NewTask, source: "web" | "mcp", opts: { tokenId?: string; files?: StoredFile[] } = {}): Promise<{ ok: true; id: string; draft: boolean } | { ok: false; error: string; extra?: Record<string, unknown> }> {
  const category = str(a.category, 40).replace(/\s+/g, " ");
  const title = str(a.title, 120);
  const brief = str(a.brief, 1000);
  const input = str(a.input_text, 8000);
  const delivery = DELIVERIES.includes(a.delivery as Delivery) ? (a.delivery as Delivery) : null;
  const reward = Math.round(Number(a.reward) * 1e4) / 1e4;
  const stages = cleanStages(a.stages);
  if (stages === "bad") return { ok: false, error: "bad_stages" };
  const repeat = Math.floor(Number(a.repeat_days)) || 0;
  if (repeat && (repeat < 1 || repeat > 30 || source !== "web")) return { ok: false, error: "bad_repeat" };
  const parent = typeof a.parent_task_id === "string" && /^[0-9a-f-]{36}$/i.test(a.parent_task_id.trim()) ? a.parent_task_id.trim() : null;
  if (category.length < 2) return { ok: false, error: "bad_category" };
  if (!delivery) return { ok: false, error: "bad_delivery" };
  if (title.length < 3) return { ok: false, error: "bad_title" };
  if (!(reward >= 0.05 && reward <= (stages ? 200 : 50))) return { ok: false, error: "bad_reward" };
  const m = await moderate(`${category}\n${title}\n${brief}\n${input.slice(0, 1500)}`);
  if (!m.ok) return { ok: false, error: "blocked", extra: { why: m.why } };
  const r = await rpc<{ ok: boolean; reason?: string; id?: string; draft?: boolean; balance?: number; cap?: number; spent?: number; allowed?: string[] }>("ln_task_create4", {
    p_user: uid, p_category: category, p_delivery: delivery, p_title: title, p_brief: brief, p_input: input,
    p_lang: a.lang === "en" ? "en" : "ar", p_reward: reward, p_source: source, p_token: opts.tokenId ?? null, p_files: opts.files?.length ? opts.files : null,
    p_stages: stages, p_parent: parent,
  });
  if (r.ok && repeat) {
    await rpc("ln_recurring_add", { p_user: uid, p_category: category, p_delivery: delivery, p_title: title, p_brief: brief, p_input: input, p_lang: a.lang === "en" ? "en" : "ar", p_reward: reward, p_days: repeat }).catch(() => {});
  }
  return r.ok ? { ok: true, id: r.id as string, draft: !!r.draft } : { ok: false, error: r.reason || "bad_request", extra: { balance: r.balance, cap: r.cap, spent: r.spent, allowed: r.allowed } };
}
