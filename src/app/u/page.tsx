"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Rating } from "@/components/PersonCard";
import { post } from "@/lib/pi-client";

const DELIVERIES = ["text", "pdf", "ppt", "image", "file"] as const;
type Profile = {
  username: string; has_profile: boolean; is_me: boolean; headline: string; bio: string; skills: string[]; uses_ai: "ai" | "manual" | "both"; available: boolean;
  rate_from: number | null; since: string; stats: { done: number; avg: number | null; rated: number; rejected: number }; categories: string[];
  reviews: { stars: number; note: string | null; by: string; category: string; at: string }[];
  portfolio: { id: string; title: string; description: string; made_with: "ai" | "manual" | "both"; tags: string[]; has_image: boolean }[];
};
const toNum = (v: string) => Number(v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));

function ProfileView() {
  const { t, user, login, toast } = useApp();
  const router = useRouter();
  const name = useSearchParams().get("name") || "";
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [hire, setHire] = useState(false);
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
            : <button className="btn primary" disabled={!p.has_profile || !p.available} onClick={() => (user ? setHire((v) => !v) : login())}>{t("prHire")}</button>}
        </div>
      </section>

      {hire && !p.is_me && <HireForm to={p.username} onDone={(id) => { toast(t("hrSent")); router.push(`/deals?id=${id}`); }} onClose={() => setHire(false)} />}

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

function HireForm({ to, onDone, onClose }: { to: string; onDone: (id: string) => void; onClose: () => void }) {
  const { t, toast } = useApp();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [category, setCategory] = useState("");
  const [delivery, setDelivery] = useState<(typeof DELIVERIES)[number]>("text");
  const [price, setPrice] = useState("0.5");
  const [busy, setBusy] = useState(false);
  const pr = toNum(price) || 0;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/deals", { action: "create", username: to, title, brief, category, delivery, price: pr });
    setBusy(false);
    if (r.ok) { onDone(r.data.id); return; }
    const err = r.data?.error;
    const m: Record<string, string> = { not_available: t("hrNotAvail"), self: t("hrSelf"), already_open: t("hrAlready"), too_many: t("hrTooMany"), bad_price: t("tkBadReward"), blocked: `${t("tkBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` };
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

export default function Page() { return <Suspense fallback={<div className="skeleton" style={{ height: 220 }} />}><ProfileView /></Suspense>; }
