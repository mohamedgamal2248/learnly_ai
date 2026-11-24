import "server-only";
import { rpc } from "../db";
import { getSession } from "../session";
import { isNative, type Native } from "./types";

export type EnState = {
  profile: { native: Native; level: "A1" | "A2" | "B1" | "B2"; xp: number; goal: number; onboarded: boolean };
  sub: { plan: "plus" | "pro" | null; until: string | null; active: boolean };
  credits: number; streak: number; best: number; today_done: boolean;
  progress: { id: string; best: number; done: boolean }[];
  week: { day: string; xp: number }[]; due: number;
};

export const loadState = (uid: string) => rpc<EnState | null>("ln_en_state", { p_user: uid });

/** The learner's language for explanations: the account's choice when signed in, else the ?native= hint, else Arabic. */
export function nativeFrom(req: Request, state?: EnState | null): Native {
  if (state?.profile?.native) return state.profile.native;
  const q = new URL(req.url).searchParams.get("native");
  return isNative(q) ? q : "ar";
}

export const sessionOf = (req: Request) => getSession(req);
