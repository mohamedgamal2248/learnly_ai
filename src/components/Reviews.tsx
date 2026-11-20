"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { post } from "@/lib/pi-client";

export type Rating = { avg: number; n: number };
let ratingsPromise: Promise<Record<string, Rating>> | null = null;
/** All ratings, fetched once per page load (edge-cached). */
export function loadRatings() {
  if (!ratingsPromise) ratingsPromise = fetch("/api/ratings").then((r) => r.json()).catch(() => ({}));
  return ratingsPromise;
}
export function useRatings() {
  const [r, setR] = useState<Record<string, Rating>>({});
  useEffect(() => { loadRatings().then(setR); }, []);
  return r;
}

export function RatingChip({ r }: { r?: Rating }) {
  const { t } = useApp();
  if (!r || !r.n) return null;
  const top = r.avg >= 4.5 && r.n >= 5;
  return (
    <span className={`chip rating${top ? " top" : ""} num`} title={t("ratingN", { n: r.n })}>
      ★ {Number(r.avg).toFixed(1)} <span className="hint">({r.n})</span>{top ? ` · ${t("topRated")}` : ""}
    </span>
  );
}

/** Reviews list plus a star form for learners who used the bot or course. */
export function Reviews({ kind, id, canRate }: { kind: "bot" | "course"; id: string; canRate: boolean }) {
  const { t, user, toast, lang } = useApp();
  const [d, setD] = useState<{ list: { username: string; stars: number; body: string; at: string }[]; mine: { stars: number; body: string } | null } | null>(null);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/reviews?kind=${kind}&id=${id}`, { credentials: "include" });
    const v = r.ok ? await r.json() : { list: [], mine: null };
    setD(v);
    if (v.mine) { setStars(v.mine.stars); setBody(v.mine.body); }
  }, [kind, id]);
  useEffect(() => { load(); }, [load, user?.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/reviews", { kind, id, stars, body });
    setBusy(false);
    if (r.ok) { toast(t("reviewSaved")); load(); }
    else toast(r.data?.error === "use_first" ? t("reviewUseFirst") : r.data?.error === "blocked" ? `${t("modBlocked")}${r.data?.why ? `: ${r.data.why}` : ""}` : t("errGeneric"));
  }

  if (!d) return null;
  return (
    <div className="card reviews">
      <b>{t("reviews")}</b>
      {user && canRate && (
        <form onSubmit={save} style={{ display: "grid", gap: 8 }}>
          <div className="stars" role="radiogroup" aria-label={t("yourRating")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} className={n <= stars ? "on" : ""} onClick={() => setStars(n)} aria-label={`${n}`}>★</button>
            ))}
          </div>
          <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder={t("reviewPh")} style={{ minHeight: 64 }} />
          <button className="btn primary sm" style={{ justifySelf: "start" }} disabled={busy || !stars}>{d.mine ? t("reviewUpdate") : t("reviewSend")}</button>
        </form>
      )}
      {d.list.length ? d.list.map((r, i) => (
        <div key={i} className="review">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b className="ltr small">@{r.username}</b><span className="review-stars">{"★".repeat(r.stars)}<span>{"★".repeat(5 - r.stars)}</span></span>
            <span className="hint num" style={{ marginInlineStart: "auto" }}>{new Date(r.at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
          </div>
          <p className="small post-body">{r.body}</p>
        </div>
      )) : <p className="hint">{t("noReviews")}</p>}
    </div>
  );
}
