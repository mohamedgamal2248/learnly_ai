"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import { UI_LANGS } from "@/lib/i18n";

type Plan = { title: string; goal: string; minutes: number; at: string; days: { day: number; focus: string; tasks: { text: string; link: string | null }[] }[] };
type Data = {
  streak: number; best: number; today: boolean; plan: Plan | null;
  courses: { id: string; title: string; title_en: string; lessons: number; done: number; completed: boolean }[];
  certs: { id: string; title: string; title_en: string; kind: string }[];
  mistakes: { course: string; lesson: string; question: string; title: string; title_en: string }[];
};

const linkOf = (l: string) => (l.startsWith("course:") ? `/course?id=${l.slice(7)}` : `/chat?b=${l.slice(4)}`);

export default function LearnPage() {
  const { t, lang, ui, user, ready, login, toast, setCredits } = useApp();
  const [d, setD] = useState<Data | null>(null);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("new");
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/learning", { credentials: "include", cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, []);
  useEffect(() => { if (user) load(); }, [user?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { setChecks(JSON.parse(localStorage.getItem("ln-plan-checks") || "{}")); } catch {} }, []);
  const toggle = (k: string) => setChecks((cur) => {
    const next = { ...cur, [k]: !cur[k] };
    try { localStorage.setItem("ln-plan-checks", JSON.stringify(next)); } catch {}
    return next;
  });

  async function makePlan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/learning/plan", { goal, level, minutes, lang, langName: UI_LANGS.find((l) => l.code === ui)?.ai });
    setBusy(false);
    if (r.ok) {
      setCredits(r.data.credits);
      setD((cur) => (cur ? { ...cur, plan: r.data.plan } : cur));
      setChecks({}); try { localStorage.removeItem("ln-plan-checks"); } catch {}
      toast(t("charged", { n: r.data.charged }));
    } else toast(t(r.data?.error === "no_credits" ? "errNoCredits" : "errGeneric", { have: r.data?.credits ?? 0, need: r.data?.need ?? "?" }));
  }

  if (!ready) return <div className="skeleton" style={{ height: 200 }} />;
  if (!user) return (
    <div className="card" style={{ display: "grid", gap: 12, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20 }}>{t("nLearn")}</h1><p className="muted">{t("learnSub")}</p>
      <button className="btn primary" onClick={login}>{t("login")}</button>
    </div>
  );
  if (!d) return <div className="skeleton" style={{ height: 200 }} />;
  const ttl = (x: { title: string; title_en: string }) => (lang === "en" ? x.title_en || x.title : x.title || x.title_en);

  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="hero-card">
        <div className={`streak${d.today ? " lit" : ""}`} aria-label={t("streakN", { n: d.streak })}><span>🔥</span><b className="num">{d.streak}</b></div>
        <div style={{ display: "grid", gap: 4 }}>
          <h1>{t("nLearn")}</h1>
          <p>{d.today ? t("streakToday") : d.streak ? t("streakKeep") : t("streakStart")}</p>
          <span className="hero-sub num">{t("bestStreak", { n: d.best })}</span>
        </div>
      </div>

      <div className="sec-h"><h2>{t("planTitle")}</h2></div>
      {d.plan ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <b>{d.plan.title}</b>
          <div className="plan-days">
            {d.plan.days.map((day) => (
              <div key={day.day} className="plan-day">
                <span className="lesson-n num">{t("dayN", { n: day.day })}</span>
                <b className="small">{day.focus}</b>
                {day.tasks.map((task, i) => {
                  const k = `${d.plan!.at}-${day.day}-${i}`;
                  return (
                    <label key={k} className={`plan-task${checks[k] ? " done" : ""}`}>
                      <input type="checkbox" checked={!!checks[k]} onChange={() => toggle(k)} />
                      <span>{task.text}{task.link && <> · <Link className="md-link" href={linkOf(task.link)}>{t("cOpen")}</Link></>}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <details><summary className="hint" style={{ cursor: "pointer" }}>{t("newPlan")}</summary>{planForm()}</details>
        </div>
      ) : (
        <div className="card"><p className="muted small">{t("planSub")}</p>{planForm()}</div>
      )}

      {d.mistakes.length > 0 && (
        <>
          <div className="sec-h"><h2>{t("reviewTitle")}</h2></div>
          <div className="grid">
            {d.mistakes.map((m, i) => (
              <Link key={i} href={`/course?id=${m.course}`} className="card mistake">
                <span aria-hidden="true">↺</span>
                <span style={{ display: "grid", minWidth: 0 }}><b className="small">{m.question}</b><span className="hint">{ttl(m)}</span></span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="sec-h"><h2>{t("myLearningCourses")}</h2></div>
      {d.courses.length ? (
        <div className="grid">
          {d.courses.map((c) => {
            const pct = c.lessons ? Math.round((c.done / c.lessons) * 100) : 0;
            return (
              <Link key={c.id} href={`/course?id=${c.id}`} className="card my-course">
                <b>{ttl(c)}</b>
                <div className="course-prog"><div className="budget"><i style={{ width: `${pct}%` }} /></div><span className="num small">{pct}%</span></div>
              </Link>
            );
          })}
        </div>
      ) : <div className="card empty"><Link href="/courses" className="md-link">{t("browseCourses")}</Link></div>}

      {d.certs.length > 0 && (
        <>
          <div className="sec-h"><h2>{t("myCerts")}</h2></div>
          <div className="grid">
            {d.certs.map((c) => (
              <Link key={c.id} href={`/cert?id=${c.id}`} className="card mistake"><span aria-hidden="true">🎓</span><b className="small">{ttl(c)}</b></Link>
            ))}
          </div>
        </>
      )}
    </div>
  );

  function planForm() {
    return (
      <form onSubmit={makePlan} style={{ display: "grid", gap: 10, marginTop: 8 }}>
        <label className="field"><span>{t("planGoal")}</span>
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={300} placeholder={t("planGoalPh")} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="field"><span>{t("planLevel")}</span>
            <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="new">{t("lvNew")}</option><option value="some">{t("lvSome")}</option><option value="good">{t("lvGood")}</option>
            </select></label>
          <label className="field"><span>{t("planMinutes")}</span>
            <select className="select" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
              {["15", "30", "45", "60", "90"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select></label>
        </div>
        <button className="btn primary" disabled={busy || goal.trim().length < 3}>{busy ? t("preparing") : t("makePlan")}</button>
        <span className="hint">{t("planCost")}</span>
      </form>
    );
  }
}
