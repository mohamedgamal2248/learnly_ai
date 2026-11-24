"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { Onboarding } from "@/components/Onboarding";
import { IBolt, ICheck, ICourses, IFlame, ILock, IPlus, IRotate, ISparkle, IClose, IGlobe } from "@/components/Icons";
import { nextStep, todayUtc, type Catalog } from "@/lib/learn-client";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function Streak() {
  const { st } = useLearn();
  const streak = st?.streak ?? 0;
  const active = new Set((st?.week || []).filter((d) => d.xp > 0).map((d) => d.day));
  const today = todayUtc();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { key, label: LETTERS[d.getUTCDay()], n: d.getUTCDate(), done: active.has(key), today: key === today };
  });
  return (
    <section className="lc">
      <div className="row">
        <div className="ic-sq warm"><IFlame width={26} height={26} /></div>
        <div className="grow">
          <div className="big num">{streak} day{streak === 1 ? "" : "s"} in a row</div>
          <div className="muted small">{st?.today_done ? "Today's lesson is done. Nice!" : streak ? "Finish a lesson today to keep it going." : "Finish a lesson today to start your streak."}</div>
        </div>
      </div>
      <div className="days">
        {days.map((d) => (
          <div key={d.key} className={`day${d.done ? " done" : ""}${d.today ? " today" : ""}`}>
            <span>{d.label}</span><i className="num">{d.done ? <IFlame width={16} height={16} /> : d.n}</i>
          </div>
        ))}
      </div>
    </section>
  );
}

function Welcome() {
  const { login, loggingIn, ready } = useApp();
  return (
    <>
      <section className="lc hl" style={{ display: "grid", gap: 10 }}>
        <span className="eyebrow">Learnly AI</span>
        <h1 style={{ fontSize: 26 }}>Learn English in your own language</h1>
        <p className="muted">Short lessons explained in Arabic, Indonesian, Vietnamese or Korean, with an AI tutor that corrects you and answers your questions. Pay with Pi.</p>
        <Link className="btn primary lg" href="/lesson?id=a1-01">Try a free lesson</Link>
        <button className="btn lg" onClick={login} disabled={loggingIn || !ready}>{loggingIn ? "Signing in…" : "Sign in with Pi to save progress"}</button>
      </section>
      <section className="stack">
        {[
          [<ICourses key="a" width={24} height={24} />, "Step-by-step lessons", "From your first words up to everyday conversations, with practice after every lesson."],
          [<IGlobe key="b" width={24} height={24} />, "Explained in your language", "Meanings, examples and tips in Arabic, Indonesian, Vietnamese and Korean."],
          [<ISparkle key="c" width={24} height={24} />, "An AI tutor for every lesson", "Ask why, practise a conversation, or get your writing corrected. Included with Plus and Pro."],
        ].map(([ic, t, s], i) => (
          <div key={i} className="lc tap"><div className="ic-sq soft">{ic as React.ReactNode}</div><div className="grow"><b>{t as string}</b><div className="muted small">{s as string}</div></div></div>
        ))}
      </section>
    </>
  );
}

export default function Today() {
  const { user } = useApp();
  const { st, native, plan, loaded } = useLearn();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    fetch(`/api/en/catalog?native=${native}`, { credentials: "include", cache: "no-store" }).then((r) => r.json()).then(setCat).catch(() => {});
  }, [native, user?.id, plan, st?.progress.length]);

  if (!user) return <div className="stack"><Welcome /></div>;
  if (!loaded || !st) return <div className="stack"><div className="skeleton" style={{ height: 150 }} /><div className="skeleton" style={{ height: 90 }} /></div>;

  const step = cat ? nextStep(cat) : null;
  const freeDone = cat ? cat.lessons.filter((l) => l.tier === "free" && cat.progress.some((p) => p.id === l.id && p.done)).length : 0;
  const freeTotal = cat ? cat.lessons.filter((l) => l.tier === "free").length : 0;
  const until = st.sub.until ? new Date(st.sub.until).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  const challenges = [
    { t: "Finish 1 lesson", done: st.today_done, href: step && !step.locked ? `/lesson?id=${step.lesson.id}` : "/learn" },
    { t: st.due ? `Review ${st.due} word${st.due > 1 ? "s" : ""}` : "Review your words", done: st.due === 0, href: "/review" },
    { t: "Ask the AI tutor", done: false, href: plan ? "/ai" : "/plans", lock: !plan },
  ];

  return (
    <div className="stack">
      <Onboarding />
      <Streak />

      {step ? (
        <Link href={step.locked ? "/plans" : `/lesson?id=${step.lesson.id}`} className="lc tap hl">
          <div className="grow">
            <span className="eyebrow">{step.locked ? "Next lesson (locked)" : "Your next step"}</span>
            <div className="big" style={{ fontSize: 19 }}>{step.lesson.title}</div>
            <div className="muted small native">{step.lesson.titleTr} · {step.lesson.level}</div>
          </div>
          <div className={`ic-sq${step.locked ? " warm" : ""}`}>{step.locked ? <ILock width={24} height={24} /> : <IFlame width={26} height={26} />}</div>
        </Link>
      ) : cat ? (
        <div className="lc"><b>You finished every lesson available.</b><div className="muted small">New lessons are added regularly.</div></div>
      ) : <div className="skeleton" style={{ height: 92 }} />}

      {st.progress.length === 0 && (
        <Link href="/placement" className="lc tap">
          <div className="ic-sq soft"><ICheck width={24} height={24} /></div>
          <div className="grow"><b>Find your level</b><div className="muted small">A 3-minute test tells you where to start.</div></div>
        </Link>
      )}

      <Link href="/review" className="lc tap">
        <div className="ic-sq soft"><IRotate width={24} height={24} /></div>
        <div className="grow"><b>{st.due ? `${st.due} word${st.due > 1 ? "s" : ""} to review` : "All words reviewed"}</b><div className="muted small">Short flash cards bring back what you learned.</div></div>
      </Link>

      {plan ? (
        <Link href="/plans" className="lc tap warm">
          <div className="ic-sq warm"><IBolt width={24} height={24} /></div>
          <div className="grow"><b className="num">{st.credits} AI credits</b><div className="small" style={{ color: "#8A5A00" }}>{plan === "pro" ? "Pro" : "Plus"} plan until {until}. Tap to add more credits.</div></div>
        </Link>
      ) : (
        <Link href="/plans" className="lc tap warm">
          <div className="grow">
            <b>Free lessons: {freeDone}/{freeTotal}</b>
            <div className="prog warm" style={{ margin: "8px 0 6px" }}><i style={{ width: `${freeTotal ? (freeDone / freeTotal) * 100 : 0}%` }} /></div>
            <div className="small" style={{ color: "#8A5A00" }}>Unlock every lesson and the AI tutor with Plus or Pro.</div>
          </div>
          <div className="ic-sq warm"><IBolt width={24} height={24} /></div>
        </Link>
      )}

      <div className="sec-h" style={{ margin: "8px 2px 0" }}><h2>Today&apos;s challenges</h2><span className="chip num">{challenges.filter((c) => c.done).length}/{challenges.length}</span></div>
      {challenges.map((c) => (
        <Link key={c.t} href={c.href} className="lc tap" style={{ padding: 14 }}>
          <div className={`ic-sq ${c.done ? "ok" : "soft"}`} style={{ width: 44, height: 44, borderRadius: 14 }}>{c.done ? <ICheck width={22} height={22} /> : c.lock ? <ILock width={20} height={20} /> : <IFlame width={22} height={22} />}</div>
          <b className="grow">{c.t}</b>
          {c.lock && <span className="chip warn">Plus</span>}
        </Link>
      ))}

      <button className="fab" onClick={() => setMenu(true)} aria-label="Quick actions"><IPlus width={28} height={28} strokeWidth={2.6} /></button>
      {menu && (
        <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) setMenu(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Quick actions">
            <div className="row"><h2 style={{ flex: 1, fontSize: 18 }}>Quick actions</h2><button className="icon-btn" aria-label="Close" onClick={() => setMenu(false)}><IClose width={18} height={18} /></button></div>
            <div className="sheet-list">
              <Link className="opt" href={step && !step.locked ? `/lesson?id=${step.lesson.id}` : "/learn"}><ICourses width={20} height={20} /> Continue learning</Link>
              <Link className="opt" href="/review"><IRotate width={20} height={20} /> Review words</Link>
              <Link className="opt" href={plan ? "/ai" : "/plans"}><ISparkle width={20} height={20} /> Ask the AI tutor {!plan && <span className="chip warn" style={{ marginInlineStart: "auto" }}>Plus</span>}</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
