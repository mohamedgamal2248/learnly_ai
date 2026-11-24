"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Portal } from "@/components/Portal";
import { ICap, ICheck, IGlobe, IBolt } from "@/components/Icons";

type AppStatus = { status: "pending" | "approved" | "rejected"; reason: string | null } | null;

export default function Teachers() {
  const { user, login, loggingIn, tt } = useApp();
  const [app, setApp] = useState<AppStatus | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => user && fetch("/api/en/teacher", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d) => setApp(d.app || null)).catch(() => setApp(null));
  useEffect(() => { if (user) load(); else setApp(undefined); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await fetch("/api/teach/apply", { method: "POST", credentials: "include", body: new FormData(e.currentTarget) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setOpen(false); load(); }
    else setMsg(d.error === "already_pending" ? tt("You already have an application under review.") : d.error === "file_too_big" ? tt("The file is bigger than 2 MB.") : d.error === "file_type" ? tt("Upload a PDF, JPG, PNG or WebP.") : d.error === "doc_required" ? tt("Please attach a certificate or ID of your teaching experience.") : d.error === "missing_fields" ? tt("Fill in your name, subjects and a longer bio (20+ characters).") : tt("Could not send. Try again."));
  }

  return (
    <div className="stack">
      <section className="lc hl" style={{ display: "grid", gap: 10 }}>
        <div className="row"><span className="chip warn">{tt("Coming soon")}</span></div>
        <h1 style={{ fontSize: 24 }}>{tt("Live classes with English teachers")}</h1>
        <p className="muted">{tt("Book one-to-one lessons with a verified teacher who speaks your language, and pay with Pi. We are reviewing teachers now. Booking opens soon.")}</p>
        <button className="btn lg" disabled>{tt("Book a class (soon)")}</button>
      </section>

      <section className="stack">
        {[
          [<IGlobe key="a" width={22} height={22} />, "Teachers who speak your language", "Arabic, Indonesian, Vietnamese and Korean explanations."],
          [<ICheck key="b" width={22} height={22} />, "Every teacher is reviewed", "We check certificates and experience before anyone can teach."],
          [<IBolt key="c" width={22} height={22} />, "Pay with Pi", "Pay per class from your Pi wallet. No cards."],
        ].map(([ic, t, s], i) => <div key={i} className="lc tap"><div className="ic-sq soft">{ic as React.ReactNode}</div><div className="grow"><b>{tt(t as string)}</b><div className="muted small">{tt(s as string)}</div></div></div>)}
      </section>

      <section className="lc warm" style={{ display: "grid", gap: 10 }}>
        <div className="row"><div className="ic-sq warm"><ICap width={24} height={24} /></div><div className="grow"><b className="big" style={{ fontSize: 19 }}>{tt("Are you an English teacher?")}</b><div className="small" style={{ color: "#8A5A00" }}>{tt("Applications are open. We review your papers and open classes for approved teachers first.")}</div></div></div>
        {!user ? <button className="btn primary" onClick={login} disabled={loggingIn}>{loggingIn ? tt("Signing in…") : tt("Sign in with Pi to apply")}</button>
          : app === undefined ? <div className="skeleton" style={{ height: 44 }} />
          : app?.status === "pending" ? <div className="note">{tt("Your application is under review. We will update this page.")}</div>
          : app?.status === "approved" ? <div className="note ok">{tt("You are approved. We will contact you here when classes open.")}</div>
          : <>
              {app?.status === "rejected" && <div className="note bad">{tt("Your last application was not approved")}{app.reason ? `: ${app.reason}` : ""}. {tt("You can apply again.")}</div>}
              <button className="btn primary" onClick={() => setOpen(true)}>{tt("Apply to teach")}</button>
            </>}
      </section>

      {open && (
        <Portal>
        <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <form className="modal" onSubmit={submit} style={{ maxHeight: "92dvh", overflow: "auto" }}>
            <h2 style={{ fontSize: 19 }}>{tt("Apply to teach")}</h2>
            <label className="field"><span>{tt("Your name")}</span><input className="input" name="name" required maxLength={80} /></label>
            <label className="field"><span>{tt("Languages you teach in (and levels)")}</span><input className="input" name="subjects" required maxLength={300} placeholder={tt("English for Arabic speakers, A1–B2")} /></label>
            <label className="field"><span>{tt("Years of experience")}</span><input className="input" name="years" type="number" min={0} max={60} defaultValue={1} /></label>
            <label className="field"><span>{tt("About you")}</span><textarea className="textarea" name="bio" required minLength={20} maxLength={1500} placeholder={tt("Your background, how you teach, who you teach.")} /></label>
            <label className="field"><span>{tt("Proof: teaching certificate, degree or ID (PDF/JPG/PNG, max 2 MB)")}</span><input className="input" name="doc" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
            <p className="hint">{tt("Only our review team can open your file. It is wiped 30 days after we decide.")}</p>
            {msg && <div className="note bad">{msg}</div>}
            <button className="btn primary lg" disabled={busy}>{busy ? tt("Sending…") : tt("Send application")}</button>
          </form>
        </div>
        </Portal>
      )}
    </div>
  );
}
