"use client";

import { useState } from "react";

export const domainOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0];

/** Site logo in a circle; falls back to the first letter when the icon can't load. */
export function Favicon({ url, size = 20 }: { url: string; size?: number }) {
  const d = domainOf(url);
  const [bad, setBad] = useState(false);
  const st = { width: size, height: size };
  return bad
    ? <span className="fav fav-txt" style={st}>{d.slice(0, 1).toUpperCase()}</span>
    : <img className="fav" style={st} src={`https://icons.duckduckgo.com/ip3/${d}.ico`} alt="" loading="lazy" onError={() => setBad(true)} />;
}

/** A link shown as a small card: logo, title and domain. */
export function LinkCard({ url, title }: { url: string; title?: string }) {
  const d = domainOf(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="link-card">
      <Favicon url={url} size={28} />
      <span className="lc-t"><b>{title || d}</b><span className="ltr">{d}</span></span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="lc-go"><path d="M7 17L17 7M9 7h8v8" /></svg>
    </a>
  );
}

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
/** Plain text with links turned into cards under it (at most 3). */
export function RichText({ text, className }: { text: string; className?: string }) {
  const links = [...new Set(text.match(URL_RE) || [])].slice(0, 3);
  const body = links.length ? text.replace(URL_RE, (u) => domainOf(u)).trim() : text;
  return (
    <>
      <p className={className}>{body}</p>
      {links.length > 0 && <div className="link-cards">{links.map((u) => <LinkCard key={u} url={u} />)}</div>}
    </>
  );
}
