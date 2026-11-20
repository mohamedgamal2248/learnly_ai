import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { moderate } from "@/lib/server/moderation";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;
const KINDS = ["summary", "translate", "research", "pdf", "ppt"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** ?role=requester|worker lists my tasks; ?id= returns one task (with the result for its requester / worker). */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  if (id) {
    if (!UUID.test(id)) return fail("bad_request");
    const t = await rpc("ln_task_get", { p_user: a.u.id, p_task: id });
    return t ? json({ task: t }) : fail("not_found", 404);
  }
  const role = u.searchParams.get("role") === "worker" ? "worker" : "requester";
  return json({ tasks: await rpc("ln_my_tasks", { p_user: a.u.id, p_role: role }) });
}

/** Post a task. The reward is held from the requester's Pi balance right away. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`task:${a.u.id}`, 10, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const kind = KINDS.includes(b?.kind) ? b.kind : null;
  const title = str(b?.title, 120);
  const brief = str(b?.brief, 1000);
  const input = str(b?.input_text, 8000);
  const reward = Math.round(Number(b?.reward) * 1e4) / 1e4;
  if (!kind || title.length < 3 || !(reward > 0)) return fail("bad_request");
  // Same AI check as the community: no scams, passphrase requests, abuse or spam in tasks.
  const m = await moderate(`${title}\n${brief}\n${input.slice(0, 1500)}`);
  if (!m.ok) return fail("blocked", 400, { why: m.why });
  const r = await rpc<{ ok: boolean; reason?: string; id?: string; balance?: number }>("ln_task_create", {
    p_user: a.u.id, p_kind: kind, p_title: title, p_brief: brief, p_input: input, p_lang: b?.lang === "en" ? "en" : "ar", p_reward: reward,
  });
  return r.ok ? json({ ok: true, id: r.id }) : fail(r.reason || "bad_request", 400, { balance: r.balance });
}
