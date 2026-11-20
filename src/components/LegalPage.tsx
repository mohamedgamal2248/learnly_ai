"use client";

import { useApp } from "./AppProvider";
import type { Doc } from "@/lib/legal";

export function LegalPage({ docs }: { docs: Record<"ar" | "en", Doc> }) {
  const { lang } = useApp();
  const d = docs[lang === "ar" ? "ar" : "en"];
  return (
    <article className="card legal" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>{d.title}</h1>
      <p className="hint">{d.updated}</p>
      {d.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.length > 1 ? <ul>{s.p.map((x) => <li key={x}>{x}</li>)}</ul> : <p>{s.p[0]}</p>}
        </section>
      ))}
    </article>
  );
}
