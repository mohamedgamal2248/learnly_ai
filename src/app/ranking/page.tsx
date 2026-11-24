"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";

type Board = { week_start: string; hidden: boolean; me: { xp: number; rank: number }; rows: { username: string; xp: number; me: boolean }[] };

/** This week's ranking by XP. Everyone starts again from zero on Monday. */
export default function Ranking() {
  const { user, login, tt } = useApp();
  const [b, setB] = useState<Board | null>(null);
  const load = () => fetch("/api/en/leaderboard", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then(setB).catch(() => {});
  useEffect(() => { if (user) load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <div className="lc stack"><b>{tt("Sign in to see the ranking")}</b><button className="btn primary" onClick={login}>{tt("Sign in with Pi")}</button></div>;
  if (!b) return <div className="skeleton" style={{ height: 240 }} />;
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1));
  return (
    <div className="stack">
      <section><span className="eyebrow">{tt("Ranking")}</span><h1 style={{ fontSize: 24 }}>{tt("This week's ranking")}</h1>
        <p className="muted small">{tt("Ranked by XP. It restarts every Monday.")}</p></section>
      <div className="lc hl row"><div className="grow"><b>{tt("Your rank")}</b><div className="muted small num">{tt("{n} XP this week", { n: b.me.xp })}</div></div><div className="big num">#{b.me.rank}</div></div>
      {!b.rows.length && <div className="lc muted">{tt("Nobody has earned XP this week yet. Be the first!")}</div>}
      {b.rows.map((r, i) => (
        <div key={r.username} className={`lc row${r.me ? " hl" : ""}`} style={{ padding: 12 }}>
          <b className="num" style={{ width: 32, textAlign: "center", fontSize: 18 }}>{medal(i)}</b>
          <b className="grow ltr" style={{ textAlign: "start" }}>@{r.username}</b>
          <span className="chip v num">{r.xp} XP</span>
        </div>
      ))}
      <label className="lc row" style={{ padding: 12 }}>
        <span className="grow small">{tt("Hide my name from the ranking")}</span>
        <input type="checkbox" checked={b.hidden} onChange={async (e) => { await post("/api/en/leaderboard", { hide: e.target.checked }); load(); }} style={{ width: 22, height: 22 }} />
      </label>
    </div>
  );
}
