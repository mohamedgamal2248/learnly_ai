"use client";

import { Fragment, useState, type ReactNode } from "react";

/**
 * Safe renderer for AI replies: headings, paragraphs, lists, tables, quotes, **bold**, *italic*, `code`,
 * ``` blocks with a copy button, and http(s) links. No HTML from the reply is ever injected.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+|\*[^*\s][^*]*\*)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\((.+)\)$/) || [];
      out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="md-link">{label}</a>);
    } else if (tok.startsWith("http")) {
      out.push(<a key={k} href={tok} target="_blank" rel="noopener noreferrer nofollow" className="md-link ltr">{tok.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}</a>);
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }
  return (
    <div className="codeblock">
      <div className="codebar"><span>{lang || "code"}</span><button type="button" onClick={copy}>{copied ? "✓" : "Copy"}</button></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const parts = text.split(/```/);
  parts.forEach((part, pi) => {
    if (pi % 2 === 1) {
      const nl = part.indexOf("\n");
      const lang = nl > -1 ? part.slice(0, nl).trim() : "";
      const code = (nl > -1 ? part.slice(nl + 1) : part).replace(/\n$/, "");
      blocks.push(<CodeBlock key={`c${pi}`} code={code} lang={lang} />);
      return;
    }
    const lines = part.split("\n");
    let list: { ordered: boolean; items: string[] } | null = null;
    let para: string[] = [];
    const key = () => `b${pi}-${blocks.length}`;
    const flushPara = () => {
      if (!para.length) return;
      const k = key();
      blocks.push(<p key={k}>{para.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l, `${k}-${i}`)}</Fragment>)}</p>);
      para = [];
    };
    const flushList = () => {
      if (!list) return;
      const k = key();
      const items = list.items.map((it, i) => <li key={i}>{inline(it, `${k}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
      list = null;
    };
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].trimEnd();
      // Table: header row, separator row, then body rows.
      if (isRow(line) && li + 1 < lines.length && isSep(lines[li + 1])) {
        flushPara(); flushList();
        const head = cells(line);
        const rows: string[][] = [];
        li += 2;
        while (li < lines.length && isRow(lines[li])) rows.push(cells(lines[li++]));
        li--;
        const k = key();
        blocks.push(
          <div key={k} className="md-table"><table>
            <thead><tr>{head.map((h, i) => <th key={i}>{inline(h, `${k}-h${i}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, ci) => <td key={ci}>{inline(r[ci] ?? "", `${k}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table></div>,
        );
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      const b = line.match(/^\s*[-*•]\s+(.*)$/);
      const n = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const q = line.match(/^\s*>\s?(.*)$/);
      if (h) {
        flushPara(); flushList();
        const k = key();
        blocks.push(<div key={k} className={`md-h md-h${h[1].length}`}>{inline(h[2], k)}</div>);
      } else if (b || n) {
        flushPara();
        const ordered = !!n;
        if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
        list.items.push((b || n)![1]);
      } else if (q) {
        flushPara(); flushList();
        const k = key();
        blocks.push(<blockquote key={k}>{inline(q[1], k)}</blockquote>);
      } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        flushPara(); flushList();
        blocks.push(<hr key={key()} />);
      } else if (!line.trim()) {
        flushPara(); flushList();
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara(); flushList();
  });
  return <>{blocks}</>;
}
