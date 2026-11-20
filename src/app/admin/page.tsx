"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";

type Overview = {
  config: Record<string, number | boolean>;
  today: { cost_usd?: number; credits?: number; msgs?: number };
  users: number; paid_users: number;
  apps: { id: string; username: string; display_name: string; subjects: string; bio: string; years: number; doc_name: string | null; has_doc: boolean }[];
  reported: { id: number; username: string; body: string; reports: number }[];
};
type Finance = {
  raw: { payments: number; credits_sold: number; credits_welcome: number; credits_spent: number; msgs_total: number;
    days: { day: string; cost_usd: number; msgs: number }[]; revenue_days: { day: string; pi: number; usd: number }[] };
  summary: { revenue_usd: number; revenue_pi: number; ai_cost_usd: number; gross_usd: number; teachers_credits: number;
    teachers_usd: number; outstanding_credits: number; outstanding_cost_usd: number; net_usd: number; topup_30d_usd: number; avg_daily_cost_usd: number };
  rate: number | null; credit_usd: number; markup: number;
};
type UserRow = {
  id: string; username: string; role: string; credits: number; earned: number; paid: boolean; banned: boolean;
  pi_paid: number; usd_paid: number; credits_bought: number; credits_spent: number; ai_cost: number; teacher_cut: number; charges: number; bots: number;
};
type BotRow = {
  id: string; name: string; name_en: string; subject: string; subject_en: string; status: string; official: boolean; fee: number;
  teacher_name: string | null; description: string; description_en: string; instructions: string; knowledge_chars: number;
  files: { name: string; chars: number }[]; chats: number; messages: number; credits_charged: number; ai_cost: number; teacher_credits: number;
};

const L = {
  ar: {
    title: "صفحة الأدمن", forbidden: "الصفحة دي للأدمن بس.",
    tFin: "المالية", tUsers: "المستخدمين", tBots: "البوتات", tReq: "الطلبات", tRep: "البلاغات", tSet: "الإعدادات",
    revenue: "الإيرادات", revenueSub: "اللي المستخدمين دفعوه بالباي ({n} عملية)",
    aiCost: "اتصرف على الـAI (Meta)", aiCostSub: "التكلفة الحقيقية لكل الرسايل لحد دلوقتي",
    gross: "الكاش بعد تكلفة الـAI", grossSub: "الإيرادات ناقص تكلفة الـAI",
    teachers: "اتحوّل للمدرّسين", teachersSub: "{n} كريدت نزلت في رصيدهم تلقائيًا",
    outstanding: "كريدت لسه مع المستخدمين", outstandingSub: "تكلفة خدمتهم المتوقعة {v}",
    net: "صافي ربحك", netSub: "بعد تكلفة الـAI وخصم تكلفة الكريدت اللي لسه ما اتصرفش",
    topup: "اشحن حساب Meta بحوالي", topupSub: "يكفي 30 يوم (متوسط آخر 7 أيام × 30 + 20% أمان + الكريدت المعلّق)",
    rate: "سعر PI النهارده: ${r} · الكريدت = ${c} · الهامش ×{m}", noRate: "سعر PI مش متاح دلوقتي",
    chartCost: "تكلفة الـAI اليومية (آخر 30 يوم)", chartRev: "الإيرادات اليومية بالباي (آخر 30 يوم)",
    credits: "كريدت", msgs: "رسالة", noData: "مفيش بيانات لسه.",
    search: "دوّر باسم المستخدم", user: "المستخدم", balance: "الرصيد", paid: "دفع", spent: "صرف", cost: "كلّف", profit: "ربحك منه",
    earned: "كسب (مدرّس)", bots: "بوتات", ban: "إيقاف", unban: "رجّعه", banned: "موقوف", prev: "السابق", next: "التالي",
    status_live: "منشور", status_review: "مستني مراجعة", status_paused: "متوقف", status_rejected: "مرفوض", status_draft: "مسودة",
    publish: "انشر", pause: "وقّف", reject: "ارفض", chats: "محادثات", charged: "اتحصّل", teacherGot: "المدرّس خد",
    details: "التفاصيل", files: "ملفات المادة", instructions: "التعليمات", try: "جرّب", official: "رسمي",
    apps: "طلبات المدرّسين", noApps: "مفيش طلبات مستنية.", viewDoc: "عرض المستند", approve: "موافقة", reasonPh: "سبب الرفض (اختياري)",
    review: "بوتات ودروس مستنية موافقتك", noReview: "مفيش حاجة مستنية.", years: "{n} سنة خبرة",
    reported: "بوستات عليها بلاغات", noReported: "مفيش بلاغات.", hide: "إخفاء", keep: "إبقاء",
    killFree: "إيقاف الـAI لغير الدافعين", save: "احفظ", saved: "اتحفظ", done: "اتسجّل", err: "حصلت مشكلة",
    lMarkup: "هامش الربح على تكلفة الـAI (×)", lWelcome: "كريدت الترحيب", lFreeMsgs: "رسايل يومية لغير الدافعين",
    lBudget: "ميزانية الـAI اليومية لغير الدافعين ($)", lReserve: "أقصى حجز للرسالة (كريدت)", lFileFee: "رسوم إنشاء ملف (كريدت)",
    lPerMin: "أقصى رسايل في الدقيقة لكل مستخدم", lDayCap: "أقصى كريدت يصرفه أي مستخدم في اليوم",
    today: "النهارده", usersN: "مستخدم", paidN: "دفعوا",
  },
  en: {
    title: "Admin", forbidden: "This page is for admins only.",
    tFin: "Finance", tUsers: "Users", tBots: "Bots", tReq: "Requests", tRep: "Reports", tSet: "Settings",
    revenue: "Revenue", revenueSub: "What users paid in Pi ({n} payments)",
    aiCost: "Spent on AI (Meta)", aiCostSub: "Real cost of every message so far",
    gross: "Cash after AI cost", grossSub: "Revenue minus AI cost",
    teachers: "Paid to teachers", teachersSub: "{n} credits added to their balances automatically",
    outstanding: "Credits users still hold", outstandingSub: "Expected cost to serve them {v}",
    net: "Your net profit", netSub: "After AI cost and the expected cost of unspent credits",
    topup: "Top up your Meta account with about", topupSub: "Covers 30 days (last 7 days' average × 30 + 20% buffer + unspent credits)",
    rate: "PI today: ${r} · 1 credit = ${c} · margin ×{m}", noRate: "PI price unavailable right now",
    chartCost: "Daily AI cost (last 30 days)", chartRev: "Daily revenue in Pi (last 30 days)",
    credits: "credits", msgs: "messages", noData: "No data yet.",
    search: "Search by username", user: "User", balance: "Balance", paid: "Paid", spent: "Spent", cost: "Cost", profit: "Your profit",
    earned: "Earned (teacher)", bots: "Bots", ban: "Suspend", unban: "Restore", banned: "Suspended", prev: "Previous", next: "Next",
    status_live: "Live", status_review: "In review", status_paused: "Paused", status_rejected: "Rejected", status_draft: "Draft",
    publish: "Publish", pause: "Pause", reject: "Reject", chats: "chats", charged: "Charged", teacherGot: "Teacher got",
    details: "Details", files: "Course files", instructions: "Instructions", try: "Try it", official: "Official",
    apps: "Teacher applications", noApps: "No pending applications.", viewDoc: "View document", approve: "Approve", reasonPh: "Rejection reason (optional)",
    review: "Bots and lessons waiting for you", noReview: "Nothing waiting.", years: "{n} years",
    reported: "Reported posts", noReported: "No reports.", hide: "Hide", keep: "Keep",
    killFree: "Stop AI for non-paying users", save: "Save", saved: "Saved", done: "Done", err: "Something went wrong",
    lMarkup: "Margin on AI cost (×)", lWelcome: "Welcome credits", lFreeMsgs: "Daily messages for non-paying users",
    lBudget: "Daily AI budget for non-paying users ($)", lReserve: "Max reserve per message (credits)", lFileFee: "File creation fee (credits)",
    lPerMin: "Max messages per minute per user", lDayCap: "Max credits any user can spend per day",
    today: "Today", usersN: "users", paidN: "paying",
  },
};
type LKey = keyof typeof L.ar;
type Tab = "fin" | "users" | "bots" | "req" | "rep" | "set";

export default function AdminPage() {
  const { user, ready, lang } = useApp();
  const [tab, setTab] = useState<Tab>("fin");
  const tr = useCallback((k: LKey, v?: Record<string, string | number>) => {
    let s: string = L[lang][k];
    if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, String(b));
    return s;
  }, [lang]);

  if (!ready) return <div className="skeleton" style={{ height: 160 }} />;
  if (user?.role !== "admin") return <div className="card empty">{tr("forbidden")}</div>;

  const tabs: [Tab, LKey][] = [["fin", "tFin"], ["users", "tUsers"], ["bots", "tBots"], ["req", "tReq"], ["rep", "tRep"], ["set", "tSet"]];
  return (
    <div className="grid">
      <div className="card"><h1 style={{ fontSize: 20 }}>{tr("title")}</h1></div>
      <div className="chips" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`pill${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{tr(label)}</button>
        ))}
      </div>
      <div key={tab} className="page">
        {tab === "fin" && <FinanceTab tr={tr} />}
        {tab === "users" && <UsersTab tr={tr} />}
        {tab === "bots" && <BotsTab tr={tr} only={null} />}
        {tab === "req" && <RequestsTab tr={tr} />}
        {tab === "rep" && <ReportsTab tr={tr} />}
        {tab === "set" && <SettingsTab tr={tr} />}
      </div>
    </div>
  );
}

type Tr = (k: LKey, v?: Record<string, string | number>) => string;

function useFmt() {
  const { lang } = useApp();
  const loc = lang === "ar" ? "ar-EG" : "en-US";
  return {
    n: (v: number, d = 0) => Number(v || 0).toLocaleString(loc, { maximumFractionDigits: d }),
    usd: (v: number) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v !== 0 && Math.abs(v) < 1 ? 4 : 2 })}`,
  };
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "ok" | "bad" | "info" }) {
  return (
    <div className="card kpi" style={tone ? { boxShadow: `inset 0 0 0 1.5px var(--${tone === "info" ? "primary" : tone === "ok" ? "ok" : "danger"})` } : undefined}>
      <div className="l">{label}</div>
      <div className="v num ltr" style={{ textAlign: "start" }}>{value}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  );
}

function Bars({ data, label, value }: { data: { day: string; v: number }[]; label: string; value: (v: number) => string }) {
  const max = Math.max(0.000001, ...data.map((d) => d.v));
  return (
    <div className="card">
      <div className="small" style={{ fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, direction: "ltr" }}>
        {data.map((d) => (
          <div key={d.day} title={`${d.day}: ${value(d.v)}`} style={{ flex: 1, minWidth: 3, height: `${Math.max(2, (d.v / max) * 100)}%`, background: "var(--primary)", borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
        ))}
      </div>
      <div className="hint ltr" style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span>{data[0]?.day.slice(5)}</span><span>{value(max)}</span><span>{data[data.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

function FinanceTab({ tr }: { tr: Tr }) {
  const [f, setF] = useState<Finance | null>(null);
  const { n, usd } = useFmt();
  useEffect(() => { fetch("/api/admin/finance", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then(setF).catch(() => {}); }, []);
  if (!f) return <div className="skeleton" style={{ height: 200 }} />;
  const s = f.summary;
  const pi = (v: number) => (f.rate ? `${n(v / f.rate, 2)} π` : "—");
  const both = (v: number) => <>{usd(v)} <span className="hint">· {pi(v)}</span></>;
  return (
    <div className="grid">
      <p className="hint">{f.rate ? tr("rate", { r: f.rate.toFixed(4), c: f.credit_usd, m: f.markup }) : tr("noRate")}</p>
      <div className="kpis stagger">
        <Kpi label={tr("revenue")} value={<>{n(s.revenue_pi, 4)} π <span className="hint">· {usd(s.revenue_usd)}</span></>} sub={tr("revenueSub", { n: n(f.raw.payments) })} />
        <Kpi label={tr("aiCost")} value={both(s.ai_cost_usd)} sub={tr("aiCostSub")} />
        <Kpi label={tr("gross")} value={both(s.gross_usd)} sub={tr("grossSub")} />
        <Kpi label={tr("teachers")} value={both(s.teachers_usd)} sub={tr("teachersSub", { n: n(s.teachers_credits) })} />
        <Kpi label={tr("outstanding")} value={<>{n(s.outstanding_credits)} {tr("credits")}</>} sub={tr("outstandingSub", { v: usd(s.outstanding_cost_usd) })} />
        <Kpi label={tr("net")} value={both(s.net_usd)} sub={tr("netSub")} tone={s.net_usd >= 0 ? "ok" : "bad"} />
        <Kpi label={tr("topup")} value={both(s.topup_30d_usd)} sub={tr("topupSub")} tone="info" />
        <Kpi label={tr("msgs")} value={n(f.raw.msgs_total)} sub={`${n(f.raw.credits_spent)} ${tr("credits")}`} />
      </div>
      {f.raw.days.length ? (
        <Bars label={tr("chartCost")} data={f.raw.days.map((d) => ({ day: d.day, v: Number(d.cost_usd) }))} value={usd} />
      ) : <div className="card empty">{tr("noData")}</div>}
      {f.raw.revenue_days.length > 0 && (
        <Bars label={tr("chartRev")} data={f.raw.revenue_days.map((d) => ({ day: d.day, v: Number(d.pi) }))} value={(v) => `${n(v, 2)} π`} />
      )}
    </div>
  );
}

function UsersTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; rows: UserRow[] } | null>(null);
  const [cu, setCu] = useState(0.001);
  const { n, usd } = useFmt();
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`, { credentials: "include", cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [q, page]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);
  useEffect(() => { fetch("/api/admin/finance", { credentials: "include" }).then((r) => r.json()).then((f) => setCu(f.credit_usd)).catch(() => {}); }, []);

  async function ban(u: UserRow) {
    const r = await post("/api/admin/decide", { kind: "ban", id: u.id, banned: !u.banned });
    if (r.ok) { toast(tr("done")); load(); } else toast(tr("err"));
  }

  return (
    <div className="grid">
      <label className="search" style={{ marginTop: 0 }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={tr("search")} aria-label={tr("search")} />
      </label>
      {!data ? <div className="skeleton" style={{ height: 200 }} /> : (
        <div className="card" style={{ overflowX: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 820 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "var(--muted)" }}>
                {(["user", "balance", "paid", "spent", "cost", "profit", "earned", "bots", ""] as (LKey | "")[]).map((k, i) => (
                  <th key={i} style={{ padding: "10px 12px", textAlign: "start", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>{k ? tr(k) : ""}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((u) => {
                const profit = u.credits_spent * cu - u.ai_cost - u.teacher_cut * cu;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <b className="ltr">@{u.username}</b>{" "}
                      {u.role !== "user" && <span className="chip v">{u.role}</span>}{" "}
                      {u.banned && <span className="chip bad">{tr("banned")}</span>}
                    </td>
                    <td className="num" style={{ padding: "10px 12px" }}>{n(u.credits)}</td>
                    <td className="num ltr" style={{ padding: "10px 12px", textAlign: "start" }}>{u.pi_paid ? `${n(u.pi_paid, 4)} π` : "—"}</td>
                    <td className="num" style={{ padding: "10px 12px" }}>{n(u.credits_spent)}</td>
                    <td className="num ltr" style={{ padding: "10px 12px", textAlign: "start" }}>{usd(u.ai_cost)}</td>
                    <td className="num ltr" style={{ padding: "10px 12px", textAlign: "start", color: profit >= 0 ? "var(--ok)" : "var(--danger)" }}>{usd(profit)}</td>
                    <td className="num" style={{ padding: "10px 12px" }}>{u.earned ? n(u.earned) : "—"}</td>
                    <td className="num" style={{ padding: "10px 12px" }}>{u.bots || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {u.role !== "admin" && <button className={`btn sm ${u.banned ? "" : "danger"}`} onClick={() => ban(u)}>{u.banned ? tr("unban") : tr("ban")}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.rows.length && <div className="empty">{tr("noData")}</div>}
        </div>
      )}
      {data && data.total > 30 && (
        <div className="row-actions" style={{ justifyContent: "center" }}>
          <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{tr("prev")}</button>
          <span className="hint num" style={{ alignSelf: "center" }}>{page + 1} / {Math.ceil(data.total / 30)}</span>
          <button className="btn sm" disabled={(page + 1) * 30 >= data.total} onClick={() => setPage(page + 1)}>{tr("next")}</button>
        </div>
      )}
    </div>
  );
}

function BotsTab({ tr, only }: { tr: Tr; only: string | null }) {
  const { lang, toast } = useApp();
  const [bots, setBots] = useState<BotRow[] | null>(null);
  const [cu, setCu] = useState(0.001);
  const [open, setOpen] = useState<string | null>(null);
  const { n, usd } = useFmt();
  const load = useCallback(async () => {
    const [b, f] = await Promise.all([
      fetch("/api/admin/bots", { credentials: "include", cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/finance", { credentials: "include" }).then((r) => r.json()).catch(() => null),
    ]);
    setBots(b.bots || []);
    if (f?.credit_usd) setCu(f.credit_usd);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    const r = await post("/api/admin/decide", { kind: "bot_status", id, status });
    if (r.ok) { toast(tr("done")); load(); } else toast(tr("err"));
  }

  if (!bots) return <div className="skeleton" style={{ height: 200 }} />;
  const list = only ? bots.filter((b) => b.status === only) : bots;
  if (!list.length) return <div className="card empty">{only ? tr("noReview") : tr("noData")}</div>;
  const chip: Record<string, string> = { live: "free", review: "warn", paused: "bad", rejected: "bad" };

  return (
    <div className="grid stagger">
      {list.map((b) => {
        const name = (lang === "en" ? b.name_en : b.name) || b.name || b.name_en;
        const subject = (lang === "en" ? b.subject_en : b.subject) || b.subject;
        const profit = b.credits_charged * cu - b.ai_cost - b.teacher_credits * cu;
        return (
          <div key={b.id} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <b>{name}</b>
              <span className={`chip ${chip[b.status] || ""}`}>{tr(`status_${b.status}` as LKey)}</span>
              {b.official && <span className="chip v">{tr("official")}</span>}
              <span className="chip">{subject}</span>
              {b.teacher_name && !b.official && <span className="chip">{b.teacher_name}</span>}
              {b.fee > 0 && <span className="chip num">+{b.fee} / {tr("msgs")}</span>}
            </div>
            <div className="meta">
              <span className="chip num">{n(b.chats)} {tr("chats")}</span>
              <span className="chip num">{n(b.messages)} {tr("msgs")}</span>
              <span className="chip num">{tr("charged")}: {n(b.credits_charged)}</span>
              <span className="chip num ltr">{tr("cost")}: {usd(b.ai_cost)}</span>
              <span className="chip num">{tr("teacherGot")}: {n(b.teacher_credits)}</span>
              <span className={`chip num ltr ${profit >= 0 ? "free" : "bad"}`}>{tr("profit")}: {usd(profit)}</span>
            </div>
            {open === b.id && (
              <div className="grid" style={{ gap: 8, animation: "rise .25s both" }}>
                {b.description && <p className="small">{b.description}</p>}
                {b.description_en && <p className="small ltr" style={{ textAlign: "start" }}>{b.description_en}</p>}
                {b.instructions && <div><b className="small">{tr("instructions")}</b><p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{b.instructions}</p></div>}
                <div>
                  <b className="small">{tr("files")}</b>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {b.files.length ? b.files.map((f, i) => <span key={i} className="chip">{f.name} · <span className="num">{n(f.chars)}</span></span>) : <span className="hint">—</span>}
                  </div>
                </div>
              </div>
            )}
            <div className="row-actions">
              <button className="btn sm" onClick={() => setOpen(open === b.id ? null : b.id)}>{tr("details")}</button>
              <Link className="btn sm" href={`/chat?b=${b.id}`}>{tr("try")}</Link>
              {b.status !== "live" && <button className="btn ok sm" onClick={() => setStatus(b.id, "live")}>{tr("publish")}</button>}
              {b.status === "live" && !b.official && <button className="btn sm" onClick={() => setStatus(b.id, "paused")}>{tr("pause")}</button>}
              {b.status === "review" && <button className="btn danger sm" onClick={() => setStatus(b.id, "rejected")}>{tr("reject")}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function useOverview() {
  const [o, setO] = useState<Overview | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/overview", { credentials: "include", cache: "no-store" });
    if (r.ok) setO(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  return { o, load };
}

function RequestsTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const { o, load } = useOverview();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  async function decide(id: string, approve: boolean) {
    const r = await post("/api/admin/decide", { kind: "app", id, approve, reason: reasons[id] });
    if (r.ok) { toast(tr("done")); load(); } else toast(tr("err"));
  }
  return (
    <div className="grid">
      <div className="sec-h" style={{ marginTop: 0 }}><h2>{tr("apps")}</h2></div>
      {!o ? <div className="skeleton" style={{ height: 120 }} /> : o.apps.length === 0 ? <div className="card empty">{tr("noApps")}</div> : o.apps.map((a) => (
        <div key={a.id} className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <b>{a.display_name}</b><span className="chip ltr">@{a.username}</span><span className="chip">{tr("years", { n: a.years })}</span>
          </div>
          <p className="small"><b>{a.subjects}</b></p>
          <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{a.bio}</p>
          {a.has_doc && <a className="link" href={`/api/admin/doc/${a.id}`} target="_blank" rel="noopener noreferrer">{tr("viewDoc")} · {a.doc_name}</a>}
          <input className="input" placeholder={tr("reasonPh")} value={reasons[a.id] || ""} onChange={(e) => setReasons({ ...reasons, [a.id]: e.target.value })} aria-label={tr("reasonPh")} />
          <div className="row-actions">
            <button className="btn ok sm" onClick={() => decide(a.id, true)}>{tr("approve")}</button>
            <button className="btn danger sm" onClick={() => decide(a.id, false)}>{tr("reject")}</button>
          </div>
        </div>
      ))}
      <div className="sec-h"><h2>{tr("review")}</h2></div>
      <BotsTab tr={tr} only="review" />
    </div>
  );
}

function ReportsTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const { o, load } = useOverview();
  async function decide(id: number, keep: boolean) {
    const r = await post("/api/admin/decide", { kind: "post", id, approve: keep });
    if (r.ok) { toast(tr("done")); load(); } else toast(tr("err"));
  }
  if (!o) return <div className="skeleton" style={{ height: 120 }} />;
  if (!o.reported.length) return <div className="card empty">{tr("noReported")}</div>;
  return (
    <div className="grid">
      {o.reported.map((p) => (
        <div key={p.id} className="card" style={{ display: "grid", gap: 8 }}>
          <div><b className="ltr">@{p.username}</b> <span className="chip bad num">{p.reports}</span></div>
          <p className="post-body small">{p.body}</p>
          <div className="row-actions">
            <button className="btn danger sm" onClick={() => decide(p.id, false)}>{tr("hide")}</button>
            <button className="btn sm" onClick={() => decide(p.id, true)}>{tr("keep")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const LIMIT_FIELDS: [string, LKey, number][] = [
  ["markup", "lMarkup", 0.5], ["welcome_credits", "lWelcome", 10], ["free_daily_msgs", "lFreeMsgs", 1],
  ["daily_budget_usd", "lBudget", 0.5], ["max_reserve", "lReserve", 10], ["file_fee", "lFileFee", 1],
  ["max_per_minute", "lPerMin", 1], ["daily_credit_cap", "lDayCap", 100],
];

function SettingsTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const { o } = useOverview();
  const { n, usd } = useFmt();
  const [cfg, setCfg] = useState<Record<string, number | boolean>>({});
  useEffect(() => { if (o) setCfg(o.config); }, [o]);
  async function save(patch: Record<string, number | boolean>) {
    const r = await post("/api/admin/config", patch);
    if (r.ok) { setCfg(r.data.config); toast(tr("saved")); } else toast(`${tr("err")} ${r.data?.field ?? ""}`);
  }
  if (!o) return <div className="skeleton" style={{ height: 160 }} />;
  const budget = Number(o.config.daily_budget_usd) || 1;
  const cost = Number(o.today.cost_usd || 0);
  return (
    <div className="grid">
      <div className="kpis">
        <Kpi label={tr("today")} value={`${usd(cost)} / ${usd(budget)}`} sub={`${n(o.today.msgs || 0)} ${tr("msgs")}`} />
        <Kpi label={tr("tUsers")} value={n(o.users)} sub={`${n(o.paid_users)} ${tr("paidN")}`} />
      </div>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <label className="switch">
          <span>{tr("killFree")}</span>
          <input type="checkbox" id="kill_free" checked={!!cfg.kill_free} onChange={(e) => save({ kill_free: e.target.checked })} style={{ width: 22, height: 22 }} />
        </label>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {LIMIT_FIELDS.map(([k, label, step]) => (
            <label key={k} className="field"><span>{tr(label)}</span>
              <input className="input num" id={`cfg-${k}`} type="number" step={step} value={String(cfg[k] ?? "")}
                onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <button className="btn primary" style={{ justifySelf: "start" }} onClick={() => {
          const nums: Record<string, number> = {};
          for (const [k] of LIMIT_FIELDS) nums[k] = Number(cfg[k]);
          save(nums);
        }}>{tr("save")}</button>
      </div>
    </div>
  );
}
