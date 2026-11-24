"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { NATIVES, useLearn } from "@/components/LearnProvider";
import { IBolt, ICheck, IFlame, IShield } from "@/components/Icons";
import { post } from "@/lib/pi-client";

export default function Me() {
  const { user, login, loggingIn, logout } = useApp();
  const { st, native, setNative, refresh } = useLearn();
  if (!user) return (
    <div className="stack">
      <section className="lc" style={{ display: "grid", gap: 10 }}>
        <h1 style={{ fontSize: 22 }}>Sign in to save your progress</h1>
        <p className="muted small">Your streak, words and lessons are saved to your Pi account.</p>
        <button className="btn primary lg" onClick={login} disabled={loggingIn}>{loggingIn ? "Signing in…" : "Sign in with Pi"}</button>
      </section>
      <Links />
    </div>
  );
  const until = st?.sub.until ? new Date(st.sub.until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const level = (l: string) => post("/api/en/profile", { level: l }).then(refresh);
  const goal = (g: number) => post("/api/en/profile", { goal: g }).then(refresh);
  return (
    <div className="stack">
      <section className="lc row">
        <div className="avatar-btn" style={{ width: 56, height: 56, fontSize: 22 }}>{user.username.slice(0, 1).toUpperCase()}</div>
        <div className="grow"><b className="big" style={{ fontSize: 20 }}>@{user.username}</b><div className="muted small"><span className="num">{st?.profile.xp ?? 0} XP</span> · <IFlame width={13} height={13} style={{ verticalAlign: -2, color: "var(--accent)" }} /> <span className="num">{st?.best ?? 0}</span> best streak</div></div>
      </section>

      <Link href="/plans" className={`lc tap ${st?.sub.plan ? "warm" : "hl"}`}>
        <div className="ic-sq warm"><IBolt width={24} height={24} /></div>
        <div className="grow">
          <b>{st?.sub.plan ? `${st.sub.plan === "pro" ? "Pro" : "Plus"} plan` : "Free plan"}</b>
          <div className="muted small">{st?.sub.plan ? <><span className="num">{st.credits}</span> AI credits · until {until}</> : "Unlock all lessons and the AI tutor"}</div>
        </div>
        <span className="chip v">{st?.sub.plan ? "Manage" : "Upgrade"}</span>
      </Link>

      <section className="lc stack">
        <b>Explain things in</b>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {NATIVES.map((n) => <button key={n.code} className={`opt${native === n.code ? " sel" : ""}`} onClick={() => setNative(n.code)}><span dir={n.dir} style={{ flex: 1 }}>{n.label}</span>{native === n.code && <ICheck width={16} height={16} />}</button>)}
        </div>
        <b>My level</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {["A1", "A2", "B1"].map((l) => <button key={l} className={`opt${st?.profile.level === l ? " sel" : ""}`} style={{ justifyContent: "center" }} onClick={() => level(l)}>{l}</button>)}
        </div>
        <Link href="/placement" className="small md-link">Not sure? Take the level test</Link>
        <b>Daily goal</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[1, 2, 3].map((g) => <button key={g} className={`opt${st?.profile.goal === g ? " sel" : ""}`} style={{ justifyContent: "center" }} onClick={() => goal(g)}>{g} lesson{g > 1 ? "s" : ""}</button>)}
        </div>
      </section>

      {user.role === "admin" && <Link href="/admin" className="lc tap"><div className="ic-sq soft"><IShield width={22} height={22} /></div><b className="grow">Admin</b></Link>}
      <Links />
      <button className="btn danger lg" onClick={logout}>Sign out</button>
    </div>
  );
}

function Links() {
  return <div className="muted small" style={{ textAlign: "center" }}><Link href="/privacy" className="md-link">Privacy</Link> · <Link href="/terms" className="md-link">Terms</Link> · <Link href="/credits" className="md-link">Credits</Link></div>;
}
