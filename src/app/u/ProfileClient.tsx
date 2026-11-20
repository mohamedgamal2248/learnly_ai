"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Badges, Rating } from "@/components/PersonCard";
import { post } from "@/lib/pi-client";

const DELIVERIES = ["text", "pdf", "ppt", "image", "file"] as const;
type Profile = {
  username: string; has_profile: boolean; is_me: boolean; headline: string; bio: string; skills: string[]; uses_ai: "ai" | "manual" | "both"; available: boolean;
  rate_from: number | null; since: string; badges: string[]; blocked: boolean;
  services: { id: string; title: string; description: string; category: string; delivery: string; price: number; days: number }[]; stats: { done: number; avg: number | null; rated: number; rejected: number }; categories: string[];
  reviews: { stars: number; note: string | null; by: string; category: string; at: string }[];
  portfolio: { id: string; title: string; description: string; made_with: "ai" | "manual" | "both"; tags: string[]; has_image: boolean }[];
};
const toNum = (v: string) => Number(v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));

function ProfileView() {
  const { t, user, login, toast } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const name = sp.get("name") || "";
  const again = { title: sp.get("title") || "", category: sp.get("category") || "", delivery: sp.get("delivery") || "text", price: sp.get("price") || "0.5" };
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [hire, setHire] = useState(false);
  useEffect(() => { if (sp.get("again") && user) setHire(true); }, [sp, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const r = await fetch(`/api/profile?name=${encodeURIComponent(name)}`, { credentials: "include", cache: "no-store" });
    setP(r.ok ? (await r.json()).profile : null);
  }, [name]);
  useEffect(() => { if (name) load(); else setP(null); }, [load, name, user?.id]);

  if (p === undefined) return <div className="skeleton" style={{ height: 220 }} />;
  if (!p) return <div className="card empty">{t("prNotFound")}</div>;
  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <section className="card" style={{ display: "grid", gap: 10 }}>
        <div className="pc-top">
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{p.username.slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="ltr" style={{ fontSize: 20, textAlign: "start" }}>@{p.username}</h1>
            <span className="hint">{p.headline || (p.has_profile ? "" : t("prNoProfile"))}</span>
          </div>
        </div>
        <div className="chips">
          <span className="chip v">{t(`uses_${p.uses_ai}` as never)}</span>
          <Badges list={p.badges} />
          <span className={`chip ${p.available ? "free" : ""}`}>{p.available ? t("ppAvail") : t("prBusy")}</span>
          <Rating avg={p.stats.avg} n={p.stats.rated} />
          <span className="chip num">{t("prStats", { done: p.stats.done })}</span>
          {p.rate_from ? <span className="chip num">{t("ppFrom", { n: `${Number(p.rate_from)} π` })}</span> : null}
        </div>
        {p.bio && <p className="small post-body">{p.bio}</p>}
        {p.skills.length > 0 && <div className="chips">{p.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
        {p.categories.length > 0 && <span className="hint">{t("prPaidFor")}: {p.categories.join("، ")}</span>}
        <div className="row-actions">
          {p.is_me ? <Link className="btn primary sm" href="/profile">{t("prEdit")}</Link>
            : <button className="btn primary" disabled={!p.has_profile || !p.available || p.blocked} onClick={() => (user ? setHire((v) => !v) : login())}>{t("prHire")}</button>}
          <button className="btn sm" onClick={() => share(p.username)}>{t("prShare")}</button>
        </div>
        {!p.is_me && user && <SafetyBar p={p} onChange={load} />}
      </section>

      {hire && !p.is_me && <HireForm to={p.username} init={again} onDone={(id) => { toast(t("hrSent")); router.push(`/deals?id=${id}`); }} onClose={() => setHire(false)} />}

      {p.services.length > 0 && (
        <>
          <div className="sec-h"><h2>{t("prServices")}</h2></div>
          <div className="grid">{p.services.map((x) => <ServiceCard key={x.id} s={x} mine={p.is_me} available={p.available && !p.blocked} onOrdered={(id) => router.push(`/deals?id=${id}`)} />)}</div>
        </>
      )}

      <div className="sec-h"><h2>{t("prPortfolio")}</h2></div>
      {!p.portfolio.length ? <div className="card empty">{t("prNoWork")}</div> : (
        <div className="course-grid stagger">
          {p.portfolio.map((w) => (
            <div key={w.id} className="card work-card">
              {w.has_image && <img className="work-img" src={`/api/profile/img?id=${w.id}`} alt={w.title} loading="lazy" />}
              <b>{w.title}</b>
              <span className={`chip ${w.made_with === "ai" ? "v" : ""}`} style={{ justifySelf: "start" }}>{t(`made_${w.made_with}` as never)}</span>
              {w.description && <p className="small muted">{w.description}</p>}
              {w.tags.length > 0 && <div className="chips">{w.tags.map((g) => <span key={g} className="chip">{g}</span>)}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="sec-h"><h2>{t("prReviews")}</h2></div>
      {!p.reviews.length ? <div className="card empty">{t("prNoReviews")}</div> : (
        <div className="grid">
          {p.reviews.map((r, i) => (
            <div key={i} className="card" style={{ display: "grid", gap: 4 }}>
              <div className="chips"><span className="chip warn num ltr">{"★".repeat(r.stars)}</span>{r.category && <span className="chip">{r.category}</span>}<span className="hint ltr">@{r.by}</span></div>
              {r.note && <p className="small">{r.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HireForm({ to, init, onDone, onClose }: { to: string; init: { title: string; category: string; delivery: string; price: string }; onDone: (id: string) => void; onClose: () => void }) {
  const { t, toast } = useApp();
  const [title, setTitle] = useState(init.title);
  const [brief, setBrief] = useState("");
  const [category, setCategory] = useState(init.category);
  const [delivery, setDelivery] = useState<(typeof DELIVERIES)[number]>((DELIVERIES as readonly string[]).includes(init.delivery) ? (init.delivery as (typeof DELIVERIES)[number]) : "text");
  const [price, setPrice] = useState(init.price);
  const [busy, setBusy] = useState(false);
  const pr = toNum(price) || 0;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/deals", { action: "create", username: to, title, brief, category, delivery, price: pr });
    setBusy(false);
    if (r.ok) { onDone(r.data.id); return; }
    const err = r.data?.error;
    const m: Record<string, string> = { not_available: t("hrNotAvail"), self: t("hrSelf"), already_open: t("hrAlready"), too_many: t("hrTooMany"), bad_price: t("tkBadReward"), blocked: `${t("tkBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}`, contact_info: t("contactInfo"), blocked_user: t("blockedUser") };
    toast(m[err] || t("errGeneric"));
  }
  return (
    <form className="card" onSubmit={send} style={{ display: "grid", gap: 10, animation: "rise .25s both" }}>
      <b>{t("hrTitle", { name: to })}</b>
      <p className="hint">{t("hrHint")}</p>
      <label className="field"><span>{t("tkTitle")}</span><input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>{t("tkBrief")}</span><textarea className="textarea" value={brief} maxLength={1000} placeholder={t("tkBriefPh")} onChange={(e) => setBrief(e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field"><span>{t("tkKind")}</span><input className="input" value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} /></label>
        <label className="field"><span>{t("tkDelivery")}</span>
          <select className="select" value={delivery} onChange={(e) => setDelivery(e.target.value as (typeof DELIVERIES)[number])}>{DELIVERIES.map((d) => <option key={d} value={d}>{t(`delivery_${d}` as never)}</option>)}</select></label>
      </div>
      <label className="field"><span>{t("hrPrice")}</span><input className="input ltr" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      <div className="row-actions">
        <button className="btn primary" disabled={busy || title.trim().length < 3 || !(pr >= 0.05 && pr <= 50)}>{busy ? t("preparing") : t("hrSend")}</button>
        <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
      </div>
    </form>
  );
}

async function share(username: string) {
  const url = `${location.origin}/u?name=${encodeURIComponent(username)}`;
  try { if (navigator.share) { await navigator.share({ title: `@${username}`, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); } catch {}
}

/** Fixed-price service: one click to order, the price is held and a task goes straight to the seller. */
function ServiceCard({ s, mine, available, onOrdered }: { s: Profile["services"][number]; mine: boolean; available: boolean; onOrdered: (dealId: string) => void }) {
  const { t, user, login, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  async function order() {
    setBusy(true);
    const r = await post("/api/services/order", { id: s.id, brief });
    setBusy(false);
    if (r.ok) { toast(t("svOrdered")); onOrdered(r.data.deal_id); return; }
    const e = r.data?.error;
    toast(e === "not_enough" ? t("dlNeedBalance", { n: `${Number(r.data?.balance ?? 0)} π` }) : e === "contact_info" ? t("contactInfo") : e === "blocked_user" ? t("blockedUser") : e === "not_available" ? t("hrNotAvail") : e === "blocked" ? t("tkBlocked") : t("errGeneric"));
  }
  return (
    <div className="card" style={{ display: "grid", gap: 6 }}>
      <div className="chips" style={{ flexWrap: "wrap" }}>
        <span className="chip free num ltr">{Number(s.price)} π</span><span className="chip">{t(`delivery_${s.delivery}` as never)}</span><span className="chip num">{t("svDays", { n: s.days })}</span>{s.category && <span className="chip">{s.category}</span>}
      </div>
      <b>{s.title}</b>
      {s.description && <p className="small muted">{s.description}</p>}
      {!mine && (
        open ? (
          <div className="grid" style={{ gap: 8 }}>
            <textarea className="textarea" value={brief} maxLength={1000} placeholder={t("svBriefPh")} onChange={(e) => setBrief(e.target.value)} style={{ minHeight: 80 }} />
            <span className="hint">{t("svHoldHint", { n: `${Number(s.price)} π` })}</span>
            <div className="row-actions"><button className="btn primary sm" disabled={busy} onClick={order}>{busy ? t("preparing") : t("svConfirm", { n: `${Number(s.price)} π` })}</button><button className="btn sm" onClick={() => setOpen(false)}>{t("cancel")}</button></div>
          </div>
        ) : <button className="btn primary sm" style={{ justifySelf: "start" }} disabled={!available} onClick={() => (user ? setOpen(true) : login())}>{t("svOrder")}</button>
      )}
    </div>
  );
}

/** Block and report: the quiet way out of a bad interaction. */
function SafetyBar({ p, onChange }: { p: Profile; onChange: () => void }) {
  const { t, toast } = useApp();
  const [rep, setRep] = useState(false);
  const [reason, setReason] = useState("");
  async function block() {
    const r = await post("/api/blocks", { username: p.username, on: !p.blocked });
    if (r.ok) { toast(t(p.blocked ? "sfUnblocked" : "sfBlocked")); onChange(); } else toast(t("errGeneric"));
  }
  async function report() {
    const r = await post("/api/reports", { username: p.username, kind: "profile", reason });
    if (r.ok) { toast(t("sfReported")); setRep(false); setReason(""); } else toast(t("errGeneric"));
  }
  return (
    <div className="grid" style={{ gap: 6 }}>
      <div className="row-actions">
        <button className="btn sm" onClick={block}>{t(p.blocked ? "sfUnblock" : "sfBlock")}</button>
        <button className="btn sm" onClick={() => setRep((v) => !v)}>{t("sfReport")}</button>
      </div>
      {rep && (
        <div className="grid" style={{ gap: 6 }}>
          <textarea className="textarea" value={reason} maxLength={500} placeholder={t("sfReportPh")} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 70 }} />
          <button className="btn danger sm" style={{ justifySelf: "start" }} disabled={reason.trim().length < 3} onClick={report}>{t("sfSend")}</button>
        </div>
      )}
    </div>
  );
}

export default function ProfileClient() { return <Suspense fallback={<div className="skeleton" style={{ height: 220 }} />}><ProfileView /></Suspense>; }
