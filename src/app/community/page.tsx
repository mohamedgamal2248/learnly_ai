"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

type Post = { id: number; username: string; group_key?: string; body: string; replies?: number; created_at: string };
const GROUPS = ["general", "school", "uni", "job", "code", "lang", "pi"] as const;

function useAgo() {
  const { t } = useApp();
  return (iso: string) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return t("now");
    if (s < 3600) return t("mins", { n: Math.floor(s / 60) });
    if (s < 86400) return t("hours", { n: Math.floor(s / 3600) });
    return t("days", { n: Math.floor(s / 86400) });
  };
}

const ERRS: Record<string, Key> = { looks_like_passphrase: "errPassphrase", post_limit: "errPostLimit", slow_down: "errSlow" };

export default function CommunityPage() {
  const { t, user, login } = useApp();
  const [group, setGroup] = useState<string>("general");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ago = useAgo();

  const load = useCallback(async (before?: number) => {
    const r = await fetch(`/api/posts?g=${group}${before ? `&before=${before}` : ""}`);
    const d = await r.json();
    const list: Post[] = d.posts || [];
    setPosts((cur) => (before && cur ? [...cur, ...list] : list));
    setMore(list.length === 20);
  }, [group]);

  useEffect(() => { setPosts(null); load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return login();
    setBusy(true); setErr("");
    const r = await post("/api/posts", { body, group });
    setBusy(false);
    if (r.ok) {
      setPosts((cur) => [{ id: r.data.id, username: user.username, body: body.trim(), replies: 0, created_at: new Date().toISOString() }, ...(cur || [])]);
      setBody("");
    } else setErr(t(ERRS[r.data?.error] || "errGeneric"));
  }

  return (
    <div className="grid" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="card">
        <h1 style={{ fontSize: 20 }}>{t("commTitle")} <span className="chip free">{t("free")}</span></h1>
        <p className="muted small">{t("commSub")}</p>
      </div>
      <div className="chips">
        {GROUPS.map((g) => <button key={g} className={`pill${group === g ? " on" : ""}`} onClick={() => setGroup(g)}>{t(`g_${g}` as Key)}</button>)}
      </div>
      <form className="card" onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <textarea className="textarea" id="compose" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("composePh")} maxLength={2000} style={{ minHeight: 80 }} />
        {err && <div className="notice bad">{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn primary" disabled={busy || (!!user && body.trim().length < 2)}>{!user ? t("login") : busy ? t("posting") : t("post")}</button>
        </div>
      </form>
      {!posts ? (
        [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 110 }} />)
      ) : posts.length === 0 ? (
        <div className="card empty">{t("noPosts")}</div>
      ) : (
        <div className="grid stagger">
          {posts.map((p) => <PostCard key={p.id} p={p} ago={ago} />)}
        </div>
      )}
      {more && <button className="btn" onClick={() => posts && load(posts[posts.length - 1].id)}>{t("more")}</button>}
    </div>
  );
}

function PostCard({ p, ago }: { p: Post; ago: (s: string) => string }) {
  const { t, user, login, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<Post[] | null>(null);
  const [count, setCount] = useState(p.replies || 0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setOpen(!open);
    if (!replies) {
      const r = await fetch(`/api/posts?parent=${p.id}`);
      setReplies((await r.json()).posts || []);
    }
  }
  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return login();
    setBusy(true);
    const r = await post("/api/posts", { body: text, parent: p.id });
    setBusy(false);
    if (r.ok) {
      setReplies((cur) => [...(cur || []), { id: r.data.id, username: user.username, body: text.trim(), created_at: new Date().toISOString() }]);
      setCount((c) => c + 1); setText("");
    } else toast(t(ERRS[r.data?.error] || "errGeneric"));
  }
  async function report() {
    if (!user) return login();
    await post("/api/posts/report", { id: p.id });
    toast(t("reported"));
  }

  return (
    <article className="card post">
      <div className="post-h">
        <div className="avatar">{p.username.slice(0, 1)}</div>
        <div><b className="ltr">@{p.username}</b><div className="hint">{ago(p.created_at)}</div></div>
      </div>
      <p className="post-body">{p.body}</p>
      <div className="post-actions">
        <button onClick={toggle}>{t("replies", { n: count })}</button>
        <button onClick={report}>{t("report")}</button>
      </div>
      {open && (
        <div className="replies">
          {replies?.map((r) => (
            <div key={r.id} style={{ animation: "rise .3s both" }}>
              <b className="ltr small">@{r.username}</b> <span className="hint">{ago(r.created_at)}</span>
              <p className="post-body small">{r.body}</p>
            </div>
          ))}
          <form onSubmit={reply} style={{ display: "flex", gap: 8 }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("replyPh")} maxLength={2000} aria-label={t("replyPh")} />
            <button className="btn primary sm" disabled={busy || (!!user && text.trim().length < 2)}>{t("reply")}</button>
          </form>
        </div>
      )}
    </article>
  );
}
