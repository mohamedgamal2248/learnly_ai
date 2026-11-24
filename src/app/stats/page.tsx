"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { LOCALE } from "@/lib/ui-i18n";

type Stats = { words: number; mastered: number; lessons: number; accuracy: number | null; minutes_total: number; xp: number; best: number; mistakes: number; week: { day: string; xp: number; minutes: number }[] };

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="lc" style={{ padding: 14 }}><div className="muted small">{label}</div><div className="big num">{value}</div>{sub && <div className="muted small">{sub}</div>}</div>;
}

export default function StatsPage() {
  const { user, login, tt, uiLang } = useApp();
  const { st } = useLearn();
  const [d, setD] = useState<Stats | null>(null);
  useEffect(() => { if (user) fetch("/api/en/stats", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then(setD).catch(() => {}); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <div className="lc stack"><b>{tt("Sign in to see your stats")}</b><button className="btn primary" onClick={login}>{tt("Sign in with Pi")}</button></div>;
  if (!d) return <div className="skeleton" style={{ height: 300 }} />;
  const wd = new Intl.DateTimeFormat(LOCALE[uiLang], { weekday: "short", timeZone: "UTC" });
  const max = Math.max(20, st?.xp_goal ?? 20, ...d.week.map((x) => x.xp));
  return (
    <div className="stack">
      <section><span className="eyebrow">{tt("My stats")}</span><h1 style={{ fontSize: 24 }}>{tt("Your progress")}</h1></section>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Tile label={tt("Words learned")} value={d.words} sub={tt("{n} well known", { n: d.mastered })} />
        <Tile label={tt("Lessons finished")} value={d.lessons} />
        <Tile label={tt("Accuracy (30 days)")} value={d.accuracy == null ? "—" : `${d.accuracy}%`} />
        <Tile label={tt("Time learning")} value={tt("{n} min", { n: d.minutes_total })} />
        <Tile label={tt("Total XP")} value={d.xp} />
        <Tile label={tt("Best streak")} value={tt("{n} days", { n: d.best })} />
      </div>
      <section className="lc">
        <b>{tt("XP this week")}</b>
        <div className="bars" role="img" aria-label={tt("XP this week")}>
          {d.week.map((x) => {
            const dt = new Date(x.day + "T00:00:00Z");
            return (
              <div key={x.day} className="bar">
                <span className="num hint">{x.xp || ""}</span>
                <i style={{ height: `${Math.max(4, (x.xp / max) * 100)}%` }} className={x.xp >= (st?.xp_goal ?? 20) ? "hit" : ""} />
                <span className="hint">{wd.format(dt)}</span>
              </div>
            );
          })}
        </div>
      </section>
      {d.mistakes > 0 && <Link className="btn" href="/mistakes">{tt("Practise {n} missed words", { n: d.mistakes })}</Link>}
    </div>
  );
}
