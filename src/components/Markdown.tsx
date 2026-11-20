import { Fragment, type ReactNode } from "react";

/** Small, safe renderer for the tutor's replies: paragraphs, bullets, numbered lists, **bold**, `code` and ``` blocks. No HTML is ever injected. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith("**") ? <strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong> : <code key={`${key}-${i++}`}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const parts = text.split(/```[a-zA-Z0-9]*\n?/);
  parts.forEach((part, pi) => {
    if (pi % 2 === 1) { blocks.push(<pre key={`c${pi}`}><code>{part.replace(/\n$/, "")}</code></pre>); return; }
    const lines = part.split("\n");
    let list: { ordered: boolean; items: string[] } | null = null;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length) {
        const k = `p${pi}-${blocks.length}`;
        blocks.push(<p key={k}>{para.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l.replace(/^#{1,6}\s*/, ""), `${k}-${i}`)}</Fragment>)}</p>);
        para = [];
      }
    };
    const flushList = () => {
      if (list) {
        const k = `l${pi}-${blocks.length}`;
        const items = list.items.map((it, i) => <li key={i}>{inline(it, `${k}-${i}`)}</li>);
        blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
        list = null;
      }
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const b = line.match(/^\s*[-*•]\s+(.*)$/);
      const n = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (b || n) {
        flushPara();
        const ordered = !!n;
        if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
        list.items.push((b || n)![1]);
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
