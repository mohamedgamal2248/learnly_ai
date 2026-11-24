"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { NATIVES, useLearn } from "@/components/LearnProvider";
import { IAward, IBolt, IChart, ICheck, IFlame, IGlobe, IRotate, ISparkle, IShield } from "@/components/Icons";
import { LOCALE, SITE_LANGS } from "@/lib/ui-i18n";
import { post } from "@/lib/pi-client";

export default function Me() {
  const { user, login, loggingIn, logout, tt, uiLang } = useApp();
  const { st, native, setNative, refresh } = useLearn();
  if (!user) return (
    <div className="stack">
      <section className="lc" style={{ display: "grid", gap: 10 }}>
        <h1 style={{ fontSize: 22 }}>{tt("Sign in to save your progress")}</h1>
        <p className="muted small">{tt("Your streak, words and lessons are saved to your Pi account.")}</p>
        <button className="btn primary lg" onClick={login} disabled={loggingIn}>{loggingIn ? tt("Signing in…") : tt("Sign in with Pi")}</button>
      </section>
      <SiteLang />
      <Links />
    </div>
  );
  const until = st?.sub.until ? new Date(st.sub.until).toLocaleDateString(LOCALE[uiLang], { day: "numeric", month: "short", year: "numeric" }) : "";
  const level = (l: string) => post("/api/en/profile", { level: l }).then(refresh);
  const goal = (g: number) => post("/api/en/profile", { goal: g }).then(refresh);
  return (
    <div className="stack">
      <section className="lc row">
        <div className="avatar-btn" style={{ width: 56, height: 56, fontSize: 22 }}>{user.username.slice(0, 1).toUpperCase()}</div>
        <div className="grow"><b className="big ltr" style={{ fontSize: 20, display: "block", textAlign: "start" }}>@{user.username}</b><div className="muted small"><span className="num">{st?.profile.xp ?? 0} XP</span> · <IFlame width={13} height={13} style={{ verticalAlign: -2, color: "var(--accent)" }} /> <span className="num">{tt("{n} best streak", { n: st?.best ?? 0 })}</span></div></div>
      </section>

      <Link href="/plans" className={`lc tap ${st?.sub.plan ? "warm" : "hl"}`}>
        <div className="ic-sq warm"><IBolt width={24} height={24} /></div>
        <div className="grow">
          <b>{st?.sub.plan ? tt("{plan} plan", { plan: st.sub.plan === "pro" ? "Pro" : "Plus" }) : tt("Free plan")}</b>
          <div className="muted small">{st?.sub.plan ? tt("{n} AI credits · until {date}", { n: st.credits, date: until }) : tt("Unlock all lessons and the AI tutor")}</div>
        </div>
        <span className="chip v">{st?.sub.plan ? tt("Manage") : tt("Upgrade")}</span>
      </Link>

      <SiteLang />

      <section className="lc stack">
        <b>{tt("Explain things in")}</b>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {NATIVES.map((n) => <button key={n.code} className={`opt${native === n.code ? " sel" : ""}`} onClick={() => setNative(n.code)}><span dir={n.dir} style={{ flex: 1 }}>{n.label}</span>{native === n.code && <ICheck width={16} height={16} />}</button>)}
        </div>
        <b>{tt("My level")}</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {["A1", "A2", "B1"].map((l) => <button key={l} className={`opt${st?.profile.level === l ? " sel" : ""}`} style={{ justifyContent: "center" }} onClick={() => level(l)}>{l}</button>)}
        </div>
        <Link href="/placement" className="small md-link">{tt("Not sure? Take the level test")}</Link>
        <b>{tt("Daily goal")}</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[1, 2, 3].map((g) => <button key={g} className={`opt${st?.profile.goal === g ? " sel" : ""}`} style={{ justifyContent: "center", display: "grid", gap: 0, textAlign: "center" }} onClick={() => goal(g)}><b className="num">{g * 20} XP</b><span className="hint" style={{ fontWeight: 500 }}>{tt(g === 1 ? "Casual" : g === 2 ? "Regular" : "Serious")}</span></button>)}
        </div>
      </section>

      <section className="lc stack">
        <Link href="/stats" className="row"><IChart width={20} height={20} style={{ color: "var(--primary)" }} /><b className="grow">{tt("My stats")}</b></Link>
        <Link href="/mistakes" className="row"><IRotate width={20} height={20} style={{ color: "var(--primary)" }} /><b className="grow">{tt("My mistakes")}</b></Link>
        <Link href="/ranking" className="row"><IAward width={20} height={20} style={{ color: "var(--primary)" }} /><b className="grow">{tt("Ranking")}</b></Link>
        <Link href="/help" className="row"><ISparkle width={20} height={20} style={{ color: "var(--primary)" }} /><b className="grow">{tt("Help")}</b></Link>
      </section>

      {user.role === "admin" && <Link href="/admin" className="lc tap"><div className="ic-sq soft"><IShield width={22} height={22} /></div><b className="grow">{tt("Admin")}</b></Link>}
      <Links />
      <button className="btn danger lg" onClick={logout}>{tt("Sign out")}</button>
    </div>
  );
}

/** The language of the site itself. Arabic switches the whole layout to right-to-left. */
function SiteLang() {
  const { tt, uiLang, setUiLang, dir } = useApp();
  return (
    <section className="lc stack">
      <div className="row"><IGlobe width={20} height={20} style={{ color: "var(--primary)" }} /><b className="grow">{tt("Site language")}</b></div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {SITE_LANGS.map((l) => (
          <button key={l.code} className={`opt${uiLang === l.code ? " sel" : ""}`} onClick={() => setUiLang(l.code)}>
            <span dir={l.dir} style={{ flex: 1 }}>{l.label}</span>{uiLang === l.code && <ICheck width={16} height={16} />}
          </button>
        ))}
      </div>
      <p className="hint">{tt(dir === "rtl" ? "The site reads from right to left in this language." : "The site reads from left to right in this language.")}</p>
    </section>
  );
}

function Links() {
  const { tt } = useApp();
  return <div className="muted small" style={{ textAlign: "center" }}><Link href="/privacy" className="md-link">{tt("Privacy")}</Link> · <Link href="/terms" className="md-link">{tt("Terms")}</Link></div>;
}
