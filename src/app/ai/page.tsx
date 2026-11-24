"use client";

import { Tutor } from "@/components/Tutor";
import { useApp } from "@/components/AppProvider";

export default function AiPage() {
  const { tt } = useApp();
  return (
    <div className="stack">
      <section><span className="eyebrow">{tt("AI tutor")}</span><h1 style={{ fontSize: 24 }}>{tt("Your English tutor")}</h1></section>
      <Tutor />
    </div>
  );
}
