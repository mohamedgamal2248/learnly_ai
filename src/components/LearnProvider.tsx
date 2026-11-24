"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "./AppProvider";

export type Native = "ar" | "id" | "vi" | "ko";
export const NATIVES: { code: Native; label: string; short: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", label: "العربية", short: "AR", dir: "rtl" },
  { code: "id", label: "Bahasa Indonesia", short: "ID", dir: "ltr" },
  { code: "vi", label: "Tiếng Việt", short: "VI", dir: "ltr" },
  { code: "ko", label: "한국어", short: "KO", dir: "ltr" },
];

export type EnState = {
  profile: { native: Native; level: "A1" | "A2" | "B1" | "B2"; xp: number; goal: number; onboarded: boolean };
  sub: { plan: "plus" | "pro" | null; until: string | null; active: boolean };
  credits: number; streak: number; best: number; today_done: boolean;
  progress: { id: string; best: number; done: boolean }[];
  week: { day: string; xp: number }[]; due: number;
};

type Ctx = {
  st: EnState | null; loaded: boolean;
  native: Native; dir: "rtl" | "ltr"; setNative: (n: Native) => void;
  plan: "plus" | "pro" | null;
  refresh: () => Promise<void>;
  setCredits: (n: number) => void;
};
const LearnCtx = createContext<Ctx | null>(null);
export const useLearn = () => { const c = useContext(LearnCtx); if (!c) throw new Error("useLearn outside provider"); return c; };

const isNative = (v: unknown): v is Native => NATIVES.some((n) => n.code === v);

export function LearnProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const [st, setSt] = useState<EnState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [guestNative, setGuestNative] = useState<Native>("ar");

  useEffect(() => { try { const v = localStorage.getItem("ll-native"); if (isNative(v)) setGuestNative(v); } catch {} }, []);

  const refresh = useCallback(async () => {
    if (!user) { setSt(null); setLoaded(true); return; }
    try {
      const r = await fetch("/api/en/state", { credentials: "include", cache: "no-store" });
      if (r.ok) setSt(await r.json());
    } catch {}
    setLoaded(true);
  }, [user]);
  useEffect(() => { setLoaded(false); refresh(); }, [refresh]);

  const native: Native = st?.profile.native ?? guestNative;
  const setNative = useCallback((n: Native) => {
    setGuestNative(n);
    try { localStorage.setItem("ll-native", n); } catch {}
    if (user) {
      setSt((s) => (s ? { ...s, profile: { ...s.profile, native: n } } : s));
      fetch("/api/en/profile", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ native: n }) }).catch(() => {});
    }
  }, [user]);
  const setCredits = useCallback((n: number) => setSt((s) => (s ? { ...s, credits: n } : s)), []);

  const value = useMemo<Ctx>(() => ({
    st, loaded, native, dir: NATIVES.find((x) => x.code === native)!.dir, setNative, plan: st?.sub.plan ?? null, refresh, setCredits,
  }), [st, loaded, native, setNative, refresh, setCredits]);
  return <LearnCtx.Provider value={value}>{children}</LearnCtx.Provider>;
}
