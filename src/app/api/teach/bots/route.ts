import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

const TRACKS = ["school", "uni", "job", "code", "lang", "academy"];

/** Create or update a teacher bot. Any change sends it back to admin review before it goes live. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (!b || typeof b.name !== "string" || b.name.trim().length < 2 || typeof b.subject !== "string") return fail("missing_fields");
  const bot = {
    id: typeof b.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : null,
    name: b.name.trim(), subject: b.subject.trim(),
    track: TRACKS.includes(b.track) ? b.track : "school",
    description: String(b.description || ""), instructions: String(b.instructions || ""),
    // Omitted when editing without a new upload, so the saved materials are kept.
    ...(typeof b.knowledge === "string" && b.knowledge.trim() ? { knowledge: b.knowledge } : {}),
    fee: Math.max(0, Math.min(20, parseInt(b.fee, 10) || 0)),
  };
  try {
    return json(await rpc("ln_save_bot", { p_user: a.u.id, p_bot: bot }));
  } catch (e: any) {
    return fail(String(e.message).includes("too many") ? "too_many_bots" : "server_error");
  }
}
