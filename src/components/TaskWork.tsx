"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

type Detail = {
  id: string; category: string; delivery: string; title: string; brief: string; input_text: string; lang: string; reward: number; net_reward: number;
  status: string; role: string; reject_note: string | null; claimed_at: string | null;
};
const pi = (n: number | string) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;

/**
 * Turns the simple text format into a document spec.
 * "# title" starts a section (PDF) or slide (PowerPoint), "- item" is a bullet, other lines are paragraphs.
 */
function toSpec(kind: string, title: string, lang: string, raw: string) {
  const blocks: { h: string; bullets: string[]; paras: string[] }[] = [];
  for (const line of raw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (/^#+\s+/.test(line)) blocks.push({ h: line.replace(/^#+\s+/, ""), bullets: [], paras: [] });
    else {
      if (!blocks.length) blocks.push({ h: "", bullets: [], paras: [] });
      const b = blocks[blocks.length - 1];
      if (/^[-*•]\s+/.test(line)) b.bullets.push(line.replace(/^[-*•]\s+/, ""));
      else if (kind === "ppt") b.bullets.push(line);
      else b.paras.push(line);
    }
  }
  const docTitle = blocks.find((b) => b.h)?.h || title;
  return kind === "ppt"
    ? { format: "pptx", title: docTitle, lang, slides: blocks.map((b) => ({ title: b.h || docTitle, bullets: b.bullets.slice(0, 6) })) }
    : { format: "pdf", title: docTitle, lang, sections: blocks.map((b) => ({ heading: b.h || undefined, paragraphs: b.paras, bullets: b.bullets })) };
}

/** Everything a person needs to take a task from the website: read it, claim it, deliver it. */
export function TaskWork({ id, brief, onChange }: { id: string; brief?: string; onChange?: () => void }) {
  const { t, toast, user, login } = useApp();
  const [d, setD] = useState<Detail | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!user) { setD(null); return; }
    const r = await fetch(`/api/tasks?id=${id}`, { credentials: "include", cache: "no-store" });
    setD(r.ok ? (await r.json()).task : null);
  }, [id, user]);
  useEffect(() => { load(); }, [load]);

  if (!user) return (
    <div className="grid" style={{ gap: 8 }}>
      {brief && <p className="small post-body">{brief}</p>}
      <button className="btn primary sm" style={{ justifySelf: "start" }} onClick={login}>{t("tkLoginToClaim")}</button>
    </div>
  );
  if (d === undefined) return <div className="skeleton" style={{ height: 60 }} />;
  if (!d) return <p className="hint">{t("tkNotAvail")}</p>;

  async function claim() {
    setBusy(true);
    const r = await post("/api/tasks/claim", { id });
    setBusy(false);
    if (r.ok) { toast(t("tkClaimed")); await load(); onChange?.(); }
    else toast(t(r.data?.reason === "too_many_claims" ? "tkTooManyClaims" : "tkNotAvail"));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    setBusy(true);
    const isDoc = d.delivery === "pdf" || d.delivery === "ppt";
    const r = await post("/api/tasks/submit", isDoc ? { id, text: "", file: toSpec(d.delivery, d.title, d.lang, text) } : { id, text });
    setBusy(false);
    if (r.ok) { toast(t("tkSubmitted")); setText(""); await load(); onChange?.(); }
    else toast(r.data?.error === "need_text" ? t("tkNeedText") : r.data?.error === "need_file" ? t("tkNeedDoc") : t("errGeneric"));
  }

  const isDoc = d.delivery === "pdf" || d.delivery === "ppt";
  return (
    <div className="grid" style={{ gap: 10, animation: "rise .2s both" }}>
      {d.brief && <p className="small post-body">{d.brief}</p>}
      {d.input_text && (
        <div>
          <span className="hint">{t("tkInputLabel")}</span>
          <div className="task-input">{d.input_text}</div>
        </div>
      )}
      {d.reject_note && <div className="notice warn">{t("tkRejectedBefore")}: {d.reject_note}</div>}
      <span className="chip num ltr" style={{ justifySelf: "start" }}>{t("tkYouGet")} {pi(d.net_reward)}</span>

      {d.status === "open" && d.role === "viewer" && <button className="btn primary" style={{ justifySelf: "start" }} disabled={busy} onClick={claim}>{t("tkClaim")}</button>}
      {d.status === "claimed" && d.role === "worker" && (
        <form onSubmit={submit} className="grid" style={{ gap: 8 }}>
          <span className="hint">{t("tkClaimedHint")}</span>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 160 }} maxLength={20000} placeholder={t(isDoc ? "tkDocPh" : "tkTextPh")} />
          {isDoc && <span className="hint">{t("tkDocFormat")}</span>}
          <button className="btn primary" style={{ justifySelf: "start" }} disabled={busy || text.trim().length < (isDoc ? 5 : 20)}>{busy ? t("preparing") : t("tkSubmit")}</button>
        </form>
      )}
      {d.status === "submitted" && d.role === "worker" && <div className="notice">{t("tkSubmittedWait")}</div>}
      {d.status === "approved" && d.role === "worker" && <div className="notice">{t(("tkS_approved") as Key)}</div>}
    </div>
  );
}
