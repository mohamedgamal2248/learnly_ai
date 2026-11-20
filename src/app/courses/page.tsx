"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CourseCards } from "@/components/CourseCards";
import { CoursesMark, ISearch } from "@/components/Icons";
import type { CourseCard } from "@/lib/courses";

export default function CoursesPage() {
  const { t } = useApp();
  const [list, setList] = useState<CourseCard[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/courses").then((r) => r.json()).then((d) => setList(d.courses || [])).catch(() => setList([])); }, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list || []).filter((c) => !s || `${c.title} ${c.title_en} ${c.description} ${c.description_en} ${c.creator}`.toLowerCase().includes(s));
  }, [list, q]);
  return (
    <div className="grid" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="hero-card">
        <CoursesMark size={56} />
        <div style={{ flex: 1 }}>
          <h1>{t("coursesTitle")}</h1>
          <p>{t("coursesSub")}</p>
        </div>
      </div>
      <label className="search card" style={{ padding: "8px 14px" }}>
        <ISearch width={18} height={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} aria-label={t("searchPh")} />
      </label>
      {!list ? <div className="skeleton" style={{ height: 160 }} /> : shown.length ? <CourseCards courses={shown} /> : <div className="card empty">{t("noCourses")}</div>}
    </div>
  );
}
