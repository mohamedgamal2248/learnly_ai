"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { ICheck, ILock, ISearch } from "@/components/Icons";
import { readGuest, starsFor } from "@/lib/guest";
import { tierLabel, type Catalog } from "@/lib/learn-client";

type Hit = { kind: "lesson" | "word"; id: string; title: string; sub: string; locked: boolean; tier: string };
const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];

function Stars({ n }: { n: number }) {
  return <span className="stars" aria-label={`${n}/3`}>{[1, 2, 3].map((i) => <i key={i} className={i <= n ? "on" : ""}>★</i>)}</span>;
}

/** The lesson path: a winding road of lessons. Finished ones show stars, the next one glows, locked ones are grey. */
export default function Learn() {
  const { user, tt } = useApp();
  const { native, plan, st } = useLearn();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [guest, setGuest] = useState<Record<string, { best: number }>>({});
  const cur = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => { setGuest(readGuest()); }, []);
  useEffect(() => {
    fetch(`/api/en/catalog?native=${native}`, { credentials: "include", cache: "no-store" }).then((r) => r.json()).then(setCat).catch(() => {});
  }, [native, user?.id, plan, st?.progress.length]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    const t = setTimeout(() => fetch(`/api/en/search?q=${encodeURIComponent(q.trim())}&native=${native}`, { credentials: "include" }).then((r) => r.json()).then((d) => setHits(d.results || [])).catch(() => setHits([])), 250);
    return () => clearTimeout(t);
  }, [q, native, user?.id]);

  const prog = useMemo(() => {
    const m = new Map<string, { best: number; done: boolean }>();
    if (cat) for (const p of cat.progress) m.set(p.id, { best: p.best, done: p.done });
    if (!user) for (const [id, v] of Object.entries(guest)) m.set(id, { best: v.best, done: true });
    return m;
  }, [cat, guest, user]);
  const currentId = cat?.lessons.find((l) => !l.locked && !prog.get(l.id)?.done)?.id;
  useEffect(() => { if (cur.current) cur.current.scrollIntoView({ block: "center", behavior: "smooth" }); }, [currentId, cat?.lessons.length]);

  if (!cat) return <div className="stack"><div className="skeleton" style={{ height: 120 }} /><div className="skeleton" style={{ height: 240 }} /></div>;
  const doneCount = cat.lessons.filter((l) => prog.get(l.id)?.done).length;
  let idx = 0;

  return (
    <div className="stack">
      <section className="lc">
        <span className="eyebrow">{tt("Your course")}</span>
        <div className="big">{tt("English from zero to conversation")}</div>
        <div className="prog" style={{ marginTop: 10 }}><i style={{ width: `${(doneCount / cat.lessons.length) * 100}%` }} /></div>
        <div className="muted small num" style={{ marginTop: 6 }}>{tt("{a} of {b} lessons finished", { a: doneCount, b: cat.lessons.length })}</div>
      </section>

      <label className="searchbox"><ISearch width={18} height={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt("Search a lesson or a word")} /></label>

      {hits ? (
        <div className="stack">
          {!hits.length && <div className="lc muted">{tt("No results")}</div>}
          {hits.map((h, i) => (
            <Link key={i} href={h.locked ? "/plans" : `/lesson?id=${h.id}`} className="lc tap" style={{ padding: 14 }}>
              <div className={`ic-sq ${h.locked ? "warm" : "soft"}`} style={{ width: 40, height: 40, borderRadius: 12 }}>{h.locked ? <ILock width={18} height={18} /> : <b>{h.kind === "word" ? "A" : "#"}</b>}</div>
              <div className="grow"><b dir="ltr" style={{ display: "block", textAlign: "start" }}>{h.title}</b><div className="muted small native">{h.sub}</div></div>
              <span className="chip">{h.kind === "word" ? tt("Word") : tt("Lesson")}</span>
            </Link>
          ))}
        </div>
      ) : (
        cat.units.map((u) => {
          const ls = cat.lessons.filter((l) => l.unit === u.id);
          return (
            <section key={u.id} className="unit">
              <div className="unit-head"><span className="chip v">{u.level}</span><b>{u.icon} {u.title}</b><span className="native">{u.titleTr}</span></div>
              <div className="path">
                {ls.map((l) => {
                  const p = prog.get(l.id);
                  const done = !!p?.done, isCur = l.id === currentId;
                  const off = OFFSETS[idx++ % OFFSETS.length];
                  return (
                    <Link key={l.id} ref={isCur ? cur : undefined} href={l.locked ? "/plans" : `/lesson?id=${l.id}`} className={`node${done ? " done" : ""}${isCur ? " cur" : ""}${l.locked ? " lock" : ""}`} style={{ ["--o" as string]: `${off}px` }}>
                      <span className="bubble-n">{done ? <ICheck width={30} height={30} strokeWidth={3} /> : l.locked ? <ILock width={26} height={26} /> : <b className="num">{l.n}</b>}</span>
                      {done ? <Stars n={starsFor(true, p?.best ?? 0)} /> : isCur ? <span className="go">{tt("Start")}</span> : l.locked ? <span className="tiny">{tt(tierLabel(l.tier))}</span> : null}
                      <span className="n-title">{l.title}</span>
                      <span className="n-sub native">{l.titleTr}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
