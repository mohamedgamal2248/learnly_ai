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
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("rating");
  const [avail, setAvail] = useState(false);
  const [rating, setRating] = useState("");
  const [maxP, setMaxP] = useState("");
  const [busy, setBusy] = useState(false);
  const qs = (offset: number) => `/api/people?q=${encodeURIComponent(term)}&sort=${sort}&offset=${offset}${ai ? `&ai=${ai}` : ""}${avail ? "&avail=1" : ""}${rating ? `&rating=${rating}` : ""}${Number(maxP) > 0 ? `&max=${Number(maxP)}` : ""}`;
  const load = useCallback(async () => {
    setList(null);
    const r = await fetch(qs(0));
    if (r.ok) { const d = await r.json(); setList(d.people); setTotal(d.total); } else { setList([]); setTotal(0); }
  }, [term, ai, sort, avail, rating, maxP]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  async function more() {
    setBusy(true);
    const r = await fetch(qs(list?.length ?? 0));
    setBusy(false);
    if (r.ok) { const d = await r.json(); setList((cur) => [...(cur || []), ...d.people]); setTotal(d.total); }
  }
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t("tkSort")}>
            <option value="rating">{t("ppSortRating")}</option><option value="done">{t("ppSortDone")}</option><option value="new">{t("ppSortNew")}</option><option value="price">{t("ppSortPrice")}</option>
          </select>
          <select className="select" value={rating} onChange={(e) => setRating(e.target.value)} aria-label={t("ppMinRating")}>
            <option value="">{t("ppMinRating")}</option><option value="4.5">★ 4.5+</option><option value="4">★ 4+</option><option value="3">★ 3+</option>
          </select>
          <input className="input ltr" inputMode="decimal" value={maxP} onChange={(e) => setMaxP(e.target.value.replace(/[^\d.]/g, ""))} placeholder={t("ppMaxPrice")} aria-label={t("ppMaxPrice")} />
        </div>
        <label className="plan-task"><input type="checkbox" checked={avail} onChange={(e) => setAvail(e.target.checked)} /><span>{t("ppOnlyAvail")}</span></label>
        <div className="chips" style={{ flexWrap: "wrap" }}>{IDEAS.map((i) => <button type="button" key={i} className="chip" onClick={() => { setQ(t(`idea_${i}` as never)); setTerm(t(`idea_${i}` as never)); }}>{t(`idea_${i}` as never)}</button>)}</div>
      </form>
      {!list ? <div className="skeleton" style={{ height: 140 }} /> : !list.length ? <div className="card empty">{t("ppNone")}</div> : (
        <>
          <div className="grid stagger">{list.map((p) => <PersonCard key={p.username} p={p} />)}</div>
          {list.length < total && <button className="btn" style={{ justifySelf: "center" }} disabled={busy} onClick={more}>{busy ? t("preparing") : t("loadMore", { n: total - list.length })}</button>}
        </>
      )}
    </div>
  );
}
