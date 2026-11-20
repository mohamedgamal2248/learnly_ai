"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Markdown } from "@/components/Markdown";
import { ensurePiAuth, post, waitForPi } from "@/lib/pi-client";
import { courseText, piFmt, type CourseDetail, type PublicLesson } from "@/lib/courses";

function CourseView() {
  const { t, lang, user, login, toast, refresh } = useApp();
  const id = useSearchParams().get("id") || "";
  const [c, setC] = useState<CourseDetail | null | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [certId, setCertId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/courses?id=${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" });
    const d = r.ok ? await r.json() : null;
    setC(d?.course ?? null);
    if (d?.course?.completed) {
      const m = await fetch("/api/certs/mine", { credentials: "include" }).then((x) => x.json()).catch(() => null);
      setCertId(m?.certs?.find((x: any) => x.kind === "course" && x.ref === id)?.id ?? null);
    }
  }, [id]);
  useEffect(() => { load(); }, [load, user?.id]);

  if (c === undefined) return <div className="skeleton" style={{ height: 240 }} />;
  if (!c) return <div className="card empty">{t("courseMissing")}</div>;
  const ct = courseText(c, lang);
  const done = Object.keys(c.progress || {}).length;
  const pct = c.lessons.length ? Math.round((done / c.lessons.length) * 100) : 0;
  const paid = Number(c.price_pi) > 0;

  async function enroll() {
    if (!user) { await login(); return; }
    if (!paid) {
      setBusy(true);
      const r = await post("/api/courses/enroll", { id: c!.id });
      setBusy(false);
      if (r.ok) { toast(t("enrolled")); load(); } else toast(t("errGeneric"));
      return;
    }
    const pi = await waitForPi();
    if (!pi) { toast(t("openInPi")); return; }
    setBusy(true);
    if (!(await ensurePiAuth(pi))) { setBusy(false); toast(t("payErr")); return; }
    pi.createPayment(
      { amount: Number(c!.price_pi), memo: `Learnly AI course`, metadata: { course: c!.id } },
      {
        onReadyForServerApproval: async (paymentId) => {
          const r = await post("/api/pi/approve", { paymentId });
          if (!r.ok) { setBusy(false); toast(t("payErr")); }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          const r = await post("/api/pi/complete", { paymentId, txid });
          setBusy(false);
          if (r.ok && r.data?.ok) { toast(t("enrolled")); refresh(); load(); } else toast(t("payErr"));
        },
        onCancel: () => { setBusy(false); toast(t("payCancelled")); },
        onError: () => { setBusy(false); toast(t("payErr")); },
      },
    );
  }

  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <section className="hero-card course-hero">
        <div style={{ display: "grid", gap: 6, flex: 1 }}>
          <h1>{ct.title}</h1>
          {ct.description && <p>{ct.description}</p>}
          <span className="hero-sub num">
            <span className="ltr">@{c.creator}</span> · {t("lessonsN", { n: c.lessons.length })} · {t("studentsN", { n: c.students })}
          </span>
          {(c.enrolled || c.owner) && (
            <div className="course-prog"><div className="budget"><i style={{ width: `${pct}%` }} /></div><span className="num">{pct}%</span></div>
          )}
        </div>
      </section>

      {c.status !== "live" && <div className="notice warn">{t(`status_${c.status}` as any)}</div>}

      {!c.enrolled && !c.owner && (
        <div className="card buy-course">
          <div style={{ flex: 1 }}>
            <b className="num">{paid ? piFmt(c.price_pi) : t("free")}</b>
            <p className="hint">{paid ? t("coursePaidHint") : t("courseFreeHint")}</p>
          </div>
          <button className="btn primary" disabled={busy} onClick={enroll}>{busy ? t("preparing") : paid ? t("buyCourse", { p: piFmt(c.price_pi) }) : t("enrollFree")}</button>
        </div>
      )}

      {c.completed && (
        <div className="card cert-cta">
          <span className="cert-cta-ico" aria-hidden="true">🎓</span>
          <div style={{ flex: 1 }}><b>{t("courseDone")}</b><p className="hint">{t("certCtaSub")}</p></div>
          {certId && <Link className="btn primary" href={`/cert?id=${certId}`}>{t("viewCert")}</Link>}
        </div>
      )}

      <div className="grid">
        {c.lessons.map((l, i) => (
          <LessonCard key={l.id} l={l} i={i} course={c} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)}
            passed={!!c.progress?.[l.id]}
            onPassed={(r) => { if (r.certId) setCertId(r.certId); load(); }} />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ l, i, course, open, onToggle, passed, onPassed }: {
  l: PublicLesson; i: number; course: CourseDetail; open: boolean; onToggle: () => void; passed: boolean;
  onPassed: (r: { certId: string | null }) => void;
}) {
  const { t, user, login, toast } = useApp();
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [wrong, setWrong] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const quiz = l.quiz || [];

  async function check() {
    if (!user) { await login(); return; }
    if (!course.enrolled) { toast(t("enrollFirst")); return; }
    setBusy(true);
    const r = await post("/api/courses/pass", { courseId: course.id, lessonId: l.id, answers: quiz.map((_, k) => picked[k]) });
    setBusy(false);
    if (!r.ok) { toast(t("errGeneric")); return; }
    if (!r.data.ok) { setWrong(r.data.wrong || []); toast(t("someWrong")); return; }
    setWrong([]);
    toast(r.data.completed ? t("courseDone") : t("lessonPassed"));
    onPassed({ certId: r.data.certId ?? null });
  }

  return (
    <section className={`card lesson lesson-${i % 4}${passed ? " done" : ""}${open ? " open" : ""}`}>
      <button className="lesson-head" onClick={onToggle} aria-expanded={open} disabled={l.locked && !open}>
        <span className="lesson-ico num" aria-hidden="true">{l.locked ? "🔒" : passed ? "✓" : i + 1}</span>
        <span className="lesson-tt">
          <span className="lesson-n num">{t("lessonN", { n: i + 1 })}{i === 0 && !course.enrolled && !course.owner ? ` · ${t("freePreview")}` : ""}</span>
          <h2>{l.title}</h2>
        </span>
        {passed ? <span className="chip free">{t("completed")}</span> : !l.locked && <span className="lesson-chev" aria-hidden="true">⌄</span>}
      </button>
      {open && !l.locked && (
        <div className="grid" style={{ gap: 12, animation: "rise .25s both" }}>
          <div className="md"><Markdown text={l.body || ""} /></div>
          {quiz.length > 0 && (
            <div className="grid" style={{ gap: 10, background: "var(--surface-2)", borderRadius: 12, padding: 12 }}>
              <b className="small">{t("quiz")}</b>
              {quiz.map((q, k) => (
                <div key={k} style={{ display: "grid", gap: 6 }}>
                  <span className="small">{q.q}</span>
                  <div className="chips" style={{ flexWrap: "wrap" }}>
                    {q.options.map((o, j) => (
                      <button key={j} className={picked[k] === j ? (wrong.includes(k) ? "chip bad" : "chip v") : "pill"}
                        style={{ padding: "6px 12px", border: picked[k] === j ? 0 : undefined, cursor: "pointer" }}
                        onClick={() => { setPicked({ ...picked, [k]: j }); setWrong(wrong.filter((x) => x !== k)); }}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="row-actions">
                <button className="btn primary sm" disabled={busy || quiz.some((_, k) => picked[k] === undefined)} onClick={check}>{t("checkAnswers")}</button>
              </div>
            </div>
          )}
          {quiz.length === 0 && course.enrolled && !passed && (
            <div className="row-actions"><button className="btn ok sm" disabled={busy} onClick={check}>{t("markDone")}</button></div>
          )}
          {course.bot_id && (
            <Link className="btn sm" href={`/chat?b=${course.bot_id}&q=${encodeURIComponent(`${l.title}: `)}`}>{t("askTutor")}</Link>
          )}
        </div>
      )}
    </section>
  );
}

export default function CoursePage() {
  return <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}><CourseView /></Suspense>;
}
