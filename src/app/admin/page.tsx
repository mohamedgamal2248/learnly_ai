"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";

const L = {
  ar: {
    grantTitle: "إضافة أرباح Pi لمستخدم",
    grantHint: "بتتضاف لرصيد أرباحه بالـPi، وتقدر تجرّب بيها السحب. أقصى حاجة ١٠٠٠ Pi في المرة.",
    grantUser: "اسم المستخدم",
    grantAmount: "المبلغ (Pi)",
    grantBtn: "أضف",
    grantDone: "اتضاف ✓ رصيده دلوقتي",
    grantNotFound: "المستخدم ده مش موجود",
    wdNone: "مفيش طلبات سحب",
    wdApprove: "ابعت Pi",
    wdReject: "ارفض",
    wdRetry: "كمّل الإرسال",
    wdNoWallet: "لازم تضيف PI_WALLET_SEED (مفتاح محفظة التطبيق السري) في Vercel عشان الإرسال يشتغل.",
    wdSent: "اتبعت ✓",
    wdStatus_pending: "مستني",
    wdStatus_sending: "بيتبعت",
    wdStatus_sent: "اتبعت",
    wdStatus_rejected: "مرفوض",
    wdStatus_failed: "فشل",
    done: "اتسجّل",
    err: "حصلت مشكلة",
    save: "احفظ",
    saved: "اتحفظ",
    search: "دوّر باسم المستخدم",
    prev: "السابق",
    next: "التالي",
    ban: "إيقاف",
    unban: "رجّعه",
    banned: "موقوف",
    noData: "مفيش بيانات لسه.",
    forbidden: "الصفحة دي للأدمن بس.",
    title: "صفحة الأدمن",
    tRep: "البلاغات", rpNone: "مفيش بلاغات", rpBan: "احظر المستخدم", rpDismiss: "تجاهل", rpCount: "{n} بلاغ عليه", rpBy: "من",
    tMarket: "نظرة عامة",
    tTasks: "المهام",
    tDisp: "النزاعات",
    tUsers: "المستخدمين",
    tWd: "السحب والرصيد",
    tSet: "الإعدادات",
    mUsers: "المستخدمين",
    mUsersSub: "{n} جدد آخر ٧ أيام",
    mProfiles: "ملفات شخصية",
    mProfilesSub: "{n} عمل في المعارض",
    mVolume: "حجم المهام المقبولة",
    mVolumeSub: "{n} مهمة اتقبلت",
    mFees: "عمولة الموقع",
    mFeesSub: "اللي فاضل بعد دفع المنفّذين",
    mHeld: "محجوز في مهام شغّالة",
    mHeldSub: "فلوس ما اتسلّمتش لحد دلوقتي",
    mDeposits: "اتشحن بالباي",
    mDepositsSub: "{n} عملية شحن",
    mBalances: "أرصدة المستخدمين",
    mBalancesSub: "اتسحب {n} π لحد دلوقتي",
    mOpen: "مهام مفتوحة",
    mOpenSub: "{a} شغّالة · {b} مستنية قبول",
    mDeals: "مفاوضات مفتوحة",
    mDealsSub: "{n} اتفاق اتقفل",
    mDisp: "نزاعات مستنية قرارك",
    mWd: "طلبات سحب مستنية",
    mViaMcp: "مهام من الـAI agents",
    chartVol: "حجم المهام المقبولة يومياً بالباي (آخر ١٤ يوم)",
    chartDep: "الشحن اليومي بالباي (آخر ١٤ يوم)",
    tkAll: "الكل",
    tkTitle: "المهمة",
    tkReq: "صاحب الطلب",
    tkWorker: "المنفّذ",
    tkReward: "المكافأة",
    tkStatus: "الحالة",
    tkCancel: "الغي وارجّع الفلوس",
    tkNone: "مفيش مهام",
    tkS_open: "مفتوحة",
    tkS_claimed: "اتاخدت",
    tkS_submitted: "اتسلّمت",
    tkS_approved: "اتقبلت",
    tkS_cancelled: "اتلغت",
    tkDraft: "مسودة",
    uPiBal: "الرصيد",
    uPiEarned: "أرباح",
    uWithdrawn: "اتسحب",
    uDeposited: "اتشحن",
    uPosted: "نشر",
    uDone: "نفّذ",
    uRating: "التقييم",
    uProfile: "ملف",
    sFee: "عمولة الموقع على المهام (٪)",
    sNewDone: "مهام مقبولة تخرّج المنفّذ من حدود الجدد",
    sNewMax: "أقصى مكافأة للمنفّذ الجديد (Pi)",
    sMcpCap: "الحد اليومي الافتراضي لنشر الـAI (Pi)",
    sMinWd: "أقل سحب (Pi)",
    dpTitle: "النزاعات",
    dpNone: "مفيش نزاعات مفتوحة",
    dpWorker: "ادفع للمنفّذ",
    dpRequester: "الرفض صح",
    dpSplit: "قسّم النص بالنص",
    dpReject: "سبب الرفض",
    dpWorkerSays: "كلام المنفّذ",
    dpResult: "الشغل المسلّم",
    dpDone: "اتحسم ✓",
  },
  en: {
    grantTitle: "Add Pi earnings to a user",
    grantHint: "Added to their Pi earnings balance so you can test withdrawals. Up to 1000 Pi at a time.",
    grantUser: "Username",
    grantAmount: "Amount (Pi)",
    grantBtn: "Add",
    grantDone: "Added ✓ Their balance is now",
    grantNotFound: "User not found",
    wdNone: "No withdrawal requests",
    wdApprove: "Send Pi",
    wdReject: "Reject",
    wdRetry: "Finish sending",
    wdNoWallet: "Add PI_WALLET_SEED (the app wallet secret seed) in Vercel to enable sending.",
    wdSent: "Sent ✓",
    wdStatus_pending: "Pending",
    wdStatus_sending: "Sending",
    wdStatus_sent: "Sent",
    wdStatus_rejected: "Rejected",
    wdStatus_failed: "Failed",
    done: "Done",
    err: "Something went wrong",
    save: "Save",
    saved: "Saved",
    search: "Search by username",
    prev: "Previous",
    next: "Next",
    ban: "Suspend",
    unban: "Restore",
    banned: "Suspended",
    noData: "No data yet.",
    forbidden: "This page is for admins only.",
    title: "Admin",
    tRep: "Reports", rpNone: "No reports", rpBan: "Ban the user", rpDismiss: "Dismiss", rpCount: "{n} reports on them", rpBy: "by",
    tMarket: "Overview",
    tTasks: "Tasks",
    tDisp: "Disputes",
    tUsers: "Users",
    tWd: "Withdrawals",
    tSet: "Settings",
    mUsers: "Users",
    mUsersSub: "{n} new in the last 7 days",
    mProfiles: "Public profiles",
    mProfilesSub: "{n} portfolio items",
    mVolume: "Approved task volume",
    mVolumeSub: "{n} tasks approved",
    mFees: "Site fees",
    mFeesSub: "What is left after workers are paid",
    mHeld: "Held in running tasks",
    mHeldSub: "Money not delivered yet",
    mDeposits: "Added with Pi",
    mDepositsSub: "{n} top-ups",
    mBalances: "User balances",
    mBalancesSub: "{n} π withdrawn so far",
    mOpen: "Open tasks",
    mOpenSub: "{a} in progress · {b} waiting approval",
    mDeals: "Open negotiations",
    mDealsSub: "{n} deals agreed",
    mDisp: "Disputes waiting for you",
    mWd: "Withdrawal requests waiting",
    mViaMcp: "Tasks from AI agents",
    chartVol: "Approved task volume per day in Pi (last 14 days)",
    chartDep: "Top-ups per day in Pi (last 14 days)",
    tkAll: "All",
    tkTitle: "Task",
    tkReq: "Requester",
    tkWorker: "Worker",
    tkReward: "Reward",
    tkStatus: "Status",
    tkCancel: "Cancel and refund",
    tkNone: "No tasks",
    tkS_open: "Open",
    tkS_claimed: "Taken",
    tkS_submitted: "Delivered",
    tkS_approved: "Approved",
    tkS_cancelled: "Cancelled",
    tkDraft: "Draft",
    uPiBal: "Balance",
    uPiEarned: "Earned",
    uWithdrawn: "Withdrawn",
    uDeposited: "Deposited",
    uPosted: "Posted",
    uDone: "Done",
    uRating: "Rating",
    uProfile: "Profile",
    sFee: "Site fee on tasks (%)",
    sNewDone: "Approved tasks that end the new-worker limits",
    sNewMax: "Max reward for a new worker (Pi)",
    sMcpCap: "Default daily AI posting cap (Pi)",
    sMinWd: "Minimum withdrawal (Pi)",
    dpTitle: "Disputes",
    dpNone: "No open disputes",
    dpWorker: "Pay the worker",
    dpRequester: "Rejection stands",
    dpSplit: "Split 50/50",
    dpReject: "Rejection reason",
    dpWorkerSays: "Worker says",
    dpResult: "Delivered work",
    dpDone: "Decided ✓",
  },
};
type LKey = keyof typeof L.ar;
type Tab = "market" | "tasks" | "disp" | "rep" | "users" | "wd" | "set";
type Tr = (k: LKey, v?: Record<string, string | number>) => string;

export default function AdminPage() {
  const { user, ready, lang } = useApp();
  const [tab, setTab] = useState<Tab>("market");
  const tr = useCallback((k: LKey, v?: Record<string, string | number>) => {
    let s: string = L[lang][k];
    if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, String(b));
    return s;
  }, [lang]);

  if (!ready) return <div className="skeleton" style={{ height: 160 }} />;
  if (user?.role !== "admin") return <div className="card empty">{tr("forbidden")}</div>;

  const tabs: [Tab, LKey][] = [["market", "tMarket"], ["tasks", "tTasks"], ["disp", "tDisp"], ["rep", "tRep"], ["users", "tUsers"], ["wd", "tWd"], ["set", "tSet"]];
  return (
    <div className="grid">
      <div className="card"><h1 style={{ fontSize: 20 }}>{tr("title")}</h1></div>
      <div className="chips" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`pill${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{tr(label)}</button>
        ))}
      </div>
      <div key={tab} className="page">
        {tab === "market" && <MarketTab tr={tr} />}
        {tab === "tasks" && <TasksTab tr={tr} />}
        {tab === "disp" && <DisputesTab tr={tr} />}
        {tab === "rep" && <ReportsTab tr={tr} />}
        {tab === "users" && <UsersTab tr={tr} />}
        {tab === "wd" && <WithdrawalsTab tr={tr} />}
        {tab === "set" && <SettingsTab tr={tr} />}
      </div>
    </div>
  );
}

function useFmt() {
  const { lang } = useApp();
  const loc = lang === "ar" ? "ar-EG" : "en-US";
  return { n: (v: number, d = 0) => Number(v || 0).toLocaleString(loc, { maximumFractionDigits: d }) };
}
const piF = (v: number | string) => `${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "ok" | "bad" | "info" }) {
  return (
    <div className="card kpi" style={tone ? { boxShadow: `inset 0 0 0 1.5px var(--${tone === "info" ? "primary" : tone === "ok" ? "ok" : "danger"})` } : undefined}>
      <div className="l">{label}</div>
      <div className="v num ltr" style={{ textAlign: "start" }}>{value}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  );
}

function Bars({ data, label }: { data: { day: string; v: number }[]; label: string }) {
  const max = Math.max(0.000001, ...data.map((d) => d.v));
  return (
    <div className="card">
      <div className="small" style={{ fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, direction: "ltr" }}>
        {data.map((d) => <div key={d.day} title={`${d.day}: ${piF(d.v)}`} style={{ flex: 1, minWidth: 3, height: `${Math.max(2, (d.v / max) * 100)}%`, background: "var(--primary)", borderRadius: "3px 3px 0 0", opacity: 0.85 }} />)}
      </div>
      <div className="hint ltr" style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>{data[0]?.day.slice(5)}</span><span>{piF(max)}</span><span>{data[data.length - 1]?.day.slice(5)}</span></div>
    </div>
  );
}

type Market = {
  users: number; new_7d: number; profiles: number; portfolio: number; volume_pi: number; fees_pi: number; held_pi: number; deposits_pi: number; deposits_n: number;
  balances_pi: number; withdrawn_pi: number; pending_withdrawals: number; disputes_open: number; deals_open: number; deals_accepted: number;
  tasks: { open: number; claimed: number; submitted: number; approved: number; cancelled: number; via_mcp: number; via_deal: number };
  by_day: { day: string; volume: number; deposits: number }[];
};
function MarketTab({ tr }: { tr: Tr }) {
  const [m, setM] = useState<Market | null>(null);
  const { n } = useFmt();
  useEffect(() => { fetch("/api/admin/market", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then(setM).catch(() => {}); }, []);
  if (!m) return <div className="skeleton" style={{ height: 200 }} />;
  return (
    <div className="grid">
      <div className="kpis">
        <Kpi label={tr("mVolume")} value={piF(m.volume_pi)} sub={tr("mVolumeSub", { n: m.tasks.approved })} tone="ok" />
        <Kpi label={tr("mFees")} value={piF(m.fees_pi)} sub={tr("mFeesSub")} tone="info" />
        <Kpi label={tr("mHeld")} value={piF(m.held_pi)} sub={tr("mHeldSub")} />
        <Kpi label={tr("mDeposits")} value={piF(m.deposits_pi)} sub={tr("mDepositsSub", { n: m.deposits_n })} />
        <Kpi label={tr("mBalances")} value={piF(m.balances_pi)} sub={tr("mBalancesSub", { n: n(m.withdrawn_pi, 2) })} />
        <Kpi label={tr("mOpen")} value={n(m.tasks.open)} sub={tr("mOpenSub", { a: m.tasks.claimed, b: m.tasks.submitted })} />
        <Kpi label={tr("mUsers")} value={n(m.users)} sub={tr("mUsersSub", { n: m.new_7d })} />
        <Kpi label={tr("mProfiles")} value={n(m.profiles)} sub={tr("mProfilesSub", { n: m.portfolio })} />
        <Kpi label={tr("mDeals")} value={n(m.deals_open)} sub={tr("mDealsSub", { n: m.deals_accepted })} />
        <Kpi label={tr("mViaMcp")} value={n(m.tasks.via_mcp)} />
        <Kpi label={tr("mDisp")} value={n(m.disputes_open)} tone={m.disputes_open ? "bad" : undefined} />
        <Kpi label={tr("mWd")} value={n(m.pending_withdrawals)} tone={m.pending_withdrawals ? "bad" : undefined} />
      </div>
      <Bars data={m.by_day.map((d) => ({ day: d.day, v: Number(d.volume) }))} label={tr("chartVol")} />
      <Bars data={m.by_day.map((d) => ({ day: d.day, v: Number(d.deposits) }))} label={tr("chartDep")} />
    </div>
  );
}

type AT = { id: string; title: string; category: string; status: string; draft: boolean; source: string; reward: number; paid: number | null; requester: string; worker: string | null; rating: number | null; created_at: string };
function TasksTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [status, setStatus] = useState("");
  const [list, setList] = useState<AT[] | null>(null);
  const load = useCallback(async () => {
    setList(null);
    const r = await fetch(`/api/admin/tasks?status=${status}`, { credentials: "include", cache: "no-store" });
    setList(r.ok ? (await r.json()).list : []);
  }, [status]);
  useEffect(() => { load(); }, [load]);
  async function cancel(id: string) {
    const r = await post("/api/admin/tasks", { id });
    toast(r.ok ? tr("done") : tr("err")); load();
  }
  return (
    <div className="grid">
      <div className="chips">
        {["", "open", "claimed", "submitted", "approved", "cancelled"].map((s) => (
          <button key={s} className={`pill${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>{s ? tr(`tkS_${s}` as LKey) : tr("tkAll")}</button>
        ))}
      </div>
      {!list ? <div className="skeleton" style={{ height: 160 }} /> : !list.length ? <div className="card empty">{tr("tkNone")}</div> : list.map((t) => (
        <div key={t.id} className="card" style={{ display: "grid", gap: 6 }}>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            <span className="chip">{tr(`tkS_${t.status}` as LKey)}</span>
            {t.draft && <span className="chip warn">{tr("tkDraft")}</span>}
            <span className="chip">{t.category}</span>
            <span className="chip num ltr">{piF(t.reward)}</span>
            {t.source !== "web" && <span className="chip v">{t.source}</span>}
          </div>
          <b style={{ fontSize: 15 }}>{t.title}</b>
          <span className="hint ltr">@{t.requester}{t.worker ? ` → @${t.worker}` : ""}{t.rating ? ` · ${"★".repeat(t.rating)}` : ""}</span>
          {["open", "claimed", "submitted"].includes(t.status) && <button className="btn danger sm" style={{ justifySelf: "start" }} onClick={() => cancel(t.id)}>{tr("tkCancel")}</button>}
        </div>
      ))}
    </div>
  );
}

type Rep = { id: string; kind: string; ref: string | null; reason: string; reporter: string; target: string; target_id: string; banned: boolean; count: number; at: string };
function ReportsTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [list, setList] = useState<Rep[] | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/admin/reports", { credentials: "include", cache: "no-store" }); setList(r.ok ? (await r.json()).list : []); }, []);
  useEffect(() => { load(); }, [load]);
  async function close(id: string, status: string) { const r = await post("/api/admin/reports", { id, status }); toast(r.ok ? tr("done") : tr("err")); load(); }
  async function ban(x: Rep) { const r = await post("/api/admin/decide", { kind: "ban", id: x.target_id, banned: true }); if (r.ok) close(x.id, "done"); else toast(tr("err")); }
  if (!list) return <div className="skeleton" style={{ height: 120 }} />;
  if (!list.length) return <div className="card empty">{tr("rpNone")}</div>;
  return (
    <div className="grid">
      {list.map((x) => (
        <div key={x.id} className="card" style={{ display: "grid", gap: 6 }}>
          <div className="chips" style={{ flexWrap: "wrap" }}><b className="ltr">@{x.target}</b><span className="chip">{x.kind}</span><span className="chip bad num">{tr("rpCount", { n: x.count })}</span>{x.banned && <span className="chip bad">{tr("banned")}</span>}</div>
          <p className="small post-body">{x.reason}</p>
          <span className="hint ltr">{tr("rpBy")} @{x.reporter}</span>
          <div className="row-actions">
            {!x.banned && <button className="btn danger sm" onClick={() => ban(x)}>{tr("rpBan")}</button>}
            <button className="btn sm" onClick={() => close(x.id, "dismissed")}>{tr("rpDismiss")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

type UserRow = { id: string; username: string; role: string; banned: boolean; pi_balance: number; pi_earned: number; pi_withdrawn: number; deposited: number; posted: number; done: number; avg_rating: number | null; has_profile: boolean };
function UsersTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; rows: UserRow[] } | null>(null);
  const { n } = useFmt();
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`, { credentials: "include", cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [q, page]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 760 }}>
            <thead>
              <tr style={{ color: "var(--muted)" }}>
                {(["uProfile", "uPiBal", "uPiEarned", "uWithdrawn", "uDeposited", "uPosted", "uDone", "uRating", ""] as (LKey | "")[]).map((k, i) => (
                  <th key={i} style={{ padding: "10px 12px", textAlign: "start", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>{k ? tr(k) : ""}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <Link className="ltr" href={`/u?name=${encodeURIComponent(u.username)}`}><b>@{u.username}</b></Link>{" "}
                    {u.role !== "user" && <span className="chip v">{u.role}</span>}{" "}
                    {u.has_profile && <span className="chip free">✓</span>}{" "}
                    {u.banned && <span className="chip bad">{tr("banned")}</span>}
                  </td>
                  <td className="num ltr" style={{ padding: "10px 12px", textAlign: "start" }}>{piF(u.pi_balance)}</td>
                  <td className="num ltr" style={{ padding: "10px 12px", textAlign: "start" }}>{piF(u.pi_earned)}</td>
                  <td className="num ltr" style={{ padding: "10px 12px", textAlign: "start" }}>{piF(u.pi_withdrawn)}</td>
                  <td className="num ltr" style={{ padding: "10px 12px", textAlign: "start" }}>{u.deposited ? piF(u.deposited) : "—"}</td>
                  <td className="num" style={{ padding: "10px 12px" }}>{n(u.posted)}</td>
                  <td className="num" style={{ padding: "10px 12px" }}>{n(u.done)}</td>
                  <td className="num" style={{ padding: "10px 12px" }}>{u.avg_rating ? `★ ${u.avg_rating}` : "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{u.role !== "admin" && <button className={`btn sm ${u.banned ? "" : "danger"}`} onClick={() => ban(u)}>{u.banned ? tr("unban") : tr("ban")}</button>}</td>
                </tr>
              ))}
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

const FIELDS: [string, LKey, string][] = [["task_fee_pct", "sFee", "1"], ["new_worker_done", "sNewDone", "1"], ["new_worker_max_pi", "sNewMax", "0.05"], ["mcp_post_daily_pi", "sMcpCap", "0.05"], ["min_withdraw_pi", "sMinWd", "0.1"]];
const DEFAULTS: Record<string, number> = { task_fee_pct: 20, new_worker_done: 3, new_worker_max_pi: 1, mcp_post_daily_pi: 5, min_withdraw_pi: 1 };
function SettingsTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [cfg, setCfg] = useState<Record<string, number> | null>(null);
  useEffect(() => { fetch("/api/admin/config", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d) => setCfg({ ...DEFAULTS, ...(d.config || {}) })).catch(() => setCfg(DEFAULTS)); }, []);
  if (!cfg) return <div className="skeleton" style={{ height: 160 }} />;
  async function save() {
    const body: Record<string, number> = {};
    for (const [k] of FIELDS) body[k] = Number(cfg![k]);
    const r = await post("/api/admin/config", body);
    if (r.ok) { setCfg({ ...DEFAULTS, ...r.data.config }); toast(tr("saved")); } else toast(`${tr("err")} ${r.data?.field ?? ""}`);
  }
  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {FIELDS.map(([k, label, step]) => (
          <label key={k} className="field"><span>{tr(label)}</span>
            <input className="input num" type="number" step={step} value={String(cfg[k] ?? "")} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} />
          </label>
        ))}
      </div>
      <button className="btn primary" style={{ justifySelf: "start" }} onClick={save}>{tr("save")}</button>
    </div>
  );
}

type Dispute = { id: string; task_id: string; title: string; brief: string; reward: number; requester: string; worker: string; reject_note: string | null; worker_note: string; result: { text?: string } | null; files: { id: string; name: string; size: number }[]; created_at: string };
function DisputesTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [list, setList] = useState<Dispute[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/disputes", { credentials: "include", cache: "no-store" });
    setList(r.ok ? (await r.json()).list : []);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function decide(id: string, decision: string) {
    const r = await post("/api/admin/disputes", { id, decision });
    toast(r.ok ? tr("dpDone") : tr("err"));
    load();
  }
  if (!list) return <div className="skeleton" style={{ height: 120 }} />;
  if (!list.length) return <div className="card empty">{tr("dpNone")}</div>;
  return (
    <div className="grid">
      {list.map((d) => (
        <div key={d.id} className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b>{d.title}</b><span className="chip num ltr">{Number(d.reward)} π</span>
            <span className="hint ltr">@{d.requester} → @{d.worker}</span>
          </div>
          {d.brief && <p className="small post-body">{d.brief}</p>}
          <p className="small"><b>{tr("dpReject")}:</b> {d.reject_note || "—"}</p>
          <p className="small"><b>{tr("dpWorkerSays")}:</b> {d.worker_note}</p>
          {d.result?.text && <div className="task-input">{d.result.text}</div>}
          {d.files.length > 0 && <div className="row-actions">{d.files.map((f) => <a key={f.id} className="btn sm" href={`/api/tasks/file?id=${f.id}`}>{f.name}</a>)}</div>}
          <div className="row-actions">
            <button className="btn primary sm" onClick={() => decide(d.id, "worker")}>{tr("dpWorker")}</button>
            <button className="btn sm" onClick={() => decide(d.id, "split")}>{tr("dpSplit")}</button>
            <button className="btn danger sm" onClick={() => decide(d.id, "requester")}>{tr("dpRequester")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

type Wd = { id: string; username: string; pi: number; sent: number | null; address: string | null; status: string; payment_id: string | null; txid: string | null; note: string | null; at: string };
function WithdrawalsTab({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [d, setD] = useState<{ list: Wd[]; ready: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/withdrawals", { credentials: "include" });
    setD(r.ok ? await r.json() : { list: [], ready: false });
  }, []);
  useEffect(() => { load(); }, [load]);
  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    const r = await post("/api/admin/withdrawals", { id, action });
    setBusy(null);
    toast(r.ok ? (action === "approve" ? tr("wdSent") : tr("done")) : `${tr("err")}${r.data?.detail ? `: ${r.data.detail}` : ""}`);
    load();
  }
  if (!d) return <div className="skeleton" style={{ height: 120 }} />;
  return (
    <div className="grid">
      <GrantPi tr={tr} />
      {!d.ready && <div className="notice warn">{tr("wdNoWallet")}</div>}
      {!d.list.length && <div className="card empty">{tr("wdNone")}</div>}
      {d.list.map((w) => (
        <div key={w.id} className="card" style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b className="ltr">@{w.username}</b>
            <span className="chip num ltr">{Number(w.pi).toLocaleString("en-US", { maximumFractionDigits: 4 })} π</span>
            <span className={`chip ${w.status === "sent" ? "free" : w.status === "failed" || w.status === "rejected" ? "bad" : "warn"}`}>{tr(`wdStatus_${w.status}` as LKey)}</span>
            <span className="hint num" style={{ marginInlineStart: "auto" }}>{new Date(w.at).toLocaleString()}</span>
          </div>
          {w.address && <span className="hint ltr" style={{ overflowWrap: "anywhere" }}>→ {w.address}{w.sent != null ? ` · ${Number(w.sent).toLocaleString("en-US", { maximumFractionDigits: 4 })} π` : ""}</span>}
          {w.txid && <span className="hint ltr" style={{ overflowWrap: "anywhere" }}>tx: {w.txid}</span>}
          {w.note && <span className="hint" style={{ overflowWrap: "anywhere" }}>{w.note}</span>}
          {(w.status === "pending" || (w.status === "sending" && w.txid)) && (
            <div className="row-actions">
              <button className="btn primary sm" disabled={!d.ready || busy === w.id} onClick={() => act(w.id, "approve")}>{w.status === "pending" ? tr("wdApprove") : tr("wdRetry")}</button>
              {w.status === "pending" && <button className="btn danger sm" disabled={busy === w.id} onClick={() => act(w.id, "reject")}>{tr("wdReject")}</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GrantPi({ tr }: { tr: Tr }) {
  const { toast } = useApp();
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const pi = Number(amount.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));
    const r = await post("/api/admin/withdrawals", { action: "grant", username, pi });
    setBusy(false);
    if (r.ok) toast(`${tr("grantDone")} @${r.data.username}: ${Number(r.data.balance).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`);
    else toast(r.data?.error === "user_not_found" ? tr("grantNotFound") : tr("err"));
  }
  return (
    <form className="card" onSubmit={grant} style={{ display: "grid", gap: 8 }}>
      <b>{tr("grantTitle")}</b>
      <p className="hint">{tr("grantHint")}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="input ltr" style={{ flex: "2 1 160px" }} placeholder={`@${tr("grantUser")}`} value={username} onChange={(e) => setUsername(e.target.value)} aria-label={tr("grantUser")} />
        <input className="input ltr" style={{ flex: "1 1 90px" }} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={tr("grantAmount")} />
        <button className="btn primary" disabled={busy || !username.trim() || !(Number(amount) > 0)}>{tr("grantBtn")}</button>
      </div>
    </form>
  );
}

