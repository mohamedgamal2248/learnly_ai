"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Markdown } from "@/components/Markdown";
import { IClip, IClose, IDownload, IPlus, ISend, IStop } from "@/components/Icons";
import { botText, loadBots, type BotInfo } from "@/lib/bots";
import { downloadFile, hasFileSpec, rememberSpec, saveFileSpec } from "@/lib/local-files";
import type { Key } from "@/lib/i18n";

type FileRef = { id: string; format: "pdf" | "docx" | "pptx" | "xlsx"; title: string };
type Msg = { role: "user" | "assistant"; content: string; images?: string[]; files?: FileRef[] | null; credits?: number | null; error?: string; code?: string };
type ChatItem = { id: string; title: string; msgs: number; updated_at: string };
type Phase = "idle" | "thinking" | "writing" | "making" | "reading";
type Pending = { key: string; kind: "img"; url: string; name: string } | { key: string; kind: "doc"; name: string; id?: string; busy: boolean };

/** Shrinks a photo to at most 1280px JPEG so it is cheap to send and to analyze. */
async function shrinkImage(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally { URL.revokeObjectURL(src); }
}

/** Stored user messages carry small markers for attachments; show them as chips. */
function UserText({ text, imgLbl }: { text: string; imgLbl: string }) {
  const chips: string[] = [];
  const body = text.replace(/\[📎 (.+?) #[0-9a-f-]{36}\]/gi, (_, n) => { chips.push(`📎 ${n}`); return ""; })
    .replace(/\[🖼\]/g, () => { chips.push(`🖼 ${imgLbl}`); return ""; }).trim();
  return <>{body}{chips.length > 0 && <span className="att-row">{chips.map((c, i) => <span key={i} className="att-chip">{c}</span>)}</span>}</>;
}

const ERR: Record<string, Key> = {
  no_credits: "errNoCredits", daily_limit: "errDaily", paused: "errPaused", slow_down: "errSlow", daily_cap: "errDayCap",
  banned: "errBanned", ai_error: "errAi", login_required: "needLogin",
  file_too_big: "errFileBig", file_type: "errFileType", scanned_pdf: "errScanned", empty_file: "errExtract", extract_failed: "errExtract", att_limit: "errAttLimit",
};
const activeKey = (botId: string) => `ln-active-${botId}`;
const QUICK: Key[] = ["qQuiz", "qSimpler", "qSummary", "qPdf"];

function ChatInner() {
  const { t, lang, user, ready, login, openBuy, setCredits, toast } = useApp();
  const params = useSearchParams();
  const [bot, setBot] = useState<BotInfo | null | undefined>(undefined);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [replyLang, setReplyLang] = useState<"auto" | "ar" | "en">("auto");
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // ---- smooth streaming: incoming text is queued and revealed a little every frame ----
  const queueRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const patchLast = useCallback((fn: (m: Msg) => Msg) => setMsgs((cur) => {
    if (!cur.length) return cur;
    const copy = cur.slice();
    copy[copy.length - 1] = fn(copy[copy.length - 1]);
    return copy;
  }), []);
  const pump = useCallback(() => {
    const q = queueRef.current;
    if (!q) { rafRef.current = null; return; }
    // Reveal faster when a lot is waiting so the text never lags far behind.
    const n = Math.max(2, Math.ceil(q.length / 12));
    const chunk = q.slice(0, n);
    queueRef.current = q.slice(n);
    patchLast((m) => ({ ...m, content: m.content + chunk }));
    rafRef.current = requestAnimationFrame(pump);
  }, [patchLast]);
  const enqueue = useCallback((s: string) => {
    queueRef.current += s;
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(pump);
  }, [pump]);
  const flush = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const rest = queueRef.current;
    queueRef.current = "";
    if (rest) patchLast((m) => ({ ...m, content: m.content + rest }));
  }, [patchLast]);

  // ---- which bot ----
  useEffect(() => {
    const id = params.get("b");
    (async () => {
      try {
        if (id) {
          const live = (await loadBots()).find((b) => b.id === id);
          if (live) return setBot(live);
          const d = await (await fetch(`/api/bots?id=${id}`)).json();
          setBot(d.bot ?? null);
        } else {
          const all = await loadBots();
          setBot(all.find((b) => b.official) || all[0] || null);
        }
      } catch { setBot(null); }
    })();
  }, [params]);

  const bt = bot ? botText(bot, lang) : null;

  useEffect(() => {
    if (!bot) return;
    try { localStorage.setItem("ln-last-bot", JSON.stringify({ id: bot.id })); } catch {}
    let saved: string | null = null;
    try { saved = localStorage.getItem(`ln-rl-${bot.id}`); } catch {}
    setReplyLang(saved === "ar" || saved === "en" || saved === "auto" ? saved : bot.reply_lang || "auto");
  }, [bot]);

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  // Question handed over from another page (community post, academy lesson).
  useEffect(() => {
    const q = params.get("q");
    if (q) { setInput(q.slice(0, 4000)); requestAnimationFrame(() => { autosize(); taRef.current?.focus(); }); }
  }, [params]);

  const chooseLang = (v: "auto" | "ar" | "en") => {
    setReplyLang(v);
    if (bot) { try { localStorage.setItem(`ln-rl-${bot.id}`, v); } catch {} }
  };

  const openChat = useCallback(async (id: string | null) => {
    setChatId(id);
    setShowHistory(false);
    if (bot) { try { id ? localStorage.setItem(activeKey(bot.id), id) : localStorage.removeItem(activeKey(bot.id)); } catch {} }
    if (!id) { setMsgs([]); return; }
    setLoadingChat(true);
    try {
      const r = await fetch(`/api/chats?id=${id}`, { credentials: "include" });
      setMsgs(r.ok ? (await r.json()).messages : []);
    } finally { setLoadingChat(false); }
  }, [bot]);

  // ---- the user's conversations with this bot (stored in the database) ----
  useEffect(() => {
    if (!bot || !user) { setChats([]); setMsgs([]); setChatId(null); return; }
    (async () => {
      const r = await fetch(`/api/chats?bot=${bot.id}`, { credentials: "include" });
      const list: ChatItem[] = r.ok ? (await r.json()).chats : [];
      setChats(list);
      let saved: string | null = null;
      try { saved = localStorage.getItem(activeKey(bot.id)); } catch {}
      openChat(list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? null);
    })();
  }, [bot, user, openChat]);

  // ---- scrolling: follow the reply only while the reader is at the bottom ----
  useEffect(() => {
    const onScroll = () => {
      const near = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
      atBottomRef.current = near;
      setAtBottom(near);
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (atBottomRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, phase]);
  const scrollDown = () => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

  const send = useCallback(async (text: string, opts: { replaceLast?: boolean; withAttachments?: boolean } = {}) => {
    const content = text.trim();
    const att = opts.withAttachments ? pending : [];
    if (att.some((p) => p.kind === "doc" && p.busy)) return;
    const images = att.flatMap((p) => (p.kind === "img" ? [p.url] : []));
    const docs = att.flatMap((p) => (p.kind === "doc" && p.id ? [{ id: p.id, name: p.name }] : []));
    if ((!content && !images.length && !docs.length) || !bot || phase !== "idle") return;
    if (!user) { await login(); return; }
    const shown = [content, ...docs.map((d) => `[📎 ${d.name} #${d.id}]`)].filter(Boolean).join("\n");
    setMsgs((cur) => {
      const base = opts.replaceLast ? cur.slice(0, -2) : cur;
      return [...base, { role: "user", content: shown, images }, { role: "assistant", content: "" }];
    });
    if (opts.withAttachments) setPending([]);
    setInput("");
    requestAnimationFrame(autosize);
    setPhase("thinking");
    atBottomRef.current = true;
    requestAnimationFrame(scrollDown);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST", credentials: "include", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: bot.id, chatId, message: content, replyLang, images, attachments: docs.map((d) => d.id) }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        patchLast((m) => ({ ...m, code: d.error, error: t(ERR[d.error] || "errGeneric", { have: d.credits ?? 0, need: d.need ?? "?" }) }));
        if (d.error === "login_required") login();
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 2);
          if (!line.startsWith("data:")) continue;
          let ev: any;
          try { ev = JSON.parse(line.slice(5)); } catch { continue; }
          if (ev.t === "d") { setPhase("writing"); enqueue(ev.v); }
          else if (ev.t === "think") setPhase("thinking");
          else if (ev.t === "making") setPhase("making");
          else if (ev.t === "reading") setPhase("reading");
          else if (ev.t === "file") {
            rememberSpec(ev.id, ev.spec);
            saveFileSpec(ev.id, ev.spec);
            patchLast((m) => ({ ...m, files: [...(m.files || []), { id: ev.id, format: ev.format, title: ev.title }] }));
          }
          else if (ev.t === "done") {
            flush();
            patchLast((m) => ({ ...m, credits: ev.charged }));
            setCredits(ev.credits);
            if (ev.chatId && ev.chatId !== chatId) {
              setChatId(ev.chatId);
              try { localStorage.setItem(activeKey(bot.id), ev.chatId); } catch {}
              setChats((cur) => [{ id: ev.chatId, title: (content || docs[0]?.name || "🖼").slice(0, 60), msgs: 2, updated_at: new Date().toISOString() }, ...cur.filter((c) => c.id !== ev.chatId)]);
            }
          }
          else if (ev.t === "err") { flush(); patchLast((m) => ({ ...m, error: t(ERR[ev.v] || "errGeneric") })); }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") patchLast((m) => ({ ...m, error: t("errGeneric") }));
    } finally {
      flush();
      abortRef.current = null;
      setPhase("idle");
    }
  }, [bot, phase, user, login, chatId, t, setCredits, replyLang, enqueue, flush, patchLast, pending]);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    if (!user) { await login(); return; }
    const counts = { img: 0, doc: 0 };
    pending.forEach((p) => counts[p.kind]++);
    for (const f of Array.from(list)) {
      const isImg = f.type.startsWith("image/");
      if ((isImg && counts.img >= 2) || (!isImg && counts.doc >= 3)) { toast(t("maxAtt")); continue; }
      counts[isImg ? "img" : "doc"]++;
      const key = `${Date.now()}-${Math.random()}`;
      if (isImg) {
        try { const url = await shrinkImage(f); setPending((cur) => [...cur, { key, kind: "img", url, name: f.name }]); }
        catch { toast(t("errFileType")); }
        continue;
      }
      if (f.size > 4 * 1024 * 1024) { toast(t("errFileBig")); continue; }
      setPending((cur) => [...cur, { key, kind: "doc", name: f.name, busy: true }]);
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await fetch("/api/attach", { method: "POST", body: fd, credentials: "include" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "extract_failed");
        setPending((cur) => cur.map((p) => (p.key === key ? { ...p, id: d.id, busy: false } : p)));
      } catch (e: any) {
        setPending((cur) => cur.filter((p) => p.key !== key));
        toast(t(ERR[e.message] || "errExtract"));
      }
    }
  }

  async function download(id: string) {
    setDlBusy(id);
    const r = await downloadFile(id);
    setDlBusy(null);
    if (r === "missing") toast(t("fileElsewhere"));
    else if (r === "error") toast(t("dlError"));
  }

  async function copyText(i: number, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1500); }
    catch { toast(t("errGeneric")); }
  }

  if (bot === undefined || !ready) return <div className="skeleton" style={{ height: 120 }} />;
  if (bot === null || !bt) return <div className="card empty">{t("botMissing")}</div>;

  const last = msgs[msgs.length - 1];
  const lastUserIdx = msgs.map((m) => m.role).lastIndexOf("user");
  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  const suggestions: Key[] = ["s1", "s2", "s3", "s4", "s5"];
  const idle = phase === "idle";

  return (
    <div className="chat-wrap">
      <div className="card chat-head">
        <div className="avatar">{bt.name.slice(0, 1)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bot-name">{bt.name}{bot.official ? <span className="chip v">{t("official")}</span> : <span className="chip v">{t("verified")}</span>}</div>
          <div className="bot-sub">{bt.subject}{bot.teacher_name && !bot.official ? ` · ${bot.teacher_name}` : ""}</div>
          {bot.status && bot.status !== "live" && <span className="chip warn" style={{ marginTop: 4 }}>{t("testing")}</span>}
        </div>
        {user && chats.length > 0 && (
          <button className="btn sm" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>{t("history")} <span className="num">{fmt(chats.length)}</span></button>
        )}
        <button className="icon-btn" onClick={() => openChat(null)} aria-label={t("newChat")} title={t("newChat")} disabled={!idle}><IPlus width={18} height={18} /></button>
      </div>

      <div className="chips" style={{ marginTop: 8, alignItems: "center" }} role="radiogroup" aria-label={t("replyLang")}>
        <span className="hint" style={{ whiteSpace: "nowrap" }}>{t("replyLang")}:</span>
        {(["auto", "ar", "en"] as const).map((v) => (
          <button key={v} role="radio" aria-checked={replyLang === v} className={`pill${replyLang === v ? " on" : ""}`}
            style={{ padding: "4px 12px", fontSize: 13 }} onClick={() => chooseLang(v)} title={t("rlHint")}>
            {t(v === "auto" ? "rlAuto" : v === "ar" ? "rlAr" : "rlEn")}
          </button>
        ))}
      </div>

      {showHistory && (
        <div className="card" style={{ marginTop: 8, display: "grid", gap: 4, animation: "rise .25s both" }}>
          {chats.map((c) => (
            <button key={c.id} className={`nav-item${c.id === chatId ? " on" : ""}`} onClick={() => openChat(c.id)} disabled={!idle}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.title || "…"}</span>
              <span className="hint num">{new Date(c.updated_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
            </button>
          ))}
        </div>
      )}

      <div className="chat-list" aria-live="polite">
        {loadingChat && <div className="skeleton" style={{ height: 80 }} />}
        {!loadingChat && !msgs.length && (
          <div className="card" style={{ animation: "rise .35s both" }}>
            <p>{bt.description || t("tagline")}</p>
            {bot.fee > 0 && <p className="hint" style={{ marginTop: 6 }}>{t("perMsg", { n: bot.fee })}</p>}
            <div className="suggest">
              {suggestions.map((k) => <button key={k} onClick={() => send(t(k))}>{t(k)}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="msg-wrap me">
                <div className="msg me">
                  {m.images?.length ? <span className="att-imgs">{m.images.map((u, k) => <img key={k} src={u} alt="" />)}</span> : null}
                  <UserText text={m.content} imgLbl={t("imageLbl")} />
                </div>
                {i === lastUserIdx && idle && (
                  <div className="msg-actions">
                    <button onClick={() => { setInput(m.content); requestAnimationFrame(() => { autosize(); taRef.current?.focus(); }); }}>{t("edit")}</button>
                  </div>
                )}
              </div>
            );
          }
          const streaming = i === msgs.length - 1 && !idle;
          const isLast = i === msgs.length - 1;
          return (
            <div key={i} className="msg-wrap bot">
              <div className="msg bot">
                {m.content ? <div className={`md${streaming && phase === "writing" ? " caret" : ""}`}><Markdown text={m.content} /></div> : null}
                {streaming && phase !== "writing" && (
                  <span className="thinking"><span className="dots"><i /><i /><i /></span>{phase === "making" ? t("making") : phase === "reading" ? t("reading") : t("thinking")}…</span>
                )}
                {m.files?.map((f) => {
                  const here = hasFileSpec(f.id);
                  return (
                    <div key={f.id} className="file-card">
                      <span className={`file-ico ${f.format}`}>{f.format.toUpperCase()}</span>
                      <span className="ft"><b>{f.title}</b><span className="hint">{here ? t("savedLocal") : t("fileElsewhere")}</span></span>
                      <button className="btn primary sm" disabled={!here || dlBusy === f.id} onClick={() => download(f.id)}>
                        <IDownload width={16} height={16} />{dlBusy === f.id ? t("preparing") : t("download")}
                      </button>
                    </div>
                  );
                })}
                {m.error && (
                  <div className="notice warn" style={{ marginTop: m.content ? 8 : 0 }}>
                    {m.error}
                    {["no_credits", "daily_limit", "paused"].includes(m.code || "") && <button className="btn primary sm" style={{ marginInlineStart: 8 }} onClick={openBuy}>{t("buyTitle")}</button>}
                  </div>
                )}
              </div>
              {!streaming && (m.content || m.error) && (
                <div className="msg-actions">
                  {m.content && <button onClick={() => copyText(i, m.content)}>{copied === i ? t("copied") : t("copy")}</button>}
                  {isLast && idle && lastUserIdx >= 0 && <button onClick={() => send(msgs[lastUserIdx].content.replace(/\[🖼\]/g, "").trim() || t("qSimpler"), { replaceLast: true })}>{t("regen")}</button>}
                  {typeof m.credits === "number" && <span className="num">{t("charged", { n: fmt(m.credits) })}</span>}
                </div>
              )}
              {isLast && idle && m.content && !m.error && (
                <div className="suggest" style={{ marginTop: 6 }}>
                  {QUICK.map((k) => <button key={k} onClick={() => send(t(k))}>{t(k)}</button>)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {!atBottom && msgs.length > 0 && (
        <button className="scroll-down" onClick={scrollDown} aria-label={t("scrollDown")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </button>
      )}

      <div className="composer">
        {pending.length > 0 && (
          <div className="pending-row">
            {pending.map((p) => (
              <span key={p.key} className={`pend${p.kind === "doc" && p.busy ? " busy" : ""}`}>
                {p.kind === "img" ? <img src={p.url} alt="" /> : <span className="pend-ico">{(p.name.split(".").pop() || "").toUpperCase().slice(0, 4)}</span>}
                <span className="pend-name">{p.kind === "doc" && p.busy ? t("uploading") : p.name}</span>
                <button type="button" aria-label={t("close")} onClick={() => setPending((cur) => cur.filter((x) => x.key !== p.key))}><IClose width={12} height={12} /></button>
              </span>
            ))}
          </div>
        )}
        <form className="composer-in" onSubmit={(e) => { e.preventDefault(); send(input, { withAttachments: true }); }}>
          <input ref={fileRef} type="file" hidden multiple accept="image/*,.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button type="button" className="attach-btn" onClick={() => fileRef.current?.click()} aria-label={t("attach")} title={t("attachHint")} disabled={!idle}>
            <IClip width={20} height={20} />
          </button>
          <textarea
            ref={taRef} rows={1} value={input} placeholder={user ? t("chatPh") : t("needLogin")} aria-label={t("chatPh")}
            maxLength={4000}
            onChange={(e) => { setInput(e.target.value); autosize(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); send(input, { withAttachments: true }); } }}
          />
          {!idle ? (
            <button type="button" className="send" onClick={() => abortRef.current?.abort()} aria-label={t("stop")}><IStop width={16} height={16} /></button>
          ) : (
            <button type="submit" className="send" disabled={(!input.trim() && !pending.some((p) => p.kind === "img" || p.id)) || pending.some((p) => p.kind === "doc" && p.busy) || last?.role === "user"} aria-label="Send">
              <ISend width={18} height={18} style={{ transform: lang === "ar" ? "scaleX(-1)" : undefined }} />
            </button>
          )}
        </form>
        <p className="hint" style={{ textAlign: "center", marginTop: 6 }}>{t("costNote")}</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<div className="skeleton" style={{ height: 120 }} />}><ChatInner /></Suspense>;
}
