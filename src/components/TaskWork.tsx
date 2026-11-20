"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { post } from "@/lib/pi-client";
import { FilePicker, TaskFiles, type TaskFile } from "./TaskFiles";
import type { Key } from "@/lib/i18n";

type Detail = {
  id: string; category: string; delivery: string; title: string; brief: string; input_text: string; lang: string; reward: number; net_reward: number;
  status: string; role: string; reject_note: string | null; claimed_at: string | null;
  revision_note: string | null; revisions: number; files: TaskFile[];
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
  const [picked, setPicked] = useState<File[]>([]);
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
    else {
      const why = r.data?.reason;
      toast(why === "too_many_claims" ? t("tkTooManyClaims") : why === "low_rating" ? t("tkLowRating") : why === "new_worker_limit" ? t("tkNewWorkerLimit", { max: pi(r.data.max ?? 1), need: r.data.need ?? 1 }) : t("tkNotAvail"));
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    setBusy(true);
    const isDoc = d.delivery === "pdf" || d.delivery === "ppt";
    const spec = isDoc && text.trim() && !picked.length ? toSpec(d.delivery, d.title, d.lang, text) : null;
    let body: FormData | Record<string, unknown>;
    if (picked.length) {
      const fd = new FormData();
      fd.append("id", id); fd.append("text", isDoc ? "" : text);
      if (spec) fd.append("file", JSON.stringify(spec));
      picked.forEach((f) => fd.append("files", f));
      body = fd;
    } else body = isDoc ? { id, text: "", file: spec } : { id, text };
    const r = await post("/api/tasks/submit", body);
    setBusy(false);
    if (r.ok) { toast(t("tkSubmitted")); setText(""); setPicked([]); await load(); onChange?.(); }
    else {
      const e = r.data?.error;
      toast(e === "need_text" ? t("tkNeedText") : e === "need_file" ? t("tkNeedDoc") : e === "need_attachment" ? t("tkNeedFile") : ["file_type", "file_too_big", "too_many_files", "empty_file"].includes(e) ? t("tkFileBad") : t("errGeneric"));
    }
  }

  const isDoc = d.delivery === "pdf" || d.delivery === "ppt";
  const needsFile = d.delivery === "image" || d.delivery === "file";
  const canSend = needsFile ? picked.length > 0 : isDoc ? picked.length > 0 || text.trim().length >= 5 : picked.length > 0 || text.trim().length >= 20;
  return (
    <div className="grid" style={{ gap: 10, animation: "rise .2s both" }}>
      {d.brief && <p className="small post-body">{d.brief}</p>}
      {d.input_text && (
        <div>
          <span className="hint">{t("tkInputLabel")}</span>
          <div className="task-input">{d.input_text}</div>
        </div>
      )}
      <TaskFiles files={d.files.filter((f) => f.role === "input")} label={t("tkFiles")} />
      {d.reject_note && <div className="notice warn">{t("tkRejectedBefore")}: {d.reject_note}</div>}
      {d.status === "claimed" && d.role === "worker" && d.revision_note && <div className="notice warn">{t("tkRevisionAsked", { n: d.revisions })}: {d.revision_note}</div>}
      <span className="chip num ltr" style={{ justifySelf: "start" }}>{t("tkYouGet")} {pi(d.net_reward)}</span>

      {d.status === "open" && d.role === "viewer" && <button className="btn primary" style={{ justifySelf: "start" }} disabled={busy} onClick={claim}>{t("tkClaim")}</button>}
      {d.status === "claimed" && d.role === "worker" && (
        <form onSubmit={submit} className="grid" style={{ gap: 8 }}>
          <span className="hint">{t("tkClaimedHint")}</span>
          {!needsFile && <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 160 }} maxLength={20000} placeholder={t(isDoc ? "tkDocPh" : "tkTextPh")} />}
          {isDoc && !picked.length && <span className="hint">{t("tkDocFormat")}</span>}
          <FilePicker files={picked} onChange={setPicked} label={t(needsFile || isDoc ? "tkDeliverFiles" : "tkDeliverExtra")} />
          <button className="btn primary" style={{ justifySelf: "start" }} disabled={busy || !canSend}>{busy ? t("preparing") : t("tkSubmit")}</button>
        </form>
      )}
      {d.status === "submitted" && d.role === "worker" && <><div className="notice">{t("tkSubmittedWait")}</div><TaskFiles files={d.files.filter((f) => f.role === "result")} /></>}
      {d.status === "approved" && d.role === "worker" && <div className="notice">{t(("tkS_approved") as Key)}</div>}
    </div>
  );
}
