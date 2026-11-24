/** Privacy policy and terms of use. The interface is English only, so there is one version of each. */
export type Section = { h: string; p: string[] };
export type Doc = { title: string; updated: string; sections: Section[] };

const UPDATED = "Last updated: November 2026";

const privacy: Doc = {
  title: "Privacy Policy", updated: UPDATED,
  sections: [
    { h: "Who we are", p: ["Learnly AI is an English-learning app for adults (18+) in the Pi Network ecosystem. You study short lessons that are explained in your own language (Arabic, Indonesian, Vietnamese or Korean), practise with an AI tutor on paid plans, and pay with Pi."] },
    { h: "Data we collect", p: [
      "Your Pi username and user id, for sign-in. We never ask for or store your wallet passphrase or any private key.",
      "Your learning data: chosen language and level, lessons finished, XP, daily streak and the words you review.",
      "Your credit balance, plan, and payment records (payment id and blockchain transaction).",
      "Messages you send to the AI tutor are sent to our AI provider to produce an answer. We keep a usage record (time, type and credits used), not a copy of the conversation.",
      "If you apply as a teacher: your name, bio, experience and one proof document. Only our review team can open the document, and it is wiped 30 days after we decide.",
      "Anonymous usage analytics (Vercel Analytics) without advertising cookies.",
    ] },
    { h: "How we use it", p: ["To run the lessons, keep your progress, charge plans and credits, prevent abuse, review teacher applications, and improve the app. We never sell your data or use it for ads."] },
    { h: "Service providers", p: ["Pi Network (sign-in and payments), Meta Model API (the AI tutor), Supabase (database), Vercel (hosting). They receive only what the service needs."] },
    { h: "Retention", p: ["Your account and learning data stay until you ask us to delete them. Payment records are kept for accounting."] },
    { h: "Your rights", p: ["You can ask for a copy of your data or for your account to be deleted by contacting the admins through the app."] },
    { h: "Security", p: ["Secret keys live on the server only, traffic is encrypted, and the database is only reachable through protected functions. Anyone asking for your passphrase in our name is a scammer."] },
    { h: "Age", p: ["The app is for adults 18+ only, in line with Pi Network's terms."] },
  ],
};

const terms: Doc = {
  title: "Terms of Use", updated: UPDATED,
  sections: [
    { h: "Agreement", p: ["By using Learnly AI you agree to these terms and to Pi Network's terms. You must be 18 or older."] },
    { h: "Free lessons, plans and credits", p: [
      "Some lessons are free. Plus and Pro open more lessons and the AI tutor.",
      "Plans and credit packs are paid in whole Pi, at the price shown when you buy. The price in Pi can change from time to time. A plan lasts 30 days and does not renew automatically. Buying it again adds 30 days.",
      "AI credits are used inside the app only. They are not money or an investment and cannot be turned back into Pi. Each AI request uses a fixed number of credits shown in the app, and a daily limit applies. If the AI fails to answer, the credits are returned.",
      "Blockchain payments are final. If a technical problem charged you without giving the service, contact us and we will fix it.",
    ] },
    { h: "The AI tutor", p: ["The tutor can make mistakes. Check important answers with a teacher or a reliable source. Do not send private or sensitive information. We may limit use that looks like abuse."] },
    { h: "Lessons and content", p: ["Lessons and their translations are provided to help you learn. We work to keep them accurate, but we do not guarantee exam results or fluency. Content belongs to Learnly AI and may not be copied for resale."] },
    { h: "Teachers", p: ["Live classes with teachers are coming soon. Teacher applications are reviewed by us, and being approved is not a guarantee of classes. Teachers must send only true papers and keep conduct respectful."] },
    { h: "Acceptable use", p: ["No abuse, harassment, scams or attempts to break or overload the app, and no sharing of your account. We can suspend accounts that break these rules."] },
    { h: "Changes and liability", p: ["We may update the app and these terms. The app is provided as is; to the extent the law allows, we are not liable for indirect losses. Continued use means you accept the updated terms."] },
  ],
};

export const PRIVACY: Record<"ar" | "en", Doc> = { ar: privacy, en: privacy };
export const TERMS: Record<"ar" | "en", Doc> = { ar: terms, en: terms };
