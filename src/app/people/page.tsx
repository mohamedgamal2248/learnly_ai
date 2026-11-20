"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { IconTile, IUsers } from "@/components/Icons";
import { PersonCard, type Person } from "@/components/PersonCard";

const IDEAS = ["logo", "translation", "summary", "code", "design", "research"];

export default function PeoplePage() {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [ai, setAi] = useState<"" | "ai" | "manual">("");
  const [list, setList] = useState<Person[] | null>(null);
  const load = useCallback(async () => {
    setList(null);
    const r = await fetch(`/api/people?q=${encodeURIComponent(term)}${ai ? `&ai=${ai}` : ""}`);
    setList(r.ok ? (await r.json()).people : []);
  }, [term, ai]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="hero-card">
        <IconTile size={56} glass><IUsers /></IconTile>
        <div><h1>{t("ppTitle")}</h1><p>{t("ppSub")}</p></div>
      </div>
      <form className="card" style={{ display: "grid", gap: 10 }} onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <div className="earn-form">
          <input className="input" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} placeholder={t("ppSearchPh")} aria-label={t("ppSearchPh")} />
          <button className="btn primary">{t("ppSearch")}</button>
        </div>
        <div className="chips">
          {[["", "all"], ["ai", "uses_ai"], ["manual", "uses_manual"]].map(([k, key]) => (
            <button type="button" key={k} className={`pill${ai === k ? " on" : ""}`} onClick={() => setAi(k as "" | "ai" | "manual")}>{t(key as never)}</button>
          ))}
        </div>
        <div className="chips" style={{ flexWrap: "wrap" }}>{IDEAS.map((i) => <button type="button" key={i} className="chip" onClick={() => { setQ(t(`idea_${i}` as never)); setTerm(t(`idea_${i}` as never)); }}>{t(`idea_${i}` as never)}</button>)}</div>
      </form>
      {!list ? <div className="skeleton" style={{ height: 140 }} /> : !list.length ? <div className="card empty">{t("ppNone")}</div> : (
        <div className="grid stagger">{list.map((p) => <PersonCard key={p.username} p={p} />)}</div>
      )}
    </div>
  );
}
