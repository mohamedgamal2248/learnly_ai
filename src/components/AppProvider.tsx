"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { translate, type Key, type Lang } from "@/lib/i18n";
import { markPiAuthed, onIncompletePayment, post, waitForPi } from "@/lib/pi-client";

export type User = { id: string; username: string; role: "user" | "teacher" | "admin"; credits: number; earned: number; paid: boolean };

type Ctx = {
  lang: Lang; setLang: (l: Lang) => void;
  theme: "light" | "dark"; toggleTheme: () => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
  user: User | null; ready: boolean; loggingIn: boolean;
  login: () => Promise<boolean>; logout: () => Promise<void>; refresh: () => Promise<void>;
  setCredits: (n: number) => void;
  toast: (msg: string) => void;
  buyOpen: boolean; openBuy: () => void; closeBuy: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

function store(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The inline script in <head> already applied the saved language and theme before paint.
  useEffect(() => {
    const root = document.documentElement;
    setLangState(root.lang === "en" ? "en" : "ar");
    setTheme(root.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const t = useCallback((k: Key, vars?: Record<string, string | number>) => translate(lang, k, vars), [lang]);

  const applyLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  }, []);

  // A choice made with the EN/AR button is remembered on this device.
  const setLang = useCallback((l: Lang) => { applyLang(l); store("ll-lang", l); }, [applyLang]);

  // First visit: guess the language from the visitor's country (once per device, not saved as a choice).
  useEffect(() => {
    let saved: string | null = null, guessed: string | null = null;
    try { saved = localStorage.getItem("ll-lang"); guessed = localStorage.getItem("ll-geo-lang"); } catch {}
    if (saved) return;
    if (guessed === "ar" || guessed === "en") { applyLang(guessed); return; }
    fetch("/api/geo").then((r) => r.json()).then((d) => {
      const l: Lang = d.lang === "en" ? "en" : "ar";
      store("ll-geo-lang", l);
      applyLang(l);
    }).catch(() => {});
  }, [applyLang]);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store("ll-theme", next);
      return next;
    });
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      const d = await r.json();
      setUser(d.user ?? null);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async () => {
    const pi = await waitForPi();
    if (!pi) { toast(translate(lang, "openInPi")); return false; }
    setLoggingIn(true);
    try {
      const auth = await pi.authenticate(["username", "payments"], onIncompletePayment);
      markPiAuthed();
      const r = await post("/api/auth/pi", { accessToken: auth.accessToken });
      if (!r.ok) throw new Error(r.data?.error);
      setUser(r.data.user);
      toast(translate(lang, "loggedIn", { name: r.data.user.username }));
      return true;
    } catch {
      toast(translate(lang, "loginFailed"));
      return false;
    } finally {
      setLoggingIn(false);
    }
  }, [lang, toast]);

  const logout = useCallback(async () => {
    await post("/api/auth/logout");
    setUser(null);
    toast(translate(lang, "loggedOut"));
  }, [lang, toast]);

  const setCredits = useCallback((n: number) => setUser((u) => (u ? { ...u, credits: n } : u)), []);

  const value = useMemo<Ctx>(() => ({
    lang, setLang, theme, toggleTheme, t, user, ready, loggingIn, login, logout, refresh, setCredits, toast,
    buyOpen, openBuy: () => setBuyOpen(true), closeBuy: () => setBuyOpen(false),
  }), [lang, setLang, theme, toggleTheme, t, user, ready, loggingIn, login, logout, refresh, setCredits, toast, buyOpen]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status" key={toastMsg}>{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
