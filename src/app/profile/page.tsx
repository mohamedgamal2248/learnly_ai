"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";

type Mine = {
  username: string; has_profile: boolean; headline: string; bio: string; skills: string[]; uses_ai: "ai" | "manual" | "both"; available: boolean; rate_from: number | null; visible: boolean;
  portfolio: { id: string; title: string; description: string; made_with: "ai" | "manual" | "both"; tags: string[]; has_image: boolean }[];
  services: { id: string; title: string; description: string; category: string; delivery: string; price: number; days: number }[];
};
const toNum = (v: string) => Number(v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));

/** Shrinks a photo in the browser (max 1000 px, JPEG) so a gallery image stays well under the 700 KB limit. */
async function shrink(file: File): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export default function ProfilePage() {
  const { t, user, ready, login, toast } = useApp();
  const [m, setM] = useState<Mine | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [usesAi, setUsesAi] = useState<"ai" | "manual" | "both">("both");
  const [available, setAvailable] = useState(true);
  const [visible, setVisible] = useState(true);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const r = await fetch(`/api/profile?name=${encodeURIComponent(user.username)}`, { credentials: "include", cache: "no-store" });
    if (!r.ok) return;
    const p: Mine = (await r.json()).profile;
    setM(p);
    setHeadline(p.headline); setBio(p.bio); setSkills(p.skills.join(", ")); setUsesAi(p.uses_ai); setAvailable(p.available); setVisible(p.visible);
    setRate(p.rate_from ? String(Number(p.rate_from)) : "");
  }, [user]);
  useEffect(() => { load(); }, [load]);

  if (!ready) return <div className="skeleton" style={{ height: 200 }} />;
  if (!user) return <div className="card" style={{ display: "grid", gap: 10 }}><p className="muted">{t("tkLoginFirst")}</p><button className="btn primary" style={{ justifySelf: "start" }} onClick={login}>{t("login")}</button></div>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/profile", { headline, bio, skills, uses_ai: usesAi, available, visible, rate_from: rate.trim() ? toNum(rate) : null });
    setBusy(false);
    if (r.ok) { toast(t("epSaved")); load(); }
    else toast(r.data?.error === "blocked" ? `${t("tkBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` : r.data?.error === "bad_rate" ? t("tkBadReward") : t("errGeneric"));
  }

  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, flex: 1 }}>{t("epTitle")}</h1>
        <Link className="btn sm" href={`/u?name=${encodeURIComponent(user.username)}`}>{t("epViewPublic")}</Link>
      </div>
      <form className="card" onSubmit={save} style={{ display: "grid", gap: 10 }}>
        <label className="field"><span>{t("epHeadline")}</span><input className="input" value={headline} maxLength={100} placeholder={t("epHeadlinePh")} onChange={(e) => setHeadline(e.target.value)} /></label>
        <label className="field"><span>{t("epBio")}</span><textarea className="textarea" value={bio} maxLength={800} onChange={(e) => setBio(e.target.value)} /></label>
        <label className="field"><span>{t("epSkills")}</span><input className="input" value={skills} maxLength={300} placeholder={t("epSkillsPh")} onChange={(e) => setSkills(e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="field"><span>{t("epUsesAi")}</span>
            <select className="select" value={usesAi} onChange={(e) => setUsesAi(e.target.value as "ai" | "manual" | "both")}>
              {(["ai", "manual", "both"] as const).map((k) => <option key={k} value={k}>{t(`uses_${k}` as never)}</option>)}
            </select></label>
          <label className="field"><span>{t("epRate")}</span><input className="input ltr" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.5" /></label>
        </div>
        <label className="plan-task"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /><span>{t("epAvailable")}</span></label>
        <label className="plan-task"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /><span>{t("epVisible")}</span></label>
        <button className="btn primary" style={{ justifySelf: "start" }} disabled={busy}>{busy ? t("preparing") : t("epSave")}</button>
      </form>

      <div className="sec-h"><h2>{t("epServices")}</h2></div>
      <p className="hint">{t("epServicesHint")}</p>
      <AddService onDone={load} full={(m?.services.length ?? 0) >= 6} />
      <div className="grid">
        {m?.services.map((x) => (
          <div key={x.id} className="card" style={{ display: "grid", gap: 4 }}>
            <div className="chips"><span className="chip free num ltr">{Number(x.price)} π</span><span className="chip">{t(`delivery_${x.delivery}` as never)}</span><span className="chip num">{t("svDays", { n: x.days })}</span></div>
            <b>{x.title}</b>
            <button className="btn danger sm" style={{ justifySelf: "start" }} onClick={async () => { await fetch(`/api/services?id=${x.id}`, { method: "DELETE", credentials: "include" }); load(); }}>{t("epRemove")}</button>
          </div>
        ))}
      </div>

      <Invite username={user.username} />

      <div className="sec-h"><h2>{t("epPortfolio")}</h2></div>
      <p className="hint">{t("epPortfolioHint")}</p>
      <AddWork onDone={load} full={(m?.portfolio.length ?? 0) >= 12} />
      <div className="course-grid">
        {m?.portfolio.map((w) => (
          <div key={w.id} className="card work-card">
            {w.has_image && <img className="work-img" src={`/api/profile/img?id=${w.id}`} alt={w.title} loading="lazy" />}
            <b>{w.title}</b>
            <span className={`chip ${w.made_with === "ai" ? "v" : ""}`} style={{ justifySelf: "start" }}>{t(`made_${w.made_with}` as never)}</span>
            {w.description && <p className="small muted">{w.description}</p>}
            <button className="btn danger sm" style={{ justifySelf: "start" }} onClick={async () => { await fetch(`/api/profile/portfolio?id=${w.id}`, { method: "DELETE", credentials: "include" }); load(); }}>{t("epRemove")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddWork({ onDone, full }: { onDone: () => void; full: boolean }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [made, setMade] = useState<"ai" | "manual" | "both">("ai");
  const [tags, setTags] = useState("");
  const [img, setImg] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.append("title", title); fd.append("description", desc); fd.append("made_with", made); fd.append("tags", tags);
    if (img) fd.append("image", await shrink(img));
    const r = await post("/api/profile/portfolio", fd);
    setBusy(false);
    if (r.ok) { toast(t("epWorkAdded")); setTitle(""); setDesc(""); setTags(""); setImg(null); setOpen(false); onDone(); }
    else toast(r.data?.error === "blocked" ? `${t("tkBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` : r.data?.error === "too_many" ? t("epLimit") : ["file_type", "file_too_big"].includes(r.data?.error) ? t("tkFileBad") : t("errGeneric"));
  }
  if (full) return <div className="notice">{t("epLimit")}</div>;
  if (!open) return <button className="btn primary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{t("epAddWork")}</button>;
  return (
    <form className="card" onSubmit={add} style={{ display: "grid", gap: 10, animation: "rise .25s both" }}>
      <label className="field"><span>{t("epWorkTitle")}</span><input className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>{t("epWorkDesc")}</span><textarea className="textarea" value={desc} maxLength={600} onChange={(e) => setDesc(e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field"><span>{t("epWorkMade")}</span>
          <select className="select" value={made} onChange={(e) => setMade(e.target.value as "ai" | "manual" | "both")}>{(["ai", "manual", "both"] as const).map((k) => <option key={k} value={k}>{t(`made_${k}` as never)}</option>)}</select></label>
        <label className="field"><span>{t("epWorkTags")}</span><input className="input" value={tags} maxLength={200} onChange={(e) => setTags(e.target.value)} /></label>
      </div>
      <label className="field"><span>{t("epWorkImg")}</span><input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setImg(e.target.files?.[0] ?? null)} /></label>
      <div className="row-actions">
        <button className="btn primary" disabled={busy || title.trim().length < 3}>{busy ? t("preparing") : t("epWorkAdd")}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>{t("cancel")}</button>
      </div>
    </form>
  );
}

function AddService({ onDone, full }: { onDone: () => void; full: boolean }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [delivery, setDelivery] = useState("file");
  const [price, setPrice] = useState("1");
  const [days, setDays] = useState("3");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/services", { title, description: desc, category, delivery, price: toNum(price), days: toNum(days) });
    setBusy(false);
    if (r.ok) { toast(t("epWorkAdded")); setTitle(""); setDesc(""); setOpen(false); onDone(); }
    else toast(r.data?.error === "blocked" ? `${t("tkBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` : r.data?.error === "too_many" ? t("epLimit") : r.data?.error === "bad_price" ? t("tkBadReward") : t("errGeneric"));
  }
  if (full) return <div className="notice">{t("epLimit")}</div>;
  if (!open) return <button className="btn primary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{t("epAddService")}</button>;
  return (
    <form className="card" onSubmit={add} style={{ display: "grid", gap: 10, animation: "rise .25s both" }}>
      <label className="field"><span>{t("svTitle")}</span><input className="input" value={title} maxLength={100} placeholder={t("svTitlePh")} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>{t("svDesc")}</span><textarea className="textarea" value={desc} maxLength={600} onChange={(e) => setDesc(e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field"><span>{t("tkKind")}</span><input className="input" value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} /></label>
        <label className="field"><span>{t("tkDelivery")}</span>
          <select className="select" value={delivery} onChange={(e) => setDelivery(e.target.value)}>{["text", "pdf", "ppt", "image", "file"].map((d) => <option key={d} value={d}>{t(`delivery_${d}` as never)}</option>)}</select></label>
        <label className="field"><span>{t("svPrice")}</span><input className="input ltr" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="field"><span>{t("svDaysLbl")}</span><input className="input ltr" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></label>
      </div>
      <div className="row-actions">
        <button className="btn primary" disabled={busy || title.trim().length < 3 || category.trim().length < 2}>{busy ? t("preparing") : t("epWorkAdd")}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>{t("cancel")}</button>
      </div>
    </form>
  );
}

/** Invite link: the new user and the inviter both get 3 tasks without the site fee. */
function Invite({ username }: { username: string }) {
  const { t, toast } = useApp();
  const url = typeof location !== "undefined" ? `${location.origin}/?ref=${encodeURIComponent(username)}` : "";
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <b>{t("invTitle")}</b>
      <p className="hint">{t("invHint")}</p>
      <div className="copy-row"><code className="ltr">{url}</code><button className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(url); toast(t("copied")); } catch { toast(t("errGeneric")); } }}>{t("copy")}</button></div>
    </div>
  );
}
