import { W, l4, type Lesson, type Unit } from "../types";

export const UNITS: Unit[] = [
  { id: "u5", level: "A2", title: "Work and study", titleTr: l4(["العمل والدراسة", "Kerja dan belajar", "Công việc và học tập", "일과 공부"]), icon: "💼" },
  { id: "u6", level: "A2", title: "Travel and eating out", titleTr: l4(["السفر والمطاعم", "Perjalanan dan makan di luar", "Du lịch và ăn ngoài", "여행과 외식"]), icon: "✈️" },
];

export const LESSONS: Lesson[] = [
  {
    id: "a2-13", n: 13, level: "A2", unit: "u5", tier: "plus", title: "Jobs",
    titleTr: l4(["المهن", "Pekerjaan", "Nghề nghiệp", "직업"]),
    intro: l4([
      "نقول «I am a» قبل المهنة: «I am a doctor». وإذا بدأت المهنة بحرف صوتي نقول «an»: «an engineer». وللسؤال: «What do you do?».",
      "Kita bilang «I am a» sebelum pekerjaan: «I am a doctor». Jika pekerjaan diawali bunyi vokal, pakai «an»: «an engineer». Untuk bertanya: «What do you do?».",
      "Ta nói «I am a» trước nghề: «I am a doctor». Nếu nghề bắt đầu bằng nguyên âm thì dùng «an»: «an engineer». Để hỏi: «What do you do?».",
      "직업 앞에는 «I am a»를 써요: «I am a doctor». 모음으로 시작하면 «an»을 써요: «an engineer». 직업을 물을 때는 «What do you do?»라고 해요.",
    ]),
    words: [
      W("doctor", ["طبيب", "dokter", "bác sĩ", "의사"], "My aunt is a doctor.", ["عمتي طبيبة.", "Bibi saya seorang dokter.", "Dì tôi là bác sĩ.", "제 이모는 의사예요."]),
      W("teacher", ["معلم", "guru", "giáo viên", "선생님"], "The teacher is kind.", ["المعلم لطيف.", "Gurunya baik hati.", "Giáo viên rất tốt bụng.", "선생님은 친절해요."]),
      W("engineer", ["مهندس", "insinyur", "kỹ sư", "엔지니어"], "He is an engineer.", ["هو مهندس.", "Dia seorang insinyur.", "Anh ấy là kỹ sư.", "그는 엔지니어예요."]),
      W("driver", ["سائق", "sopir", "tài xế", "운전기사"], "The driver is waiting outside.", ["السائق ينتظر في الخارج.", "Sopirnya menunggu di luar.", "Tài xế đang đợi bên ngoài.", "운전기사가 밖에서 기다려요."]),
      W("student", ["طالب", "pelajar", "học sinh", "학생"], "I am a student.", ["أنا طالب.", "Saya seorang pelajar.", "Tôi là học sinh.", "저는 학생이에요."]),
      W("What do you do?", ["ماذا تعمل؟", "Pekerjaanmu apa?", "Bạn làm nghề gì?", "무슨 일을 하세요?"], "What do you do? I'm a nurse.", ["ماذا تعمل؟ أنا ممرضة.", "Pekerjaanmu apa? Saya perawat.", "Bạn làm nghề gì? Tôi là y tá.", "무슨 일을 하세요? 저는 간호사예요."]),
    ],
  },
  {
    id: "a2-14", n: 14, level: "A2", unit: "u5", tier: "plus", title: "School and study",
    titleTr: l4(["المدرسة والدراسة", "Sekolah dan belajar", "Trường học và việc học", "학교와 공부"]),
    intro: l4([
      "للحديث عن الواجبات نقول «do homework» وليس «make homework». ونقول «take an exam» لأداء الاختبار، و«ask a question» لطرح سؤال.",
      "Untuk membicarakan tugas, kita bilang «do homework», bukan «make homework». Kita bilang «take an exam» untuk ujian, dan «ask a question» untuk bertanya.",
      "Khi nói về bài tập, ta dùng «do homework», không phải «make homework». Ta nói «take an exam» khi thi, và «ask a question» khi đặt câu hỏi.",
      "숙제는 «do homework»라고 하고 «make homework»라고 하지 않아요. 시험은 «take an exam», 질문은 «ask a question»이라고 해요.",
    ]),
    words: [
      W("book", ["كتاب", "buku", "quyển sách", "책"], "Open your book, please.", ["افتح كتابك من فضلك.", "Tolong buka bukumu.", "Hãy mở sách của bạn ra.", "책을 펴 주세요."]),
      W("homework", ["واجب منزلي", "pekerjaan rumah", "bài tập về nhà", "숙제"], "I do my homework after school.", ["أحل واجبي بعد المدرسة.", "Saya mengerjakan PR setelah sekolah.", "Tôi làm bài tập sau giờ học.", "저는 방과 후에 숙제를 해요."]),
      W("exam", ["اختبار", "ujian", "kỳ thi", "시험"], "The exam is on Friday.", ["الاختبار يوم الجمعة.", "Ujiannya hari Jumat.", "Kỳ thi vào thứ Sáu.", "시험은 금요일이에요."]),
      W("lesson", ["درس", "pelajaran", "bài học", "수업"], "Today's lesson is easy.", ["درس اليوم سهل.", "Pelajaran hari ini mudah.", "Bài học hôm nay dễ.", "오늘 수업은 쉬워요."]),
      W("question", ["سؤال", "pertanyaan", "câu hỏi", "질문"], "I have a question.", ["لدي سؤال.", "Saya punya pertanyaan.", "Tôi có một câu hỏi.", "질문이 있어요."]),
      W("answer", ["إجابة", "jawaban", "câu trả lời", "대답"], "Do you know the answer?", ["هل تعرف الإجابة؟", "Apakah kamu tahu jawabannya?", "Bạn có biết câu trả lời không?", "정답을 알아요?"]),
    ],
  },
  {
    id: "a2-15", n: 15, level: "A2", unit: "u5", tier: "plus", title: "Time and schedules",
    titleTr: l4(["الوقت والمواعيد", "Waktu dan jadwal", "Thời gian và lịch trình", "시간과 일정"]),
    intro: l4([
      "نسأل عن الوقت بـ «What time is it?» ونجيب «It's three o'clock». ونستخدم «in the morning/afternoon/evening» لأجزاء اليوم، و«at night» لليل.",
      "Kita menanyakan waktu dengan «What time is it?» dan menjawab «It's three o'clock». Bagian hari: «in the morning/afternoon/evening», tetapi «at night» untuk malam.",
      "Hỏi giờ bằng «What time is it?» và trả lời «It's three o'clock». Các buổi trong ngày: «in the morning/afternoon/evening», riêng đêm dùng «at night».",
      "시간은 «What time is it?»로 묻고 «It's three o'clock»으로 답해요. 하루의 때는 «in the morning/afternoon/evening»이라 하고, 밤은 «at night»이라고 해요.",
    ]),
    words: [
      W("morning", ["صباح", "pagi", "buổi sáng", "아침"], "I run in the morning.", ["أركض في الصباح.", "Saya berlari di pagi hari.", "Tôi chạy bộ vào buổi sáng.", "저는 아침에 달려요."]),
      W("afternoon", ["بعد الظهر", "siang/sore", "buổi chiều", "오후"], "We meet in the afternoon.", ["نلتقي بعد الظهر.", "Kami bertemu di siang hari.", "Chúng ta gặp nhau vào buổi chiều.", "우리는 오후에 만나요."]),
      W("evening", ["مساء", "malam (petang)", "buổi tối", "저녁"], "I cook in the evening.", ["أطبخ في المساء.", "Saya memasak di malam hari.", "Tôi nấu ăn vào buổi tối.", "저는 저녁에 요리해요."]),
      W("early", ["مبكرًا", "awal", "sớm", "일찍"], "I get up early.", ["أستيقظ مبكرًا.", "Saya bangun pagi-pagi.", "Tôi dậy sớm.", "저는 일찍 일어나요."]),
      W("late", ["متأخرًا", "terlambat", "muộn", "늦게"], "Sorry, I am late.", ["آسف، أنا متأخر.", "Maaf, saya terlambat.", "Xin lỗi, tôi đến muộn.", "죄송해요, 제가 늦었어요."]),
      W("What time is it?", ["كم الساعة؟", "Jam berapa sekarang?", "Mấy giờ rồi?", "지금 몇 시예요?"], "What time is it? It's noon.", ["كم الساعة؟ إنها الظهر.", "Jam berapa sekarang? Sudah tengah hari.", "Mấy giờ rồi? Đã trưa rồi.", "지금 몇 시예요? 정오예요."]),
    ],
  },
  {
    id: "a2-16", n: 16, level: "A2", unit: "u6", tier: "plus", title: "At the airport",
    titleTr: l4(["في المطار", "Di bandara", "Ở sân bay", "공항에서"]),
    intro: l4([
      "في المطار ستسمع كلمات مثل «boarding pass» و«gate». للسؤال عن الرحلة قل «Which gate is my flight?». وتذكّر أن «passport» جواز السفر.",
      "Di bandara kamu akan mendengar kata seperti «boarding pass» dan «gate». Untuk menanyakan penerbangan, katakan «Which gate is my flight?». Ingat «passport» adalah paspor.",
      "Ở sân bay bạn sẽ nghe các từ như «boarding pass» và «gate». Để hỏi chuyến bay, nói «Which gate is my flight?». Nhớ «passport» là hộ chiếu.",
      "공항에서는 «boarding pass», «gate» 같은 말을 듣게 돼요. 비행기 탑승구를 물을 때는 «Which gate is my flight?»라고 해요. «passport»는 여권이에요.",
    ]),
    words: [
      W("ticket", ["تذكرة", "tiket", "vé", "표"], "I have my ticket.", ["معي تذكرتي.", "Saya membawa tiket saya.", "Tôi có vé rồi.", "표를 가지고 있어요."]),
      W("passport", ["جواز سفر", "paspor", "hộ chiếu", "여권"], "Show your passport, please.", ["أرني جواز سفرك من فضلك.", "Tolong tunjukkan paspormu.", "Làm ơn cho xem hộ chiếu.", "여권을 보여 주세요."]),
      W("flight", ["رحلة جوية", "penerbangan", "chuyến bay", "항공편"], "My flight is at nine.", ["رحلتي في التاسعة.", "Penerbangan saya jam sembilan.", "Chuyến bay của tôi lúc chín giờ.", "제 비행기는 아홉 시예요."]),
      W("luggage", ["أمتعة", "bagasi", "hành lý", "짐"], "Where is my luggage?", ["أين أمتعتي؟", "Di mana bagasi saya?", "Hành lý của tôi ở đâu?", "제 짐은 어디에 있어요?"]),
      W("gate", ["بوابة", "gerbang", "cổng ra máy bay", "게이트"], "Go to gate twelve.", ["اذهب إلى البوابة اثنتي عشرة.", "Pergilah ke gerbang dua belas.", "Hãy đến cổng số mười hai.", "12번 게이트로 가세요."]),
      W("airport", ["مطار", "bandara", "sân bay", "공항"], "The airport is very big.", ["المطار كبير جدًا.", "Bandaranya sangat besar.", "Sân bay rất lớn.", "공항은 아주 커요."]),
    ],
  },
  {
    id: "a2-17", n: 17, level: "A2", unit: "u6", tier: "plus", title: "At a hotel",
    titleTr: l4(["في الفندق", "Di hotel", "Ở khách sạn", "호텔에서"]),
    intro: l4([
      "عند الوصول قل «I have a reservation» أي لدي حجز. «Check in» عند الدخول و«check out» عند المغادرة. اسأل «Is breakfast included?» لتعرف إن كان الفطور مشمولًا.",
      "Saat tiba, katakan «I have a reservation» (saya punya reservasi). «Check in» saat masuk dan «check out» saat keluar. Tanyakan «Is breakfast included?» untuk tahu apakah sarapan termasuk.",
      "Khi đến, nói «I have a reservation» (tôi đã đặt phòng). «Check in» là nhận phòng, «check out» là trả phòng. Hỏi «Is breakfast included?» để biết có gồm bữa sáng không.",
      "도착하면 «I have a reservation»(예약했어요)이라고 말해요. «Check in»은 체크인, «check out»은 체크아웃이에요. «Is breakfast included?»로 조식 포함 여부를 물어보세요.",
    ]),
    words: [
      W("reservation", ["حجز", "reservasi", "đặt phòng", "예약"], "I have a reservation.", ["لدي حجز.", "Saya punya reservasi.", "Tôi đã đặt phòng.", "예약했어요."]),
      W("check in", ["تسجيل الدخول", "lapor masuk", "nhận phòng", "체크인"], "I want to check in.", ["أريد تسجيل الدخول.", "Saya ingin check in.", "Tôi muốn nhận phòng.", "체크인하고 싶어요."]),
      W("check out", ["تسجيل الخروج", "lapor keluar", "trả phòng", "체크아웃"], "We check out at noon.", ["نغادر عند الظهر.", "Kami check out saat siang.", "Chúng tôi trả phòng lúc trưa.", "우리는 정오에 체크아웃해요."]),
      W("breakfast", ["فطور", "sarapan", "bữa sáng", "아침 식사"], "Is breakfast included?", ["هل الفطور مشمول؟", "Apakah sarapan sudah termasuk?", "Giá có gồm bữa sáng không?", "아침 식사가 포함되어 있나요?"]),
      W("towel", ["منشفة", "handuk", "khăn tắm", "수건"], "Can I have another towel?", ["هل يمكن الحصول على منشفة أخرى؟", "Boleh saya minta handuk lagi?", "Cho tôi thêm một cái khăn tắm được không?", "수건을 하나 더 주시겠어요?"]),
      W("Wi-Fi", ["واي فاي", "Wi-Fi", "Wi-Fi", "와이파이"], "What is the Wi-Fi password?", ["ما كلمة مرور الواي فاي؟", "Apa kata sandi Wi-Fi-nya?", "Mật khẩu Wi-Fi là gì?", "와이파이 비밀번호가 뭐예요?"]),
    ],
  },
  {
    id: "a2-18", n: 18, level: "A2", unit: "u6", tier: "plus", title: "At a restaurant",
    titleTr: l4(["في المطعم", "Di restoran", "Ở nhà hàng", "식당에서"]),
    intro: l4([
      "في المطعم تطلب بقول «I'd like…». وتطلب الفاتورة بقول «Can I have the bill, please?». للوصف: delicious لذيذ، hungry جائع، thirsty عطشان.",
      "Di restoran kamu memesan dengan «I'd like…». Minta tagihan dengan «Can I have the bill, please?». Untuk mendeskripsikan: delicious enak, hungry lapar, thirsty haus.",
      "Ở nhà hàng bạn gọi món bằng «I'd like…». Xin hóa đơn bằng «Can I have the bill, please?». Mô tả: delicious ngon, hungry đói, thirsty khát.",
      "식당에서는 «I'd like…»로 주문해요. 계산서는 «Can I have the bill, please?»라고 요청해요. delicious는 맛있는, hungry는 배고픈, thirsty는 목마른이에요.",
    ]),
    words: [
      W("menu", ["قائمة الطعام", "menu", "thực đơn", "메뉴"], "Can I see the menu?", ["هل يمكنني رؤية القائمة؟", "Boleh saya lihat menunya?", "Cho tôi xem thực đơn được không?", "메뉴를 볼 수 있을까요?"]),
      W("order", ["يطلب", "memesan", "gọi món", "주문하다"], "I'd like to order, please.", ["أود أن أطلب من فضلك.", "Saya ingin memesan, tolong.", "Tôi muốn gọi món.", "주문하고 싶어요."]),
      W("bill", ["فاتورة", "tagihan", "hóa đơn", "계산서"], "Can I have the bill, please?", ["هل يمكنني الحصول على الفاتورة من فضلك؟", "Boleh saya minta tagihannya?", "Cho tôi xin hóa đơn.", "계산서 주시겠어요?"]),
      W("delicious", ["لذيذ", "enak", "ngon", "맛있는"], "The soup is delicious.", ["الشوربة لذيذة.", "Supnya enak.", "Món súp rất ngon.", "수프가 맛있어요."]),
      W("hungry", ["جائع", "lapar", "đói", "배고픈"], "I am very hungry.", ["أنا جائع جدًا.", "Saya sangat lapar.", "Tôi rất đói.", "저는 배가 많이 고파요."]),
      W("thirsty", ["عطشان", "haus", "khát", "목마른"], "Are you thirsty?", ["هل أنت عطشان؟", "Apakah kamu haus?", "Bạn có khát không?", "목마르세요?"]),
    ],
  },
];
