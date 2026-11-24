"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./AppProvider";
import { Portal } from "./Portal";
import { useLearn, NATIVES } from "./LearnProvider";
import { IBolt, ICap, ICourses, IHome, IPerson, ISparkle, IClose, ICheck } from "./Icons";
import { BRAND } from "@/lib/brand";
import { Brand } from "./Brand";

const FOCUS = ["/lesson", "/review"];

export function Shell({ children }: { children: ReactNode }) {
  const { user, login, loggingIn, ready, tt } = useApp();
  const { st, native, setNative, plan } = useLearn();
  const path = usePathname();
  const [pick, setPick] = useState(false);
  const focus = FOCUS.some((p) => path.startsWith(p));

  useEffect(() => { setPick(false); }, [path]);
  useEffect(() => {
    // An invite link (?ref=name) is remembered until the person signs in.
    try { const r = new URLSearchParams(location.search).get("ref"); if (r && /^[\w.-]{2,60}$/.test(r)) localStorage.setItem("hl-ref", r); } catch {}
  }, [path]);

  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const tabs = [
    { href: "/", label: tt("Today"), icon: <IHome width={22} height={22} /> },
    { href: "/learn", label: tt("Learn"), icon: <ICourses width={22} height={22} /> },
    { href: "/ai", label: "AI", ai: true },
    { href: "/teachers", label: tt("Teachers"), icon: <ICap width={22} height={22} /> },
    { href: "/me", label: tt("Me"), icon: <IPerson width={22} height={22} /> },
  ];

  return (
    <>
      <header className="top">
        <div className="top-in">
          <Link className="brand" href="/" aria-label={BRAND}><Brand /></Link>
          <div className="spacer" />
          <button className="pill" onClick={() => setPick(true)} aria-label="Language of explanations">{NATIVES.find((n) => n.code === native)?.short}</button>
          {user ? (
            <>
              <Link className="pill credit" href={plan ? "/plans" : "/plans"} aria-label={plan ? "AI credits" : "Upgrade"}>
                <IBolt width={15} height={15} />
                <span className="num">{plan ? (st?.credits ?? "…") : tt("Upgrade")}</span>
              </Link>
              <Link className="avatar-btn" href="/me" aria-label="Me">{user.username.slice(0, 1).toUpperCase()}</Link>
            </>
          ) : (
            <button className="btn primary sm" onClick={login} disabled={loggingIn || !ready}>{loggingIn ? tt("Signing in…") : tt("Sign in with Pi")}</button>
          )}
        </div>
      </header>

      <main key={path} className={`page${focus ? " focus" : ""}`}>{children}</main>

      {!focus && (
        <nav className="bnav" aria-label="Main">
          {tabs.map((t) => t.ai ? (
            <Link key={t.href} href={t.href} className={`bn-ai${on(t.href) ? " on" : ""}`} aria-label="AI tutor">
              <span className="bn-ai-dot"><ISparkle width={26} height={26} /><b>AI</b></span>
            </Link>
          ) : (
            <Link key={t.href} href={t.href} className={`bn${on(t.href) ? " on" : ""}`}>
              <span className="bn-ic">{t.icon}</span><span>{t.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {pick && (
        <Portal>
        <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) setPick(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Language of explanations">
            <div style={{ display: "flex", alignItems: "center" }}>
              <h2 style={{ flex: 1, fontSize: 18 }}>{tt("Explain in my language")}</h2>
              <button className="icon-btn" aria-label="Close" onClick={() => setPick(false)}><IClose width={18} height={18} /></button>
            </div>
            <p className="muted small">{tt("Lessons, meanings and the AI tutor explain in this language.")}</p>
            <div className="grid" style={{ gap: 8 }}>
              {NATIVES.map((n) => (
                <button key={n.code} className={`opt${native === n.code ? " sel" : ""}`} onClick={() => { setNative(n.code); setPick(false); }}>
                  <span dir={n.dir} style={{ flex: 1, textAlign: "start" }}>{n.label}</span>{native === n.code && <ICheck width={18} height={18} />}
                </button>
              ))}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
