"use client";

import Link from "next/link";
import { useApp } from "./AppProvider";

export type Person = {
  username: string; headline: string; skills: string[]; uses_ai: "ai" | "manual" | "both"; available: boolean; rate_from: number | null;
  stats: { done: number; avg: number | null; rated: number }; works: string[]; badges?: string[]; services?: { title: string; price: number }[];
};

export function Badges({ list }: { list?: string[] }) {
  const { t } = useApp();
  if (!list?.length) return null;
  return <>{list.map((b) => <span key={b} className="chip badge-chip">{t(`bd_${b}` as never)}</span>)}</>;
}

export function Rating({ avg, n }: { avg: number | null; n?: number }) {
  if (!avg) return null;
  return <span className="chip warn num ltr">★ {Number(avg).toFixed(1)}{n ? ` (${n})` : ""}</span>;
}

/** A person in search results: who they are, how they work, how others rated them, and a peek at their portfolio. */
export function PersonCard({ p }: { p: Person }) {
  const { t } = useApp();
  return (
    <Link href={`/u?name=${encodeURIComponent(p.username)}`} className="card person-card">
      <div className="pc-top">
        <div className="avatar">{p.username.slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b className="ltr" style={{ textAlign: "start", display: "block" }}>@{p.username}</b>
          <span className="hint">{p.headline || t("prNoHeadline")}</span>
        </div>
        <span className={`chip ${p.available ? "free" : ""}`}>{p.available ? t("ppAvail") : t("ppBusy")}</span>
      </div>
      <div className="chips">
        <span className="chip v">{t(`uses_${p.uses_ai}` as never)}</span>
        <Badges list={p.badges} />
        <Rating avg={p.stats.avg} n={p.stats.rated} />
        <span className="chip num">{p.stats.done > 0 ? t("ppDone", { n: p.stats.done }) : t("ppNew")}</span>
        {p.rate_from ? <span className="chip num">{t("ppFrom", { n: `${Number(p.rate_from)} π` })}</span> : null}
      </div>
      {p.skills.length > 0 && <div className="chips">{p.skills.slice(0, 5).map((s) => <span key={s} className="chip">{s}</span>)}</div>}
      {p.services && p.services.length > 0 && <span className="hint">{p.services.map((x) => `${x.title} · ${Number(x.price)} π`).join("  |  ")}</span>}
      {p.works.length > 0 && <span className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.works.join(" · ")}</span>}
    </Link>
  );
}
