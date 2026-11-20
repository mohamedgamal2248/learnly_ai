"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

type N = { id: number; kind: string; data: Record<string, unknown>; link: string | null; read: boolean; at: string };
const pi = (n: unknown) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;

export default function NotificationsPage() {
  const { t, user, ready, login, lang } = useApp();
  const [list, setList] = useState<N[] | null>(null);
  const [follows, setFollows] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/notifs", { credentials: "include", cache: "no-store" }), fetch("/api/notifs?follows=1", { credentials: "include", cache: "no-store" })]);
    setList(a.ok ? (await a.json()).notifs : []);
    if (b.ok) setFollows((await b.json()).follows);
  }, []);
  useEffect(() => { if (user) load(); }, [user?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetch("/api/tasks/categories").then((r) => r.json()).then((d) => setCats((d.categories || []).map((c: { label: string }) => c.label))).catch(() => {}); }, []);

  if (!ready) return <div className="skeleton" style={{ height: 200 }} />;
  if (!user) return <div className="card" style={{ display: "grid", gap: 10 }}><p className="muted">{t("tkLoginFirst")}</p><button className="btn primary" style={{ justifySelf: "start" }} onClick={login}>{t("login")}</button></div>;

  async function follow(l: string, on: boolean) {
    const r = await post("/api/notifs", { label: l, on });
    if (r.ok) { setLabel(""); load(); }
  }
  const text = (n: N) => {
    const d = n.data as Record<string, any>;
    return t(`nf_${n.kind}` as Key, { title: d.title ?? "", price: d.price != null ? pi(d.price) : "", paid: d.paid != null ? pi(d.paid) : "", reward: d.reward != null ? pi(d.reward) : "", stage: d.stage ?? "", stars: d.stars ?? "", note: d.note ? `: ${d.note}` : "", who: d.who ?? "", category: d.category ?? "", decision: d.decision ? t(`dec_${d.decision}` as Key) : "" });
  };
  return (
    <div className="grid" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="card"><h1 style={{ fontSize: 20 }}>{t("nNotifs")}</h1><p className="hint">{t("nfSub")}</p></div>

      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>{t("nfFollow")}</b>
        <p className="hint">{t("nfFollowHint")}</p>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {follows.map((f) => <button key={f} className="chip v" onClick={() => follow(f, false)} aria-label={t("remove")}>{f} ✕</button>)}
          {!follows.length && <span className="hint">{t("nfNoFollow")}</span>}
        </div>
        <form className="earn-form" onSubmit={(e) => { e.preventDefault(); if (label.trim().length >= 2) follow(label.trim(), true); }}>
          <input className="input" list="nf-cats" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder={t("nfFollowPh")} />
          <datalist id="nf-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="btn primary" disabled={label.trim().length < 2}>{t("nfFollowBtn")}</button>
        </form>
      </div>

      {!list ? <div className="skeleton" style={{ height: 120 }} /> : !list.length ? <div className="card empty">{t("nfNone")}</div> : (
        <div className="grid">
          {list.map((n) => {
            const body = <><span className="small">{text(n)}</span><span className="hint num">{new Date(n.at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</span></>;
            return n.link ? <Link key={n.id} href={n.link} className={`card notif${n.read ? "" : " new"}`}>{body}</Link> : <div key={n.id} className={`card notif${n.read ? "" : " new"}`}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}
