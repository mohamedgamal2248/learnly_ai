import { rpc, getLimits } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { completeChat, pickJson, PROPOSE_BOT_TOOL } from "@/lib/server/ai";
import { creditsForCost, estimateTokens, usageCost } from "@/lib/server/pricing";

export const runtime = "nodejs";
export const maxDuration = 45;

const SYSTEM = `You are the bot architect of Learnly AI, an education app for adults (18+) on Pi Network.
A verified course creator (an expert teaching adults) describes the course bot they want. Design it and call propose_bot once with every field filled.
- Names are short and clear; Arabic is natural Egyptian-friendly Modern Standard Arabic; English is natural.
- instructions are written TO the bot: who the learners are (adults, 18+), level and curriculum, teaching style (Socratic by default: ask one guiding question, then explain), how to use the creator's materials, what to refuse (cheating on graded work, wallet passphrases), and the reply language (the learner's).
- Pick the track that fits: school = skills & creativity (design, content, productivity, soft skills), uni = university-level topics, job = business, freelance and career, code = programming and AI, lang = languages, academy = Pi and crypto.
- Suggest a modest fee (0-10 credits) per message; 0 if the creator wants it free.`;

/** "Build with AI": turns a teacher's description into a full bilingual bot draft. Costs the teacher credits like a chat message. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  if (rateLimited(`architect:${a.u.id}`, 6, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const prompt = typeof b?.prompt === "string" ? b.prompt.trim().slice(0, 3000) : "";
  if (prompt.length < 10) return fail("too_short");

  const cfg = await getLimits();
  const maxOut = 2500;
  const estIn = estimateTokens(SYSTEM + prompt) + 600;
  const reserve = Math.min(cfg.max_reserve, creditsForCost((estIn * 0.10 + maxOut * 0.50) / 1_000_000, cfg));
  const r = await rpc<{ ok: boolean; reason?: string; credits?: number; need?: number }>("ln_reserve", { p_user: a.u.id, p_amount: reserve });
  if (!r.ok) return fail(r.reason || "no_credits", 402, { credits: r.credits, need: r.need });

  let draft: Record<string, any> | null = null;
  let cost = 0;
  try {
    const res = await completeChat({
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
      tools: [PROPOSE_BOT_TOOL], maxTokens: maxOut, cacheKey: "ln-architect",
    });
    cost = usageCost(res.usage);
    draft = pickJson(res, "propose_bot");
  } catch (e: any) {
    console.error("architect error", e?.message);
  }
  const actual = draft ? Math.min(reserve, creditsForCost(cost, cfg)) : 0;
  const settled = await rpc<{ credits: number; charged: number }>("ln_settle", {
    p_user: a.u.id, p_reserved: reserve, p_actual: actual, p_cost_usd: Number(cost.toFixed(8)),
    p_bot: null, p_teacher_share: 0, p_meta: { kind: "architect" },
  });
  if (!draft) return fail("ai_error", 502, { credits: settled.credits });
  return json({ draft, charged: settled.charged, credits: settled.credits });
}
