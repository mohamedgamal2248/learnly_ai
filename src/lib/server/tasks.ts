import "server-only";
import { rpc } from "./db";
import { normalizeSpec } from "./files/spec";
export type Kind = "summary" | "translate" | "pdf" | "ppt" | "research";

/** What a finished task must contain, per kind. */
export const KIND_GUIDE: Record<Kind, string> = {
  summary: "Deliver a clear summary as Markdown in `text` (key points first, short). Same language as requested.",
  translate: "Deliver the full translation as Markdown/plain text in `text`. Keep the structure; don't add commentary.",
  research: "Deliver a researched answer as Markdown in `text`, with a short list of sources (title + URL) at the end. Only cite pages you actually read.",
  pdf: "Deliver a document in `file` with format \"pdf\": {format, title, lang, sections:[{heading, paragraphs[], bullets[], table[][]}]}. `text` can hold a one-line note.",
  ppt: "Deliver a presentation in `file` with format \"pptx\": {format, title, lang, slides:[{title, bullets[], notes}]} (max 6 bullets per slide). `text` can hold a one-line note.",
};


type TaskView = { id: string; kind: Kind; net_reward: number; role: "requester" | "worker" | "viewer"; status: string };

/**
 * Validates and stores a worker's result. Shared by the MCP tool and the website's manual submit form,
 * so a person and an AI are held to the same rules.
 */
export async function submitTaskResult(uid: string, taskId: string, rawText: unknown, rawFile: unknown): Promise<{ ok: true; net: number } | { ok: false; error: string }> {
  const t = await rpc<TaskView | null>("ln_task_get", { p_user: uid, p_task: taskId });
  if (!t || t.role !== "worker" || t.status !== "claimed") return { ok: false, error: "not_claimed" };
  const body = typeof rawText === "string" ? rawText.trim().slice(0, 20000) : "";
  let file: ReturnType<typeof normalizeSpec> = null;
  if (t.kind === "pdf" || t.kind === "ppt") {
    file = normalizeSpec(rawFile);
    const want = t.kind === "pdf" ? ["pdf", "docx"] : ["pptx"];
    if (!file || !want.includes(file.format)) return { ok: false, error: `need_file:${want.join("|")}:${KIND_GUIDE[t.kind]}` };
    if (JSON.stringify(file).length > 150_000) return { ok: false, error: "file_too_big" };
  } else if (body.length < 20) {
    return { ok: false, error: "need_text" };
  }
  const r = await rpc<{ ok: boolean }>("ln_task_submit", { p_user: uid, p_task: taskId, p_result: { text: body, file, at: new Date().toISOString() } });
  return r.ok ? { ok: true, net: Number(t.net_reward) } : { ok: false, error: "not_claimed" };
}
