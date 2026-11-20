"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

const pi = (n: number | string) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;
const toNum = (v: string) => Number(v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));
const CHIP: Record<string, string> = { pending: "warn", countered: "warn", accepted: "free", declined: "bad" };

type Row = { id: string; title: string; price: number; status: string; role: string; other: string; turn: boolean; unread: boolean; last: string | null; task_id: string | null };
type Deal = {
  id: string; title: string; brief: string; category: string; delivery: string; price: number; status: string; role: "requester" | "worker"; other: string; task_id: string | null; turn: boolean;
  messages: { id: number; mine: boolean; body: string; price: number | null; kind: string; at: string }[];
};

function DealsView() {
  const { t, user, ready, login } = useApp();
  const id = useSearchParams().get("id");
  if (!ready) return <div className="skeleton" style={{ height: 200 }} />;
  if (!user) return <div className="card" style={{ display: "grid", gap: 10 }}><p className="muted">{t("tkLoginFirst")}</p><button className="btn primary" style={{ justifySelf: "start" }} onClick={login}>{t("login")}</button></div>;
  return id ? <Thread id={id} /> : <Inbox />;
}

function Inbox() {
  const { t } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { fetch("/api/deals", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : { deals: [] })).then((d) => setRows(d.deals)); }, []);
  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="card"><h1 style={{ fontSize: 20 }}>{t("dlTitle")}</h1><p className="hint">{t("dlSub")}</p></div>
      {!rows ? <div className="skeleton" style={{ height: 100 }} /> : !rows.length ? <div className="card empty">{t("dlNone")} <Link className="md-link" href="/people">{t("nPeople")}</Link></div> : (
        <div className="grid stagger">
          {rows.map((r) => (
            <Link key={r.id} href={`/deals?id=${r.id}`} className="card" style={{ display: "grid", gap: 6 }}>
              <div className="chips">
                <span className={`chip ${CHIP[r.status] || ""}`}>{t(`dlS_${r.status}` as Key)}</span>
                {r.turn && <span className="chip v">{t("dlYourTurn")}</span>}
                {r.unread && <span className="chip warn">●</span>}
                <span className="chip num ltr">{pi(r.price)}</span>
                <span className="hint ltr">@{r.other}</span>
              </div>
              <b style={{ fontSize: 15.5 }}>{r.title}</b>
              {r.last && <span className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.last}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Thread({ id }: { id: string }) {
  const { t, toast } = useApp();
  const router = useRouter();
  const [d, setD] = useState<Deal | null | undefined>(undefined);
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/deals?id=${id}`, { credentials: "include", cache: "no-store" });
    setD(r.ok ? (await r.json()).deal : null);
  }, [id]);
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [d?.messages.length]);

  if (d === undefined) return <div className="skeleton" style={{ height: 200 }} />;
  if (!d) return <div className="card empty">{t("dlGone")}</div>;
  const open = d.status === "pending" || d.status === "countered";
  const p = price.trim() ? toNum(price) : null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/deals", { action: "msg", id, body, price: p });
    setBusy(false);
    if (r.ok) { setBody(""); setPrice(""); load(); }
    else toast(r.data?.error === "contact_info" ? t("contactInfo") : r.data?.error === "blocked_user" ? t("blockedUser") : r.data?.error === "bad_price" ? t("tkBadReward") : r.data?.error === "blocked" ? `${t("tkBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` : t("errGeneric"));
  }
  async function accept() {
    setBusy(true);
    const r = await post("/api/deals", { action: "accept", id });
    setBusy(false);
    if (r.ok) { toast(t("dlAccepted")); load(); }
    else toast(r.data?.error === "requester_not_enough" ? (r.data?.mine ? t("dlNeedBalance", { n: pi(r.data.balance ?? 0) }) : t("dlReqNotEnough")) : t("errGeneric"));
  }
  async function decline() { setBusy(true); const r = await post("/api/deals", { action: "decline", id }); setBusy(false); if (r.ok) load(); else toast(t("errGeneric")); }

  return (
    <div className="grid" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="card" style={{ display: "grid", gap: 6 }}>
        <button className="btn sm" style={{ justifySelf: "start" }} onClick={() => router.push("/deals")}>← {t("dlTitle")}</button>
        <h1 style={{ fontSize: 18 }}>{d.title}</h1>
        <div className="chips">
          <span className={`chip ${CHIP[d.status] || ""}`}>{t(`dlS_${d.status}` as Key)}</span>
          <span className="chip num ltr">{pi(d.price)}</span>
          <span className="chip">{t(`delivery_${d.delivery}` as Key)}</span>
          {d.category && <span className="chip">{d.category}</span>}
          <Link className="chip ltr" href={`/u?name=${encodeURIComponent(d.other)}`}>@{d.other}</Link>
        </div>
        <span className="hint">{t(d.role === "requester" ? "dlRoleReq" : "dlRoleWrk")}</span>
      </div>

      <div className="card" style={{ display: "grid", gap: 8 }}>
        {d.messages.map((m) => (
          <div key={m.id} className={`bubble${m.mine ? " mine" : ""}`}>
            {m.kind === "offer" && m.price != null && <span className="chip num">{t("dlOffer", { n: pi(m.price) })}</span>}
            {m.kind === "accepted" && <span className="chip free">{t("dlAcceptedMsg")} · {pi(m.price ?? 0)}</span>}
            {m.kind === "declined" && <span className="chip bad">{t("dlDeclinedMsg")}</span>}
            {m.body && <p className="small post-body">{m.body}</p>}
          </div>
        ))}
        <div ref={end} />
      </div>

      {d.status === "accepted" && d.task_id && <div className="notice"><b>{t("dlAccepted")}</b> <Link className="md-link" href="/tasks">{t("dlOpenTask")}</Link></div>}

      {open && (
        <>
          {d.turn && (
            <div className="row-actions">
              <button className="btn primary" disabled={busy} onClick={accept}>{t("dlAccept", { n: pi(d.price) })}</button>
              <button className="btn danger" disabled={busy} onClick={decline}>{t("dlDecline")}</button>
            </div>
          )}
          {!d.turn && <p className="hint">{t("dlWaiting")}</p>}
          <form className="card" onSubmit={send} style={{ display: "grid", gap: 8 }}>
            <textarea className="textarea" value={body} maxLength={1000} placeholder={t("dlMsgPh")} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 70 }} />
            <div className="earn-form">
              <input className="input ltr" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t("dlCounter")} aria-label={t("dlCounter")} />
              <span className="num earn-pi">π</span>
              <button className="btn primary" disabled={busy || (!body.trim() && p === null) || (p !== null && !(p >= 0.05 && p <= 50))}>{p !== null ? t("dlCounterBtn") : t("dlSend")}</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default function Page() { return <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}><DealsView /></Suspense>; }
