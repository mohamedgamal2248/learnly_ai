"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Markdown } from "@/components/Markdown";
import { IDownload, IPlus, ISend, IStop } from "@/components/Icons";
import { botText, loadBots, type BotInfo } from "@/lib/bots";
import { downloadFile, hasFileSpec, rememberSpec, saveFileSpec } from "@/lib/local-files";
import type { Key } from "@/lib/i18n";

type FileRef = { id: string; format: "pdf" | "docx" | "pptx" | "xlsx"; title: string };
type Msg = { role: "user" | "assistant"; content: string; files?: FileRef[] | null; credits?: number | null; error?: string; code?: string };
type ChatItem = { id: string; title: string; msgs: number; updated_at: string };
type Phase = "idle" | "thinking" | "writing" | "making";

const ERR: Record<string, Key> = {
  no_credits: "errNoCredits", daily_limit: "errDaily", paused: "errPaused", slow_down: "errSlow",
  banned: "errBanned", ai_error: "errAi", login_required: "needLogin",
};
const activeKey = (botId: string) => `ln-active-${botId}`;

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
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
    try { localStorage.setItem("ln-last-bot", JSON.stringify({ id: bot.id, name: botText(bot, lang).name })); } catch {}
  }, [bot, lang]);

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
      const pick = list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? null;
      openChat(pick);
    })();
  }, [bot, user, openChat]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, phase]);

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || !bot || phase !== "idle") return;
    if (!user) { await login(); return; }
    setMsgs((cur) => [...cur, { role: "user", content }, { role: "assistant", content: "" }]);
    setInput("");
    requestAnimationFrame(autosize);
    setPhase("thinking");

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (fn: (m: Msg) => Msg) => setMsgs((cur) => {
      const copy = cur.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST", credentials: "include", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: bot.id, chatId, message: content }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        patch((m) => ({ ...m, code: d.error, error: t(ERR[d.error] || "errGeneric", { have: d.credits ?? 0, need: d.need ?? "?" }) }));
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
          if (ev.t === "d") { setPhase("writing"); patch((m) => ({ ...m, content: m.content + ev.v })); }
          else if (ev.t === "think") setPhase("thinking");
          else if (ev.t === "making") setPhase("making");
          else if (ev.t === "file") {
            rememberSpec(ev.id, ev.spec);
            saveFileSpec(ev.id, ev.spec);
            patch((m) => ({ ...m, files: [...(m.files || []), { id: ev.id, format: ev.format, title: ev.title }] }));
            setPhase("writing");
          }
          else if (ev.t === "done") {
            patch((m) => ({ ...m, credits: ev.charged }));
            setCredits(ev.credits);
            if (ev.chatId && ev.chatId !== chatId) {
              setChatId(ev.chatId);
              try { localStorage.setItem(activeKey(bot.id), ev.chatId); } catch {}
              setChats((cur) => [{ id: ev.chatId, title: content.slice(0, 60), msgs: 2, updated_at: new Date().toISOString() }, ...cur.filter((c) => c.id !== ev.chatId)]);
            }
          }
          else if (ev.t === "err") patch((m) => ({ ...m, error: t(ERR[ev.v] || "errGeneric") }));
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") patch((m) => ({ ...m, error: t("errGeneric") }));
    } finally {
      abortRef.current = null;
      setPhase("idle");
    }
  }, [bot, phase, user, login, chatId, t, setCredits]);

  if (bot === undefined || !ready) return <div className="skeleton" style={{ height: 120 }} />;
  if (bot === null || !bt) return <div className="card empty">{t("botMissing")}</div>;

  const last = msgs[msgs.length - 1];
  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  const suggestions: Key[] = ["s1", "s2", "s3", "s4", "s5"];

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
        <button className="icon-btn" onClick={() => openChat(null)} aria-label={t("newChat")} title={t("newChat")} disabled={phase !== "idle"}><IPlus width={18} height={18} /></button>
      </div>

      {showHistory && (
        <div className="card" style={{ marginTop: 8, display: "grid", gap: 4, animation: "rise .25s both" }}>
          {chats.map((c) => (
            <button key={c.id} className={`nav-item${c.id === chatId ? " on" : ""}`} onClick={() => openChat(c.id)} disabled={phase !== "idle"}>
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
          if (m.role === "user") return <div key={i} className="msg me">{m.content}</div>;
          const streaming = i === msgs.length - 1 && phase !== "idle";
          return (
            <div key={i} className="msg bot">
              {m.content ? <div className={streaming && phase === "writing" ? "caret" : ""}><Markdown text={m.content} /></div> : null}
              {streaming && phase !== "writing" && (
                <span className="thinking"><span className="dots"><i /><i /><i /></span>{phase === "making" ? t("making") : t("thinking")}…</span>
              )}
              {m.files?.map((f) => {
                const here = hasFileSpec(f.id);
                return (
                  <div key={f.id} className="file-card">
                    <span className={`file-ico ${f.format}`}>{f.format.toUpperCase()}</span>
                    <span className="ft"><b>{f.title}</b><span className="hint">{here ? t("savedLocal") : t("fileElsewhere")}</span></span>
                    <button className="btn primary sm" disabled={!here} onClick={() => { if (!downloadFile(f.id)) toast(t("fileElsewhere")); }}>
                      <IDownload width={16} height={16} />{t("download")}
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
              {typeof m.credits === "number" && !streaming && (
                <div className="msg-foot"><span className="num">{t("charged", { n: fmt(m.credits) })}</span></div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <form className="composer-in" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea
            ref={taRef} rows={1} value={input} placeholder={user ? t("chatPh") : t("needLogin")} aria-label={t("chatPh")}
            maxLength={4000}
            onChange={(e) => { setInput(e.target.value); autosize(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); send(input); } }}
          />
          {phase !== "idle" ? (
            <button type="button" className="send" onClick={() => abortRef.current?.abort()} aria-label={t("stop")}><IStop width={16} height={16} /></button>
          ) : (
            <button type="submit" className="send" disabled={!input.trim() || last?.role === "user"} aria-label="Send">
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
