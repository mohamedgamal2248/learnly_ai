/** Privacy policy and terms of use, in Arabic and English. Plain sections rendered by /privacy and /terms. */
export type Section = { h: string; p: string[] };
export type Doc = { title: string; updated: string; sections: Section[] };

const UPDATED = { ar: "آخر تحديث: نوفمبر ٢٠٢٦", en: "Last updated: November 2026" };

export const PRIVACY: Record<"ar" | "en", Doc> = {
  ar: {
    title: "سياسة الخصوصية", updated: UPDATED.ar,
    sections: [
      { h: "مين إحنا", p: ["Learnly AI منصة تعليم بالذكاء الاصطناعي للكبار (+18) جوه منظومة Pi Network. صنّاع الكورسات بيعملوا بوتات وكورسات، والمتعلّمين بيتعلّموا منها."] },
      { h: "البيانات اللي بنجمعها", p: [
        "اسم المستخدم في Pi ومعرّفه، عشان تسجيل الدخول. ما بنطلبش ولا بنخزّن عبارة المرور (Passphrase) أو أي مفتاح خاص.",
        "رصيد الكريدت وسجل المشتريات والمدفوعات (رقم الدفع ومعاملة البلوكتشين).",
        "المحادثات مع البوتات، عشان تقدر ترجعلها، والنص المستخرج من الملفات اللي بترفعها (مش الملف نفسه). الصور بتتبعت للتحليل وما بتتخزنش.",
        "البوستات والردود في المجتمع، وتقدمك في الكورسات والشهادات.",
        "إحصائيات استخدام مجهّلة (Vercel Analytics) من غير كوكيز تتبّع إعلانية.",
      ] },
      { h: "بنستخدمها في إيه", p: ["تشغيل الخدمة، حساب التكلفة والكريدت، منع إساءة الاستخدام، دفع أرباح صنّاع الكورسات، وتحسين المنصة. ما بنبيعش بياناتك ولا بنستخدمها في إعلانات."] },
      { h: "مزوّدي الخدمة", p: ["Pi Network (تسجيل الدخول والمدفوعات)، Meta Model API (الذكاء الاصطناعي)، Supabase (قاعدة البيانات)، Vercel (الاستضافة). بنبعتلهم بس اللي محتاجينه عشان الخدمة تشتغل. البحث في الإنترنت بيبعت نص سؤال البحث بس."] },
      { h: "مدة الاحتفاظ", p: ["المحادثات والحساب بيفضلوا لحد ما تطلب حذفهم. نصوص المرفقات أقصاها ٢٠ ملف لكل مستخدم والأقدم بيتشال. سجلات المدفوعات بنحتفظ بيها للمحاسبة."] },
      { h: "حقوقك", p: ["تقدر تطلب نسخة من بياناتك أو حذف حسابك من خلال المجتمع أو التواصل مع الإدارة. حذف البوست بتاعك متاح من غير طلب."] },
      { h: "الأمان", p: ["المفاتيح السرية على السيرفر بس، والاتصال مشفّر، وقاعدة البيانات مقفولة على وظائف محمية. لو حد طلب منك عبارة المرور باسمنا فهو نصّاب."] },
      { h: "السن", p: ["المنصة للكبار من ١٨ سنة فأكتر بس، تماشياً مع شروط Pi Network."] },
    ],
  },
  en: {
    title: "Privacy Policy", updated: UPDATED.en,
    sections: [
      { h: "Who we are", p: ["Learnly AI is an AI learning platform for adults (18+) in the Pi Network ecosystem. Course creators build bots and courses; learners learn from them."] },
      { h: "Data we collect", p: [
        "Your Pi username and user id, for sign-in. We never ask for or store your wallet passphrase or any private key.",
        "Your credit balance and purchase/payment records (payment id and blockchain transaction).",
        "Your chats with bots, so you can return to them, and the text extracted from files you attach (not the file itself). Images are sent for analysis and not stored.",
        "Community posts and replies, course progress and certificates.",
        "Anonymous usage analytics (Vercel Analytics) without advertising cookies.",
      ] },
      { h: "How we use it", p: ["To run the service, price and charge credits, prevent abuse, pay course creators, and improve the platform. We never sell your data or use it for ads."] },
      { h: "Service providers", p: ["Pi Network (sign-in and payments), Meta Model API (AI), Supabase (database), Vercel (hosting). They receive only what the service needs. Web search sends only the search query text."] },
      { h: "Retention", p: ["Chats and your account stay until you ask us to delete them. Attachment texts are capped at 20 per user (oldest replaced). Payment records are kept for accounting."] },
      { h: "Your rights", p: ["You can ask for a copy of your data or for account deletion through the community or by contacting the admins. You can delete your own posts at any time."] },
      { h: "Security", p: ["Secret keys live on the server only, traffic is encrypted, and the database is only reachable through protected functions. Anyone asking for your passphrase in our name is a scammer."] },
      { h: "Age", p: ["The platform is for adults 18+ only, in line with Pi Network's terms."] },
    ],
  },
};

export const TERMS: Record<"ar" | "en", Doc> = {
  ar: {
    title: "شروط الاستخدام", updated: UPDATED.ar,
    sections: [
      { h: "الموافقة", p: ["استخدامك لـ Learnly AI معناه موافقتك على الشروط دي وعلى شروط Pi Network. لازم يكون سنك ١٨ سنة أو أكتر."] },
      { h: "الكريدت والمدفوعات", p: [
        "الكريدت وحدة استخدام جوه المنصة بتتشحن بعملة Pi بسعر السوق وقت الشراء. مش عملة ولا استثمار وما بتتحوّلش لفلوس.",
        "كل رسالة بتتخصم حسب تكلفتها الفعلية؛ بنحجز الحد الأقصى قبل الرد ونرجّع الفرق بعده. البحث في الإنترنت وقراءة الملفات وإنشاء الملفات ليهم تكلفة إضافية بتظهر قبلها.",
        "المدفوعات على البلوكتشين نهائية. لو حصلت مشكلة تقنية واتخصم منك من غير خدمة، الكريدت بيرجع أوتوماتيك أو تواصل معانا.",
      ] },
      { h: "صنّاع الكورسات", p: [
        "صانع الكورس مسؤول إن المحتوى والملفات ملكه أو عنده حق استخدامها، وإنها دقيقة ومناسبة.",
        "البوتات والكورسات بتتراجع قبل النشر، ومن حقنا نوقف أي محتوى مخالف.",
        "صانع الكورس بياخد ٧٠٪ من رسوم الرسايل ومبيعات الكورسات كأرباح، يقدر يسحبها بعملة Pi حسب الحد الأدنى للسحب ومراجعة الإدارة.",
      ] },
      { h: "الاستخدام المقبول", p: ["ممنوع: الغش في امتحانات رسمية، النصب، طلب عبارات المرور، المحتوى المسيء أو غير القانوني، محاولة اختراق المنصة أو استنزاف خدماتها، والإعلانات المزعجة في المجتمع."] },
      { h: "حدود الذكاء الاصطناعي", p: ["ردود الذكاء الاصطناعي ممكن تغلط. هي للتعليم بس ومش نصيحة طبية أو قانونية أو مالية. اتأكد من المعلومات المهمة من مصادرها."] },
      { h: "الشهادات", p: ["الشهادات بتثبت إنك خلّصت كورس على Learnly AI، وبتتسجّل بصمتها على بلوكتشين Pi للتحقق. مش شهادة أكاديمية معتمدة إلا لو صانع الكورس جهة معتمدة."] },
      { h: "الإيقاف والتعديل", p: ["ممكن نوقف أي حساب بيخالف الشروط. ممكن نعدّل الشروط، وهنعلن عن أي تعديل مهم جوه المنصة."] },
    ],
  },
  en: {
    title: "Terms of Use", updated: UPDATED.en,
    sections: [
      { h: "Agreement", p: ["By using Learnly AI you agree to these terms and to Pi Network's terms. You must be 18 or older."] },
      { h: "Credits and payments", p: [
        "Credits are an in-app usage unit bought with Pi at the market rate at purchase time. They are not a currency or investment and can't be cashed out.",
        "Each message is charged by its actual cost: we reserve the maximum before replying and refund the difference after. Web search, reading files and creating files cost extra, shown beforehand.",
        "Blockchain payments are final. If a technical problem charges you without service, credits are refunded automatically or contact us.",
      ] },
      { h: "Course creators", p: [
        "Creators are responsible for owning or having the right to use their content and files, and for keeping them accurate and appropriate.",
        "Bots and courses are reviewed before publishing, and we may suspend any content that breaks the rules.",
        "Creators earn 70% of message fees and course sales, withdrawable in Pi subject to the minimum withdrawal and admin review.",
      ] },
      { h: "Acceptable use", p: ["Not allowed: cheating in official exams, scams, asking for passphrases, abusive or illegal content, attempts to break into or drain the platform, and spam in the community."] },
      { h: "AI limits", p: ["AI answers can be wrong. They are for education only and are not medical, legal or financial advice. Check important facts at their source."] },
      { h: "Certificates", p: ["Certificates prove you completed a course on Learnly AI, and their fingerprint is recorded on the Pi blockchain for verification. They are not accredited degrees unless the creator is an accredited body."] },
      { h: "Suspension and changes", p: ["We may suspend accounts that break these terms. We may update the terms and will announce important changes in the app."] },
    ],
  },
};
