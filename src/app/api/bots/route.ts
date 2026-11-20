import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Public list of live bots. Cached at the CDN so most visits never reach the function or the database. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ bot: null });
    const b = await rpc<any>("ln_get_bot", { p_bot: id });
    const bot = b ? {
      id: b.id, name: b.name, name_en: b.name_en, subject: b.subject, subject_en: b.subject_en, track: b.track,
      description: b.description, description_en: b.description_en, fee: b.fee,
      official: b.official, teacher_name: b.teacher_name, status: b.status, teacher_id: b.teacher_id,
      has_knowledge: !!b.knowledge,
    } : null;
    return json({ bot }, { cache: "public, s-maxage=60, stale-while-revalidate=600" });
  }
  const bots = await rpc<unknown[]>("ln_list_bots");
  return json({ bots }, { cache: "public, s-maxage=60, stale-while-revalidate=600" });
}
