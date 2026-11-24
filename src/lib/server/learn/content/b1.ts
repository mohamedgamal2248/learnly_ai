import { W, l4, type Lesson, type Unit } from "../types";

export const UNITS: Unit[] = [
  { id: "u7", level: "B1", title: "Opinions and plans", titleTr: l4(["الآراء والخطط", "Pendapat dan rencana", "Ý kiến và kế hoạch", "의견과 계획"]), icon: "💬" },
];

export const LESSONS: Lesson[] = [
  {
    id: "b1-19", n: 19, level: "B1", unit: "u7", tier: "pro", title: "Giving your opinion",
    titleTr: l4(["إبداء الرأي", "Menyampaikan pendapat", "Nêu ý kiến", "의견 말하기"]),
    intro: l4([
      "لإبداء رأيك قل «I think…» أو «In my opinion…». وللموافقة «I agree» وللمعارضة «I disagree». وأضف «because» لتشرح السبب، فهذا يجعل كلامك أكثر إقناعًا.",
      "Untuk menyampaikan pendapat, katakan «I think…» atau «In my opinion…». Untuk setuju «I agree», tidak setuju «I disagree». Tambahkan «because» untuk menjelaskan alasan agar kamu lebih meyakinkan.",
      "Để nêu ý kiến, nói «I think…» hoặc «In my opinion…». Đồng ý là «I agree», không đồng ý là «I disagree». Thêm «because» để giải thích lý do, lời nói sẽ thuyết phục hơn.",
      "의견을 말할 때는 «I think…»나 «In my opinion…»을 써요. 동의는 «I agree», 반대는 «I disagree»예요. «because»로 이유를 덧붙이면 더 설득력 있어요.",
    ]),
    words: [
      W("I think", ["أعتقد", "Saya pikir", "Tôi nghĩ", "저는 ~라고 생각해요"], "I think English is useful.", ["أعتقد أن الإنجليزية مفيدة.", "Saya pikir bahasa Inggris itu berguna.", "Tôi nghĩ tiếng Anh rất hữu ích.", "저는 영어가 유용하다고 생각해요."]),
      W("I agree", ["أوافق", "Saya setuju", "Tôi đồng ý", "저도 동의해요"], "I agree with you.", ["أوافقك الرأي.", "Saya setuju denganmu.", "Tôi đồng ý với bạn.", "저는 당신 말에 동의해요."]),
      W("I disagree", ["لا أوافق", "Saya tidak setuju", "Tôi không đồng ý", "저는 동의하지 않아요"], "I disagree, because it is too expensive.", ["لا أوافق، لأنه غالٍ جدًا.", "Saya tidak setuju, karena terlalu mahal.", "Tôi không đồng ý vì nó quá đắt.", "너무 비싸서 동의하지 않아요."]),
      W("in my opinion", ["في رأيي", "menurut saya", "theo ý kiến của tôi", "제 생각에는"], "In my opinion, it is a good plan.", ["في رأيي، إنها خطة جيدة.", "Menurut saya, itu rencana yang bagus.", "Theo tôi, đó là một kế hoạch tốt.", "제 생각에는 좋은 계획이에요."]),
      W("maybe", ["ربما", "mungkin", "có lẽ", "아마도"], "Maybe we can meet tomorrow.", ["ربما نلتقي غدًا.", "Mungkin kita bisa bertemu besok.", "Có lẽ ngày mai chúng ta gặp nhau.", "아마 내일 만날 수 있을 거예요."]),
      W("because", ["لأن", "karena", "bởi vì", "왜냐하면"], "I study because I want a better job.", ["أدرس لأنني أريد وظيفة أفضل.", "Saya belajar karena ingin pekerjaan yang lebih baik.", "Tôi học vì muốn có công việc tốt hơn.", "더 좋은 직업을 갖고 싶어서 공부해요."]),
    ],
  },
  {
    id: "b1-20", n: 20, level: "B1", unit: "u7", tier: "pro", title: "Talking about the past",
    titleTr: l4(["الحديث عن الماضي", "Bercerita tentang masa lalu", "Kể về quá khứ", "과거 이야기하기"]),
    intro: l4([
      "للحديث عن الماضي نستخدم الماضي البسيط: went (ذهب)، saw (رأى)، forgot (نسي). بعض الأفعال لا تضيف ed بل تتغير: go ← went. وكلمات مثل yesterday وlast week تدل على الماضي.",
      "Untuk membicarakan masa lalu kita pakai past simple: went (pergi), saw (melihat), forgot (lupa). Beberapa kata kerja tidak memakai ed tetapi berubah bentuk: go → went. Kata seperti yesterday dan last week menandakan masa lalu.",
      "Để nói về quá khứ ta dùng thì quá khứ đơn: went (đã đi), saw (đã thấy), forgot (đã quên). Một số động từ không thêm ed mà đổi dạng: go → went. Các từ như yesterday và last week báo hiệu quá khứ.",
      "과거 이야기는 단순 과거로 해요: went(갔다), saw(보았다), forgot(잊었다). 어떤 동사는 ed를 붙이지 않고 모양이 바뀌어요: go → went. yesterday, last week 같은 말이 과거를 나타내요.",
    ]),
    words: [
      W("yesterday", ["أمس", "kemarin", "hôm qua", "어제"], "I studied English yesterday.", ["درست الإنجليزية أمس.", "Saya belajar bahasa Inggris kemarin.", "Hôm qua tôi đã học tiếng Anh.", "저는 어제 영어를 공부했어요."]),
      W("last week", ["الأسبوع الماضي", "minggu lalu", "tuần trước", "지난주"], "We traveled last week.", ["سافرنا الأسبوع الماضي.", "Kami bepergian minggu lalu.", "Chúng tôi đã đi du lịch tuần trước.", "우리는 지난주에 여행했어요."]),
      W("I went", ["ذهبت", "Saya pergi", "Tôi đã đi", "저는 갔어요"], "I went to the market.", ["ذهبت إلى السوق.", "Saya pergi ke pasar.", "Tôi đã đi chợ.", "저는 시장에 갔어요."]),
      W("I saw", ["رأيت", "Saya melihat", "Tôi đã thấy", "저는 봤어요"], "I saw a great movie.", ["شاهدت فيلمًا رائعًا.", "Saya menonton film yang bagus.", "Tôi đã xem một bộ phim hay.", "저는 멋진 영화를 봤어요."]),
      W("I forgot", ["نسيت", "Saya lupa", "Tôi đã quên", "저는 잊어버렸어요"], "I forgot my keys.", ["نسيت مفاتيحي.", "Saya lupa kunci saya.", "Tôi đã quên chìa khóa.", "저는 열쇠를 잊어버렸어요."]),
      W("I remember", ["أتذكر", "Saya ingat", "Tôi nhớ", "저는 기억해요"], "I remember my first day.", ["أتذكر يومي الأول.", "Saya ingat hari pertama saya.", "Tôi nhớ ngày đầu tiên của mình.", "저는 첫날을 기억해요."]),
    ],
  },
  {
    id: "b1-21", n: 21, level: "B1", unit: "u7", tier: "pro", title: "Plans and the future",
    titleTr: l4(["الخطط والمستقبل", "Rencana dan masa depan", "Kế hoạch và tương lai", "계획과 미래"]),
    intro: l4([
      "نستخدم «I'm going to» للخطط المقررة، و«I will» للقرارات السريعة أو الوعود. وللأمل نقول «I hope to». ويمكنك الحديث عن هدفك بكلمة goal.",
      "Kita memakai «I'm going to» untuk rencana yang sudah diputuskan, dan «I will» untuk keputusan spontan atau janji. Untuk harapan, katakan «I hope to». Kamu bisa membahas tujuanmu dengan kata goal.",
      "Dùng «I'm going to» cho kế hoạch đã định, và «I will» cho quyết định nhanh hoặc lời hứa. Với hy vọng, nói «I hope to». Bạn có thể nói về mục tiêu bằng từ goal.",
      "이미 정한 계획에는 «I'm going to», 즉석 결정이나 약속에는 «I will»을 써요. 바람은 «I hope to»로 말해요. 목표는 goal이라고 해요.",
    ]),
    words: [
      W("next year", ["العام القادم", "tahun depan", "năm sau", "내년"], "I will visit London next year.", ["سأزور لندن العام القادم.", "Saya akan mengunjungi London tahun depan.", "Năm sau tôi sẽ thăm London.", "저는 내년에 런던에 갈 거예요."]),
      W("I'm going to", ["سوف", "Saya akan", "Tôi sẽ", "저는 ~할 거예요"], "I'm going to study every day.", ["سوف أدرس كل يوم.", "Saya akan belajar setiap hari.", "Tôi sẽ học mỗi ngày.", "저는 매일 공부할 거예요."]),
      W("I will", ["سوف", "Saya akan (spontan)", "Tôi sẽ (quyết định ngay)", "제가 ~할게요"], "I will help you.", ["سأساعدك.", "Saya akan membantumu.", "Tôi sẽ giúp bạn.", "제가 도와드릴게요."]),
      W("plan", ["خطة", "rencana", "kế hoạch", "계획"], "What is your plan?", ["ما هي خطتك؟", "Apa rencanamu?", "Kế hoạch của bạn là gì?", "계획이 뭐예요?"]),
      W("hope", ["يأمل", "berharap", "hy vọng", "바라다"], "I hope to speak English well.", ["آمل أن أتحدث الإنجليزية جيدًا.", "Saya berharap bisa berbahasa Inggris dengan baik.", "Tôi hy vọng nói tiếng Anh giỏi.", "영어를 잘하고 싶어요."]),
      W("goal", ["هدف", "tujuan", "mục tiêu", "목표"], "My goal is to pass the test.", ["هدفي أن أنجح في الاختبار.", "Tujuan saya adalah lulus ujian.", "Mục tiêu của tôi là đỗ kỳ thi.", "제 목표는 시험에 합격하는 거예요."]),
    ],
  },
];
