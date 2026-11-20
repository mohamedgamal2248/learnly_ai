/** Free Pi Academy lessons. Shared by the page and the server (which checks quiz answers before issuing a certificate). */
export type Q = { q: string; options: string[]; answer: number };
export type Lesson = { id: string; title: string; points: string[]; quiz: Q[]; link: string };

export const LESSONS: Record<"ar" | "en", Lesson[]> = {
  ar: [
    {
      id: "wallet", title: "أمان المحفظة", link: "https://minepi.com",
      points: [
        "الـpassphrase (الـ24 كلمة) هي مفتاح محفظتك. أي حد يعرفها يقدر ياخد كل اللي فيها، ومفيش حد يقدر يرجّعهولك.",
        "ما تكتبهاش في أي تطبيق أو موقع أو شات، حتى لو حد قال إنه من فريق Pi. فريق Pi عمره ما هيطلبها.",
        "اكتبها على ورق واحتفظ بيها في مكان آمن. ما تصوّرهاش، وما تحفظهاش في الـNotes أو الإيميل.",
        "لو حسيت إن حد عرفها، انقل فلوسك لمحفظة جديدة فورًا.",
      ],
      quiz: [
        { q: "مين ممكن تديله الـpassphrase بتاعتك؟", options: ["فريق دعم Pi", "ولا حد خالص", "صاحبك اللي بتثق فيه"], answer: 1 },
        { q: "أأمن مكان تحفظ فيه الـpassphrase؟", options: ["صورة في الجاليري", "ورقة في مكان آمن", "تطبيق الملاحظات"], answer: 1 },
      ],
    },
    {
      id: "scams", title: "اكشف النصب", link: "https://minepi.com",
      points: [
        "أي حد بيوعدك يضاعف الباي بتاعك لو بعتله الأول هو نصّاب.",
        "رسايل \"حسابك هيتقفل لو ما دخلتش من اللينك ده\" غالبًا تصيّد. ادخل من Pi Browser نفسه بس.",
        "ما تشتريش ولا تبيعش باي مع حد ما تعرفوش برّه التطبيقات الرسمية.",
        "لو حد ضغط عليك علشان تقرر بسرعة، ده علامة نصب.",
      ],
      quiz: [
        { q: "حد بيقولك ابعت 10 باي وهرجعلك 20. ده إيه؟", options: ["عرض حلو", "نصب", "تجربة من Pi"], answer: 1 },
        { q: "جالك لينك بيقول حسابك هيتمسح لو ما دخلتش. تعمل إيه؟", options: ["أدخل بسرعة", "أتجاهله وأدخل من Pi Browser بس", "أبعته لصحابي"], answer: 1 },
      ],
    },
    {
      id: "browser", title: "استخدام Pi Browser والتطبيقات بأمان", link: "https://minepi.com",
      points: [
        "أكّد أي دفع من شاشة المحفظة اللي بتظهر جوه Pi Browser، واقرا المبلغ كويس قبل ما توافق.",
        "باي الـTestnet للتجربة بس وملوش قيمة حقيقية، وده غير باي الـMainnet.",
        "التطبيق المحترم بيطلب أقل بيانات ممكنة، ومش هيطلب منك كلمات المحفظة.",
        "لو تطبيق طلب منك تدفع برّه Pi Browser، اتأكد كويس قبل أي خطوة.",
      ],
      quiz: [
        { q: "تأكّد الدفع فين؟", options: ["شاشة محفظة Pi جوه Pi Browser", "أي موقع يطلب كده", "رسالة على تليجرام"], answer: 0 },
        { q: "باي الـTestnet:", options: ["ليه نفس قيمة الـMainnet", "للتجربة بس وملوش قيمة", "بيتحوّل لدولار"], answer: 1 },
      ],
    },
    {
      id: "build", title: "ابنِ أول تطبيق Pi", link: "https://pi-apps.github.io/pi-sdk-docs",
      points: [
        "سجّل تطبيقك من Developer Portal جوه Pi Browser (develop.pi)، وابدأ على Testnet.",
        "حط رابط تطبيقك، وخد الـAPI Key واحفظه على السيرفر بس، عمره ما يظهر في المتصفح.",
        "تسجيل الدخول بيبقى بـ Pi.authenticate، والسيرفر لازم يتأكد من التوكن من api.minepi.com/v2/me.",
        "الدفع من المستخدم للتطبيق (U2A) ليه 3 خطوات: إنشاء الدفع، موافقة السيرفر، وإكمال السيرفر بعد ما المستخدم يوقّع.",
        "ما تفتحش أي ميزة مدفوعة غير بعد ما السيرفر يكمّل الدفع بنجاح.",
      ],
      quiz: [
        { q: "الـAPI Key مكانه فين؟", options: ["في كود المتصفح", "على السيرفر بس", "في رابط التطبيق"], answer: 1 },
        { q: "امتى تفتح الميزة المدفوعة؟", options: ["أول ما المستخدم يدوس ادفع", "بعد ما السيرفر يكمّل الدفع", "قبل الدفع"], answer: 1 },
      ],
    },
  ],
  en: [
    {
      id: "wallet", title: "Wallet safety", link: "https://minepi.com",
      points: [
        "Your passphrase (24 words) is the key to your wallet. Anyone who has it can take everything, and nobody can get it back for you.",
        "Never type it into any app, website or chat, even for someone claiming to be the Pi team. The Pi team will never ask for it.",
        "Write it on paper and keep it somewhere safe. Don't photograph it or save it in notes or email.",
        "If you think someone saw it, move your funds to a new wallet right away.",
      ],
      quiz: [
        { q: "Who can you give your passphrase to?", options: ["Pi support", "Nobody at all", "A friend you trust"], answer: 1 },
        { q: "The safest place to keep your passphrase?", options: ["A photo in your gallery", "Paper in a safe place", "A notes app"], answer: 1 },
      ],
    },
    {
      id: "scams", title: "Spot scams", link: "https://minepi.com",
      points: [
        "Anyone promising to double your Pi if you send some first is a scammer.",
        "\"Your account will be closed unless you log in through this link\" is usually phishing. Only use Pi Browser itself.",
        "Don't buy or sell Pi with strangers outside official apps.",
        "Pressure to decide fast is a classic sign of a scam.",
      ],
      quiz: [
        { q: "Someone says: send 10 Pi and get 20 back. This is…", options: ["A great deal", "A scam", "A Pi test"], answer: 1 },
        { q: "A link says your account will be deleted. What do you do?", options: ["Log in quickly", "Ignore it and only use Pi Browser", "Share it with friends"], answer: 1 },
      ],
    },
    {
      id: "browser", title: "Using Pi Browser and apps safely", link: "https://minepi.com",
      points: [
        "Confirm every payment on the wallet screen inside Pi Browser, and check the amount before approving.",
        "Testnet Pi is only for testing and has no real value; it's not Mainnet Pi.",
        "A trustworthy app asks for as little data as possible and never asks for your wallet words.",
        "If an app asks you to pay outside Pi Browser, check carefully before doing anything.",
      ],
      quiz: [
        { q: "Where do you confirm a payment?", options: ["The Pi wallet screen in Pi Browser", "Any site that asks", "A Telegram message"], answer: 0 },
        { q: "Testnet Pi…", options: ["Is worth the same as Mainnet", "Is for testing and has no value", "Converts to dollars"], answer: 1 },
      ],
    },
    {
      id: "build", title: "Build your first Pi app", link: "https://pi-apps.github.io/pi-sdk-docs",
      points: [
        "Register your app in the Developer Portal inside Pi Browser (develop.pi) and start on Testnet.",
        "Add your app URL and keep the API key on your server only; it must never reach the browser.",
        "Sign-in uses Pi.authenticate, and your server must verify the token with api.minepi.com/v2/me.",
        "User-to-app (U2A) payments have three steps: create the payment, server approval, and server completion after the user signs.",
        "Never unlock a paid feature until your server has completed the payment.",
      ],
      quiz: [
        { q: "Where does the API key live?", options: ["In browser code", "On the server only", "In the app URL"], answer: 1 },
        { q: "When do you unlock a paid feature?", options: ["When the user taps pay", "After the server completes the payment", "Before payment"], answer: 1 },
      ],
    },
  ],
};


/** Correct answers per lesson (same in both languages). */
export const ACADEMY_KEYS: Record<string, number[]> = Object.fromEntries(LESSONS.en.map((l) => [l.id, l.quiz.map((q) => q.answer)]));
