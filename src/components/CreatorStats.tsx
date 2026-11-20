"use client";

import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";

type S = {
  bots: { id: string; name: string; name_en: string; chats: number; learners: number; messages: number; earned: number }[];
  courses: { id: string; title: string; title_en: string; students: number; completed: number; sales_pi: number; earned: number }[];
  daily: { day: string; chats: number }[];
  questions: string[];
};

/** Creator dashboard: totals, 30-day activity bars (one series, hover/tap shows the value) and recent learner questions. */
export function CreatorStats() {
  const { t, lang } = useApp();
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { fetch("/api/teach/stats", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {}); }, []);
  if (!s) return <div className="skeleton" style={{ height: 140 }} />;
  const fmt = (n: number) => Number(n).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 });
  const sum = (xs: number[]) => xs.reduce((a, b) => a + Number(b || 0), 0);
  const tiles = [
    [t("stLearners"), sum(s.bots.map((b) => b.learners)) + sum(s.courses.map((c) => c.students))],
    [t("stMsgs"), sum(s.bots.map((b) => b.messages))],
    [t("csSales"), `${fmt(sum(s.courses.map((c) => c.sales_pi)))} π`],
    [t("earned"), sum(s.bots.map((b) => b.earned)) + sum(s.courses.map((c) => c.earned))],
  ] as const;

  // Last 30 days, missing days as zero.
  const byDay = new Map(s.daily.map((d) => [d.day.slice(0, 10), Number(d.chats)]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    return { d, n: byDay.get(d) || 0 };
  });
  const max = Math.max(1, ...days.map((x) => x.n));

  return (
    <div className="card cstats">
      <b>{t("csTitle")}</b>
      <div className="earn-top cs-tiles">
        {tiles.map(([k, v]) => <div key={k}><span className="hint">{k}</span><b className="num">{typeof v === "number" ? fmt(v) : v}</b></div>)}
      </div>
      <div>
        <span className="hint">{t("csActivity")}</span>
        <div className="bars" role="img" aria-label={t("csActivity")}>
          {days.map((x) => (
            <span key={x.d} className="bar" title={`${x.d}: ${x.n}`} style={{ height: `${Math.max(4, (x.n / max) * 100)}%`, opacity: x.n ? 1 : 0.25 }} />
          ))}
        </div>
      </div>
      {(s.bots.length > 0 || s.courses.length > 0) && (
        <div className="md-table"><table>
          <thead><tr><th>{t("csItem")}</th><th>{t("stLearners")}</th><th>{t("csActivityShort")}</th><th>{t("earned")}</th></tr></thead>
          <tbody>
            {s.bots.map((b) => <tr key={b.id}><td>🤖 {(lang === "en" ? b.name_en : b.name) || b.name}</td><td className="num">{fmt(b.learners)}</td><td className="num">{fmt(b.messages)}</td><td className="num">{fmt(b.earned)}</td></tr>)}
            {s.courses.map((c) => <tr key={c.id}><td>📚 {(lang === "en" ? c.title_en : c.title) || c.title}</td><td className="num">{fmt(c.students)}</td><td className="num">{fmt(c.completed)} ✓</td><td className="num">{fmt(c.earned)}</td></tr>)}
          </tbody>
        </table></div>
      )}
      {s.questions.length > 0 && (
        <details>
          <summary className="hint" style={{ cursor: "pointer" }}>{t("csQuestions")}</summary>
          <ul className="small" style={{ marginTop: 6, paddingInlineStart: 18, display: "grid", gap: 4 }}>{s.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
