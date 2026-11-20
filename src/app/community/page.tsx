"use client";

import Link from "next/link";
import { RichText } from "@/components/Web";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

type Post = {
  id: number; username: string; group_key?: string; body: string; replies?: number; likes?: number;
  created_at: string; role?: string; mine?: boolean; liked?: boolean;
};
const GROUPS = ["general", "school", "uni", "job", "code", "lang", "pi"] as const;
const ERRS: Record<string, Key> = { looks_like_passphrase: "errPassphrase", post_limit: "errPostLimit", slow_down: "errSlow" };

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

function Badge({ role }: { role?: string }) {
  const { t } = useApp();
  if (role === "admin") return <span className="chip v">{t("adminBadge")}</span>;
  if (role === "teacher") return <span className="chip free">{t("teacherBadge")}</span>;
  return null;
}

export default function CommunityPage() {
  const { t, user, login } = useApp();
  const [group, setGroup] = useState<string>("all");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(false);
  const [body, setBody] = useState("");
  const [postGroup, setPostGroup] = useState<string>("general");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ago = useAgo();

  const load = useCallback(async (before?: number) => {
    const qs = new URLSearchParams({ sort });
    if (group !== "all") qs.set("g", group);
    if (before) qs.set("before", String(before));
    const r = await fetch(`/api/posts?${qs}`, { credentials: "include" });
    const list: Post[] = (await r.json()).posts || [];
    setPosts((cur) => (before && cur ? [...cur, ...list] : list));
    setMore(list.length === 20 && sort === "new");
  }, [group, sort]);

  useEffect(() => { setPosts(null); load(); }, [load, user]);
  useEffect(() => { if (group !== "all") setPostGroup(group); }, [group]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return login();
    setBusy(true); setErr("");
    const r = await post("/api/posts", { body, group: postGroup });
    setBusy(false);
    if (r.ok) {
      setPosts((cur) => [{ id: r.data.id, username: user.username, group_key: postGroup, body: body.trim(), replies: 0, likes: 0,
        created_at: new Date().toISOString(), role: user.role, mine: true }, ...(cur || [])]);
      setBody("");
    } else setErr(r.data?.error === "blocked" ? `${t("modBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` : t(ERRS[r.data?.error] || "errGeneric"));
  }

  return (
    <div className="grid" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="hero-card">
        <div className="hero-ico" aria-hidden="true">💬</div>
        <div>
          <h1>{t("commTitle")} <span className="chip free">{t("free")}</span></h1>
          <p>{t("commSub")}</p>
        </div>
      </div>
      <div className="chips">
        {(["all", ...GROUPS] as string[]).map((g) => (
          <button key={g} className={`pill${group === g ? " on" : ""}`} onClick={() => setGroup(g)}>{t(g === "all" ? "gAll" : (`g_${g}` as Key))}</button>
        ))}
      </div>

      <form className="card" onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <textarea className="textarea" id="compose" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("composePh")} maxLength={2000} style={{ minHeight: 80 }} />
        <p className="hint">{t("commRules")}</p>
        {err && <div className="notice bad">{err}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select className="select" id="post-group" value={postGroup} onChange={(e) => setPostGroup(e.target.value)} style={{ width: "auto" }} aria-label={t("commTitle")}>
            {GROUPS.map((g) => <option key={g} value={g}>{t(`g_${g}` as Key)}</option>)}
          </select>
          <button className="btn primary" disabled={busy || (!!user && body.trim().length < 2)}>{!user ? t("login") : busy ? t("posting") : t("post")}</button>
        </div>
      </form>

      <div className="chips">
        <button className={`pill${sort === "new" ? " on" : ""}`} onClick={() => setSort("new")}>{t("sortNew")}</button>
        <button className={`pill${sort === "top" ? " on" : ""}`} onClick={() => setSort("top")}>{t("sortTop")}</button>
      </div>

      {!posts ? (
        [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 110 }} />)
      ) : posts.length === 0 ? (
        <div className="card empty">{t("noPosts")}</div>
      ) : (
        <div className="grid stagger">
          {posts.map((p) => <PostCard key={p.id} p={p} ago={ago} showGroup={group === "all"} onRemoved={() => setPosts((cur) => (cur || []).filter((x) => x.id !== p.id))} />)}
        </div>
      )}
      {more && <button className="btn" onClick={() => posts && load(posts[posts.length - 1].id)}>{t("more")}</button>}
    </div>
  );
}

function PostCard({ p, ago, showGroup, onRemoved }: { p: Post; ago: (s: string) => string; showGroup: boolean; onRemoved: () => void }) {
  const { t, user, login, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<Post[] | null>(null);
  const [count, setCount] = useState(p.replies || 0);
  const [likes, setLikes] = useState(p.likes || 0);
  const [liked, setLiked] = useState(!!p.liked);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setOpen(!open);
    if (!replies) {
      const r = await fetch(`/api/posts?parent=${p.id}`, { credentials: "include" });
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
      setReplies((cur) => [...(cur || []), { id: r.data.id, username: user.username, body: text.trim(), created_at: new Date().toISOString(), role: user.role, mine: true }]);
      setCount((c) => c + 1); setText("");
    } else toast(r.data?.error === "blocked" ? `${t("modBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` : t(ERRS[r.data?.error] || "errGeneric"));
  }
  async function like() {
    if (!user) return login();
    setLiked(!liked); setLikes((n) => n + (liked ? -1 : 1));
    const r = await post("/api/posts/like", { id: p.id });
    if (r.ok) { setLiked(r.data.liked); setLikes(r.data.likes); }
  }
  async function report() {
    if (!user) return login();
    await post("/api/posts/report", { id: p.id });
    toast(t("reported"));
  }
  async function remove(id: number, isReply: boolean) {
    const r = await post("/api/posts/hide", { id });
    if (!r.ok || !r.data?.ok) return toast(t("errGeneric"));
    toast(t("deleted"));
    if (isReply) { setReplies((cur) => (cur || []).filter((x) => x.id !== id)); setCount((c) => Math.max(0, c - 1)); }
    else onRemoved();
  }

  return (
    <article className="card post">
      <div className="post-h">
        <div className="avatar">{p.username.slice(0, 1)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <b className="ltr">@{p.username}</b><Badge role={p.role} />
          </div>
          <div className="hint">{ago(p.created_at)}{showGroup && p.group_key ? ` · ${t(`g_${p.group_key}` as Key)}` : ""}</div>
        </div>
      </div>
      <RichText className="post-body" text={p.body} />
      <div className="post-actions">
        <button onClick={like} aria-pressed={liked} style={liked ? { color: "var(--primary)", fontWeight: 600 } : undefined}>
          {t("useful")}{likes > 0 ? ` · ${likes}` : ""}
        </button>
        <button onClick={toggle}>{t("replies", { n: count })}</button>
        <Link href={`/chat?q=${encodeURIComponent(p.body.slice(0, 1500))}`} className="small" style={{ flex: 1, textAlign: "center", padding: 6, color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}>
          {t("askAi")}
        </Link>
        {p.mine ? <button onClick={() => remove(p.id, false)}>{t("del")}</button> : <button onClick={report}>{t("report")}</button>}
      </div>
      {open && (
        <div className="replies">
          {replies?.map((r) => (
            <div key={r.id} style={{ animation: "rise .3s both" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <b className="ltr small">@{r.username}</b><Badge role={r.role} /><span className="hint">{ago(r.created_at)}</span>
                {r.mine && <button className="link" style={{ marginInlineStart: "auto", fontSize: 12 }} onClick={() => remove(r.id, true)}>{t("del")}</button>}
              </div>
              <RichText className="post-body small" text={r.body} />
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
