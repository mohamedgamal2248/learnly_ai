"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";

const LESSONS = {
  ar: [
    {
      title: "أمان المحفظة",
      points: [
        "الـpassphrase (الـ24 كلمة) هي مفتاح محفظتك. أي حد يعرفها يقدر ياخد كل اللي فيها.",
        "ما تكتبهاش في أي تطبيق أو موقع أو شات، ولا حتى لحد بيقول إنه من فريق Pi. فريق Pi عمره ما هيطلبها.",
        "اكتبها على ورق واحتفظ بيها في مكان آمن. ما تصوّرهاش وما تحفظهاش في الـNotes.",
        "ادفع من جوه Pi Browser بس، واتأكد إن شاشة الدفع جاية من المحفظة نفسها.",
        "أي عرض بيوعدك بمضاعفة الباي أو هدايا مقابل إنك تبعت باي الأول هو نصب.",
      ],
      link: "https://minepi.com",
    },
    {
      title: "ابنِ أول تطبيق Pi",
      points: [
        "سجّل تطبيقك من Developer Portal جوه Pi Browser (develop.pi)، واختار Testnet في الأول.",
        "حط رابط تطبيقك، وخد الـAPI Key واحفظه على السيرفر بس، عمره ما يظهر في المتصفح.",
        "التسجيل بيبقى بـ Pi.authenticate، والسيرفر لازم يتأكد من التوكن عن طريق api.minepi.com/v2/me.",
        "الدفع من المستخدم للتطبيق (U2A) ليه 3 خطوات: إنشاء الدفع، وموافقة السيرفر، وإكمال السيرفر بعد ما المستخدم يوقّع.",
        "ما تفتحش أي ميزة مدفوعة غير بعد ما السيرفر يكمّل الدفع بنجاح.",
      ],
      link: "https://pi-apps.github.io/pi-sdk-docs",
    },
  ],
  en: [
    {
      title: "Wallet safety",
      points: [
        "Your passphrase (24 words) is the key to your wallet. Anyone who has it can take everything in it.",
        "Never type it into any app, website or chat, not even for someone claiming to be the Pi team. The Pi team will never ask for it.",
        "Write it on paper and keep it somewhere safe. Don't photograph it or save it in notes.",
        "Only pay inside Pi Browser, and check that the payment screen comes from the wallet itself.",
        "Any offer to double your Pi or send gifts if you send Pi first is a scam.",
      ],
      link: "https://minepi.com",
    },
    {
      title: "Build your first Pi app",
      points: [
        "Register your app in the Developer Portal inside Pi Browser (develop.pi) and start on Testnet.",
        "Add your app URL and keep the API key on your server only; it must never reach the browser.",
        "Sign-in uses Pi.authenticate, and your server must verify the token with api.minepi.com/v2/me.",
        "User-to-app (U2A) payments have three steps: create the payment, server approval, and server completion after the user signs.",
        "Never unlock a paid feature until your server has completed the payment.",
      ],
      link: "https://pi-apps.github.io/pi-sdk-docs",
    },
  ],
};

export default function AcademyPage() {
  const { t, lang } = useApp();
  return (
    <div className="grid" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="card">
        <h1 style={{ fontSize: 20 }}>{t("acTitle")} <span className="chip free">{t("free")}</span></h1>
        <p className="muted small">{t("acSub")}</p>
      </div>
      <div className="grid stagger">
        {LESSONS[lang].map((l) => (
          <section key={l.title} className="card lesson">
            <h2>{l.title}</h2>
            <ul>{l.points.map((p) => <li key={p}>{p}</li>)}</ul>
            <a className="link ltr" href={l.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10 }}>{l.link.replace("https://", "")}</a>
          </section>
        ))}
      </div>
      <Link className="btn primary" href="/chat">{t("nChat")}</Link>
    </div>
  );
}
