"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { ICheck, ILock } from "@/components/Icons";
import { tierLabel, type Catalog } from "@/lib/learn-client";

/** The lesson path: units of three lessons, with a lock on what the current plan does not include. */
export default function Learn() {
  const { user, tt } = useApp();
  const { native, plan, st } = useLearn();
  const [cat, setCat] = useState<Catalog | null>(null);
  useEffect(() => {
    fetch(`/api/en/catalog?native=${native}`, { credentials: "include", cache: "no-store" }).then((r) => r.json()).then(setCat).catch(() => {});
  }, [native, user?.id, plan, st?.progress.length]);

  if (!cat) return <div className="stack"><div className="skeleton" style={{ height: 120 }} /><div className="skeleton" style={{ height: 120 }} /></div>;
  const prog = new Map(cat.progress.map((p) => [p.id, p]));
  const doneCount = cat.progress.filter((p) => p.done).length;

  return (
    <div className="stack">
      <section className="lc">
        <span className="eyebrow">{tt("Your course")}</span>
        <div className="big">{tt("English from zero to conversation")}</div>
        <div className="prog" style={{ marginTop: 10 }}><i style={{ width: `${(doneCount / cat.lessons.length) * 100}%` }} /></div>
        <div className="muted small num" style={{ marginTop: 6 }}>{tt("{a} of {b} lessons finished", { a: doneCount, b: cat.lessons.length })}</div>
      </section>
      {cat.units.map((u) => {
        const ls = cat.lessons.filter((l) => l.unit === u.id);
        return (
          <section key={u.id} className="stack">
            <div className="sec-h" style={{ margin: "10px 2px 0" }}>
              <div><span className="chip v">{u.level}</span> <b style={{ marginInlineStart: 6 }}>{u.title}</b><div className="muted small native">{u.titleTr}</div></div>
            </div>
            {ls.map((l) => {
              const p = prog.get(l.id);
              return (
                <Link key={l.id} href={l.locked ? "/plans" : `/lesson?id=${l.id}`} className="lc tap" style={{ padding: 14 }}>
                  <div className={`ic-sq ${p?.done ? "ok" : l.locked ? "warm" : "soft"}`} style={{ width: 46, height: 46, borderRadius: 14 }}>
                    {p?.done ? <ICheck width={22} height={22} /> : l.locked ? <ILock width={20} height={20} /> : <b className="num">{l.n}</b>}
                  </div>
                  <div className="grow"><b>{l.title}</b><div className="muted small native">{l.titleTr}</div></div>
                  <span className={`chip ${l.tier === "free" ? "free" : "warn"}`}>{tt(tierLabel(l.tier))}</span>
                </Link>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
