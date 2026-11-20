"use client";

import Link from "next/link";
import { CoursesMark } from "./Icons";
import { useApp } from "./AppProvider";
import { courseText, piFmt, type CourseCard } from "@/lib/courses";
import { RatingChip, useRatings } from "./Reviews";

export function CourseCards({ courses }: { courses: CourseCard[] }) {
  const { t, lang } = useApp();
  const ratings = useRatings();
  return (
    <div className="course-grid stagger">
      {courses.map((c) => {
        const ct = courseText(c, lang);
        return (
          <Link key={c.id} href={`/course?id=${c.id}`} className="card course-card">
            <div className="cc-top">
              <CoursesMark size={42} />
              <span className={`chip ${Number(c.price_pi) > 0 ? "v" : "free"} num`}>{Number(c.price_pi) > 0 ? piFmt(c.price_pi) : t("free")}</span>
            </div>
            <b className="cc-title">{ct.title}</b>
            {ct.description && <p className="cc-desc">{ct.description}</p>}
            <RatingChip r={ratings[c.id]} />
            <div className="cc-meta hint num">
              <span>{t("lessonsN", { n: c.lessons })}</span><span>·</span><span>{t("studentsN", { n: c.students })}</span><span>·</span><span className="ltr">@{c.creator}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
