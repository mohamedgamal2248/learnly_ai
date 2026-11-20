import { rpc } from "@/lib/server/db";
import { fail, json, requireSession } from "@/lib/server/http";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/** ?bot=<id> lists the user's conversations with a bot; ?id=<chat> returns its messages. */
export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  const bot = u.searchParams.get("bot");
  if (id && UUID.test(id)) {
    const messages = await rpc("ln_chat_history", { p_user: s.uid, p_chat: id });
    return messages ? json({ messages }) : fail("not_found", 404);
  }
  if (bot && UUID.test(bot)) return json({ chats: await rpc("ln_chats_list", { p_user: s.uid, p_bot: bot }) });
  return fail("bad_request");
}
