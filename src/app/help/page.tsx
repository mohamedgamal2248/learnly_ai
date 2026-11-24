"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";

const FAQ: [string, string][] = [
  ["How do I start?", "Open Learn and tap the glowing lesson. Read the words, then practise. You can try the first lessons without signing in."],
  ["What are XP and the daily goal?", "You earn XP for every lesson and every right review. Fill the ring on the Today page to reach your daily goal. You can change the goal in Me."],
  ["What is a streak freeze?", "If you miss exactly one day, a freeze keeps your streak alive. You start with one and earn another every 7 days in a row (up to 2)."],
  ["What are Plus and Pro?", "Plus opens all A1 and A2 lessons and the AI tutor. Pro adds the B1 lessons. Plans last 30 days and are paid in Pi. You can try Plus free once."],
  ["What are AI credits?", "Each question to the AI tutor uses a few credits. Plans include credits, and you can add packs. If the AI cannot answer, the credits come back."],
  ["How do reviews and mistakes work?", "Words you learn come back for review after 1, 2, 4, 8 days and so on. Words you answer wrong come back after two days and are also listed in My mistakes."],
  ["A translation or sentence looks wrong", "Tap the flag \"Report a mistake\" in the lesson. Our team checks every report. Tell us what is wrong and we will fix it."],
  ["Can I learn without internet?", "Lessons you opened before stay available offline. Your results are saved when you are online again."],
  ["My payment did not work", "Open Learnly AI from Pi Browser and try again. If Pi charged you and the plan did not start, reopen the app: unfinished payments are completed automatically."],
];

export default function Help() {
  const { tt } = useApp();
  return (
    <div className="stack">
      <section><span className="eyebrow">{tt("Help")}</span><h1 style={{ fontSize: 24 }}>{tt("Start here")}</h1></section>
      {FAQ.map(([q, a]) => (
        <details key={q} className="lc faq"><summary><b>{tt(q)}</b></summary><p className="muted" style={{ marginTop: 8 }}>{tt(a)}</p></details>
      ))}
      <p className="small muted" style={{ textAlign: "center" }}><Link className="md-link" href="/credits">{tt("Credits")}</Link> · <Link className="md-link" href="/privacy">{tt("Privacy")}</Link> · <Link className="md-link" href="/terms">{tt("Terms")}</Link></p>
    </div>
  );
}
