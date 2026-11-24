"use client";

import { Tutor } from "@/components/Tutor";

export default function AiPage() {
  return (
    <div className="stack">
      <section><span className="eyebrow">AI tutor</span><h1 style={{ fontSize: 24 }}>Your English tutor</h1></section>
      <Tutor />
    </div>
  );
}
