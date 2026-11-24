# Sheet format. Each lesson: t (title ar|id|vi|ko), i (tip ar|id|vi|ko), w = [(word, 'ar|id|vi|ko', mode, opts)]
# mode: 'T' = accept the Tatoeba pick as is | {lang: text} = accept it but replace/fill these languages | [en,ar,id,vi,ko] = custom sentence
# opts: d = display term, b = word to blank out in fill-in exercises
S = {}
S['a1-01'] = dict(
 t='التحية والمجاملة|Salam dan sopan santun|Chào hỏi và lịch sự|인사와 예의',
 i="«Hello» تصلح لكل الناس. «Good morning» حتى الظهر، و«Good afternoon» بعده. نقول «please» عند الطلب و«thank you» بعد المساعدة، ويرد الطرف الآخر «You're welcome».|«Hello» cocok untuk siapa saja. «Good morning» sampai siang, lalu «Good afternoon». Ucapkan «please» saat meminta dan «thank you» setelah dibantu; jawabannya «You're welcome».|«Hello» dùng với mọi người. «Good morning» đến trưa, sau đó là «Good afternoon». Nói «please» khi nhờ và «thank you» sau khi được giúp; người kia đáp «You're welcome».|«Hello»는 누구에게나 쓸 수 있어요. «Good morning»은 낮까지, 그 뒤에는 «Good afternoon»을 써요. 부탁할 때 «please», 도움을 받으면 «thank you»라고 하고, 상대는 «You're welcome»이라고 답해요.",
 w=[
  ('hello','مرحبًا|Halo|Xin chào|안녕하세요',{'id':'Halo, apa kabar?'},{}),
  ('bye','إلى اللقاء|Sampai jumpa|Tạm biệt|안녕히 가세요',{'vi':'Tạm biệt nhé.','ko':'안녕, 또 봐요.'},{}),
  ('please','من فضلك|Tolong|Làm ơn|부탁합니다',{'id':'Tolong jangan menangis.'},{}),
  ('thank','شكرًا|Terima kasih|Cảm ơn|감사합니다',{'id':'Terima kasih banyak!','vi':'Cảm ơn bạn rất nhiều!'},{'d':'thank you','b':'Thanks'}),
  ('sorry','آسف|Maaf|Xin lỗi|죄송합니다',{'ar':'آسف، لقد تأخرت.','ko':'늦어서 죄송해요.'},{}),
  ('welcome','عفوًا|Sama-sama|Không có chi|천만에요','T',{'d':"You're welcome",'b':'welcome'}),
  ('morning','صباح|Pagi|Buổi sáng|아침','T',{'d':'Good morning','b':'morning'}),
  ('afternoon','بعد الظهر|Sore|Buổi chiều|오후',{'id':'Dia menelepon saya pada sore hari.','ko':'그녀는 오후에 나에게 전화했다.'},{}),
 ])
S['a1-02'] = dict(
 t='عنّي|Tentang saya|Về tôi|나에 대해',
 i="للتعريف بنفسك: «My name is…» و«I am a teacher/student» و«I live in…». للسؤال: «What's your name?» و«Can you speak…?».|Untuk memperkenalkan diri: «My name is…», «I am a teacher/student», «I live in…». Untuk bertanya: «What's your name?» dan «Can you speak…?».|Để giới thiệu: «My name is…», «I am a teacher/student», «I live in…». Để hỏi: «What's your name?» và «Can you speak…?».|자기소개는 «My name is…», «I am a teacher/student», «I live in…»로 해요. 질문은 «What's your name?», «Can you speak…?»라고 해요.",
 w=[
  ('name','اسم|nama|tên|이름',{'ko':'이름이 뭐예요?'},{}),
  ('age','عمر|umur|tuổi|나이',['What is your age?','ما عمرك؟','Berapa umurmu?','Bạn bao nhiêu tuổi?','나이가 어떻게 되세요?'],{}),
  ('live','يسكن / يعيش|tinggal|sống|살다',{'ar':'أنا أسكن هنا.'},{}),
  ('speak','يتحدث|berbicara|nói|말하다',{'ar':'هل تستطيع التحدث بالفرنسية؟','ko':'프랑스어를 말할 수 있어요?'},{}),
  ('student','طالب|pelajar / siswa|học sinh / sinh viên|학생',{'id':'Kami adalah pelajar.','ko':'우리는 학생이에요.'},{}),
  ('teacher','معلم|guru|giáo viên|선생님',{'vi':'Tôi là giáo viên.','ko':'저는 선생님이에요.'},{}),
  ('friend','صديق|teman|bạn|친구',{'ko':'그는 제 친구예요.'},{}),
  ('happy','سعيد|senang / bahagia|vui / hạnh phúc|행복한',['I am happy today.','أنا سعيد اليوم.','Aku senang hari ini.','Hôm nay tôi vui.','저는 오늘 행복해요.'],{}),
 ])
S['a1-03'] = dict(
 t='الأرقام|Angka|Các con số|숫자',
 i="الأرقام الأولى تُحفظ كما هي: one, two, three… ونسأل عن العدد بـ «How many?». بعد الرقم يأتي الاسم غالبًا بصيغة الجمع: two cats، three apples.|Angka-angka awal dihafal apa adanya: one, two, three… Kita bertanya jumlah dengan «How many?». Setelah angka, kata benda biasanya jamak: two cats, three apples.|Các số đầu tiên cần học thuộc: one, two, three… Hỏi số lượng bằng «How many?». Sau số từ 2 trở lên, danh từ thường ở dạng số nhiều: two cats, three apples.|처음 숫자는 그대로 외워요: one, two, three… 수량은 «How many?»로 물어요. 2 이상의 숫자 뒤에는 보통 복수형 명사가 와요: two cats, three apples.",
 w=[
  ('one','واحد|satu|một|하나',['I have one book.','عندي كتاب واحد.','Saya punya satu buku.','Tôi có một quyển sách.','저는 책이 한 권 있어요.'],{}),
  ('two','اثنان|dua|hai|둘',{'ar':'عندي قطتان.'},{}),
  ('three','ثلاثة|tiga|ba|셋',['There are three apples.','هناك ثلاث تفاحات.','Ada tiga apel.','Có ba quả táo.','사과가 세 개 있어요.'],{}),
  ('four','أربعة|empat|bốn|넷',['The table has four legs.','للطاولة أربع أرجل.','Meja itu punya empat kaki.','Cái bàn có bốn chân.','탁자에는 다리가 네 개 있어요.'],{}),
  ('five','خمسة|lima|năm|다섯',['There are five students.','يوجد خمسة طلاب.','Ada lima pelajar.','Có năm học sinh.','학생이 다섯 명 있어요.'],{}),
  ('six','ستة|enam|sáu|여섯',['I have six books.','عندي ستة كتب.','Saya punya enam buku.','Tôi có sáu quyển sách.','저는 책이 여섯 권 있어요.'],{}),
  ('seven','سبعة|tujuh|bảy|일곱',['We need seven chairs.','نحتاج إلى سبعة كراسي.','Kami butuh tujuh kursi.','Chúng tôi cần bảy cái ghế.','의자가 일곱 개 필요해요.'],{}),
  ('eight','ثمانية|delapan|tám|여덟',['She has eight pens.','لديها ثمانية أقلام.','Dia punya delapan pulpen.','Cô ấy có tám cây bút.','그녀는 펜이 여덟 자루 있어요.'],{}),
 ])
S['a1-04'] = dict(
 t='العائلة|Keluarga|Gia đình|가족',
 i="نقول «my» قبل أفراد العائلة: my mother, my father. في الإندونيسية والفيتنامية والكورية تختلف كلمة الأخ/الأخت حسب الأكبر والأصغر، أما الإنجليزية فتستخدم brother وsister فقط.|Kita memakai «my» sebelum anggota keluarga: my mother, my father. Bahasa Inggris hanya punya brother dan sister, tanpa pembeda kakak atau adik seperti dalam bahasa Indonesia.|Ta dùng «my» trước người thân: my mother, my father. Tiếng Anh chỉ có brother và sister, không phân biệt anh/em, chị/em như tiếng Việt.|가족 앞에는 «my»를 붙여요: my mother, my father. 영어에는 형·오빠·동생을 구분하는 말이 없고 brother와 sister만 써요.",
 w=[
  ('mother','أم|ibu|mẹ|어머니',{'ar':'هل أمك في المنزل؟','vi':'Mẹ bạn có ở nhà không?','ko':'어머니는 집에 계세요?'},{}),
  ('father','أب|ayah|bố / cha|아버지',['My father is at work.','أبي في العمل.','Ayah saya sedang bekerja.','Bố tôi đang đi làm.','아버지는 일하고 계세요.'],{}),
  ('brother','أخ|saudara laki-laki|anh / em trai|남자 형제',['I have one brother.','لدي أخ واحد.','Saya punya satu saudara laki-laki.','Tôi có một người em trai.','저는 남동생이 한 명 있어요.'],{}),
  ('sister','أخت|saudara perempuan|chị / em gái|여자 형제',['My sister is ten.','أختي عمرها عشر سنوات.','Adik perempuan saya berumur sepuluh tahun.','Em gái tôi mười tuổi.','제 여동생은 열 살이에요.'],{}),
  ('son','ابن|putra / anak laki-laki|con trai|아들',['Their son is a doctor.','ابنهم طبيب.','Putra mereka seorang dokter.','Con trai họ là bác sĩ.','그들의 아들은 의사예요.'],{}),
  ('daughter','ابنة|putri / anak perempuan|con gái|딸',{'vi':'Ông ấy hôn lên trán con gái mình.'},{}),
  ('parent','والد / والدان|orang tua|bố mẹ / phụ huynh|부모',{'ko':'부모님과 함께 살아요?'},{}),
  ('family','عائلة|keluarga|gia đình|가족',{'ar':'كيف حال عائلتك؟','ko':'가족은 잘 지내요?'},{}),
 ])
S['a1-05'] = dict(
 t='الناس|Orang-orang|Con người|사람들',
 i="الجمع غير المنتظم: man ← men، woman ← women، child ← children، person ← people. احفظها كما هي.|Bentuk jamak tidak beraturan: man → men, woman → women, child → children, person → people. Hafalkan apa adanya.|Số nhiều bất quy tắc: man → men, woman → women, child → children, person → people. Hãy học thuộc.|불규칙 복수형이 있어요: man → men, woman → women, child → children, person → people. 그대로 외워 두세요.",
 w=[
  ('man','رجل|laki-laki / pria|đàn ông|남자',{'vi':'Tôi là đàn ông.','ko':'저는 남자예요.'},{}),
  ('woman','امرأة|perempuan / wanita|phụ nữ|여자',{'vi':'Tôi là phụ nữ.','ko':'저는 여자예요.'},{}),
  ('boy','صبي / ولد|anak laki-laki|cậu bé|남자아이',['The boy is playing.','الصبي يلعب.','Anak laki-laki itu sedang bermain.','Cậu bé đang chơi.','남자아이가 놀고 있어요.'],{}),
  ('girl','فتاة / بنت|anak perempuan|cô bé|여자아이',['The girl is reading a book.','الفتاة تقرأ كتابًا.','Anak perempuan itu sedang membaca buku.','Cô bé đang đọc sách.','여자아이가 책을 읽고 있어요.'],{}),
  ('child','طفل|anak|đứa trẻ|아이',{'ko':'어떤 아이든 그건 할 수 있어요.'},{}),
  ('people','ناس|orang|người / mọi người|사람들','T',{}),
  ('husband','زوج|suami|chồng|남편',{'id':'Dia suamiku.','vi':'Anh ấy là chồng tôi.'},{}),
  ('wife','زوجة|istri|vợ|아내',{'id':'Dia istriku.','vi':'Cô ấy là vợ tôi.'},{}),
 ])
S['a1-06'] = dict(
 t='الطعام|Makanan|Đồ ăn|음식',
 i="بعض الأطعمة لا تُعد، فلا نقول «a rice» أو «a bread». نقول «some rice» أو «a piece of bread». ونعبّر عن الحب بـ «I like…».|Beberapa makanan tidak bisa dihitung, jadi tidak ada «a rice» atau «a bread». Katakan «some rice» atau «a piece of bread». Untuk menyukai sesuatu: «I like…».|Một số đồ ăn không đếm được nên không nói «a rice» hay «a bread». Hãy nói «some rice» hoặc «a piece of bread». Để nói thích: «I like…».|셀 수 없는 음식이 있어서 «a rice», «a bread»라고 하지 않아요. «some rice», «a piece of bread»라고 해요. 좋아한다고 말할 때는 «I like…»를 써요.",
 w=[
  ('bread','خبز|roti|bánh mì|빵',{'ko':'저는 빵을 먹고 있어요.'},{}),
  ('rice','أرز|nasi|cơm|밥 / 쌀',{'ar':'أحب الأرز.','id':'Saya suka nasi.','ko':'저는 밥을 좋아해요.'},{}),
  ('egg','بيضة|telur|trứng|달걀',['I eat an egg every morning.','آكل بيضة كل صباح.','Saya makan satu telur setiap pagi.','Sáng nào tôi cũng ăn một quả trứng.','저는 아침마다 달걀을 하나 먹어요.'],{}),
  ('milk','حليب|susu|sữa|우유',{'id':'Saya minum susu.'},{}),
  ('water','ماء|air|nước|물','T',{}),
  ('fruit','فاكهة|buah|trái cây|과일',{'ar':'أحب الفاكهة.','id':'Saya suka buah.','vi':'Tôi thích trái cây.'},{}),
  ('meat','لحم|daging|thịt|고기',{'ko':'사자는 고기를 먹어요.'},{}),
  ('fish','سمك|ikan|cá|물고기 / 생선',{'ko':'물고기는 물속에 살아요.'},{}),
 ])
S['a1-07'] = dict(
 t='الوجبات والمشروبات|Makan dan minum|Bữa ăn và đồ uống|식사와 음료',
 i="الوجبات الثلاث: breakfast وlunch وdinner، ولا نضع قبلها «a» عادة: «I have lunch at one». للطلب: «Can I have a coffee?».|Tiga waktu makan: breakfast, lunch, dinner, biasanya tanpa «a»: «I have lunch at one». Untuk memesan: «Can I have a coffee?».|Ba bữa ăn: breakfast, lunch, dinner, thường không dùng «a»: «I have lunch at one». Khi gọi đồ: «Can I have a coffee?».|세 끼 식사는 breakfast, lunch, dinner이고 보통 «a»를 붙이지 않아요: «I have lunch at one». 주문할 때는 «Can I have a coffee?»라고 해요.",
 w=[
  ('breakfast','فطور|sarapan / makan pagi|bữa sáng|아침 식사',{'ar':'صنعنا الفطائر للفطور.'},{}),
  ('lunch','غداء|makan siang|bữa trưa|점심',{'ar':'لنتناول الغداء.','vi':'Chúng ta ăn trưa nhé.'},{}),
  ('dinner','عشاء|makan malam|bữa tối / cơm tối|저녁 식사',{'ar':'تارو، العشاء جاهز.','ko':'다로, 저녁 준비됐어!'},{}),
  ('coffee','قهوة|kopi|cà phê|커피',{'ko':'저는 커피를 좋아하지 않아요.'},{}),
  ('tea','شاي|teh|trà|차',{'ar':'هل تشرب الشاي الأخضر؟','id':'Apakah kamu minum teh hijau?'},{}),
  ('apple','تفاحة|apel|quả táo|사과',{'vi':'Chúng tôi đang ăn táo.'},{}),
  ('eat','يأكل|makan|ăn|먹다',['I eat breakfast at eight.','أتناول الفطور في الثامنة.','Saya sarapan jam delapan.','Tôi ăn sáng lúc tám giờ.','저는 여덟 시에 아침을 먹어요.'],{}),
  ('drink','يشرب|minum|uống|마시다','T',{}),
 ])
S['a1-08'] = dict(
 t='في المنزل|Di rumah|Ở nhà|집에서',
 i="لتحديد المكان: «in» للداخل و«on» للسطح: «The book is on the table». وللسؤال: «Where is the…?».|Untuk menunjukkan tempat: «in» untuk di dalam dan «on» untuk di atas permukaan: «The book is on the table». Untuk bertanya: «Where is the…?».|Để chỉ vị trí: «in» là bên trong, «on» là trên bề mặt: «The book is on the table». Để hỏi: «Where is the…?».|위치를 말할 때 «in»은 안, «on»은 표면 위예요: «The book is on the table». 위치를 물을 때는 «Where is the…?»라고 해요.",
 w=[
  ('house','منزل|rumah|ngôi nhà|집',{'id':'Itu rumahnya.'},{}),
  ('room','غرفة|kamar|căn phòng|방',{'vi':'Dọn phòng của bạn đi.','ko':'네 방을 치워라.'},{}),
  ('door','باب|pintu|cửa|문','T',{}),
  ('window','نافذة|jendela|cửa sổ|창문',{'id':'Dia memecahkan jendela.','ko':'그는 창문을 깼다.'},{}),
  ('bed','سرير|tempat tidur|giường|침대','T',{}),
  ('kitchen','مطبخ|dapur|nhà bếp|부엌',{'ar':'نحن ذاهبون إلى المطبخ.','id':'Kami pergi ke dapur.','vi':'Chúng tôi đi vào bếp.'},{}),
  ('table','طاولة|meja|cái bàn|탁자 / 책상',{'vi':'Quyển sách ở trên bàn.'},{}),
  ('chair','كرسي|kursi|cái ghế|의자',{'vi':'Cái ghế này xấu.','ko':'이 의자는 못생겼어요.'},{}),
 ])
