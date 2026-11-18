import { QBBook, QBChapter, QBQuestion } from './questionBankTypes';

export function generateChaptersForBook(bookId: string, bookTitle: string = ''): QBChapter[] {
  const isArabicOrQuran = /কুরআন|তাজবীদ|কায়দা|আমপারা|হরফ|আরবি|আরবী|হাদিস|ফিকহ|আকাইদ|নাজেরা|মিযান|নাহু|সরফ|বালাগাত|মানতিক|উসুল|তাফসীর|বুখারী|মুসলিম|তিরমিযী|আবু দাউদ|নাসায়ী|ইবনে মাজাহ|মিশকাত|হিদায়া|জালালাইন|কাফিয়া|শরহে/i.test(bookTitle);
  const isEnglish = /english|reader|grammar|phonics|radiant|oxford|cambridge/i.test(bookTitle);

  if (isEnglish) {
    return [
      {
        id: `${bookId}-ch-1`,
        book_id: bookId,
        chapter_no: 1,
        title: 'Unit 1: Reading Comprehension & Vocabulary (1st Term)'
      },
      {
        id: `${bookId}-ch-2`,
        book_id: bookId,
        chapter_no: 2,
        title: 'Unit 2: Grammar, Parts of Speech & Sentence Making (2nd Term)'
      },
      {
        id: `${bookId}-ch-3`,
        book_id: bookId,
        chapter_no: 3,
        title: 'Unit 3: Translation, Dialogue & Composition (Final Term)'
      },
      {
        id: `${bookId}-ch-4`,
        book_id: bookId,
        chapter_no: 4,
        title: 'Unit 4: Model Test & Comprehensive Review'
      }
    ];
  }

  return [
    {
      id: `${bookId}-ch-1`,
      book_id: bookId,
      chapter_no: 1,
      title: isArabicOrQuran
        ? '১ম অধ্যায়: প্রাথমিক মাখরাজ, হরকত ও মৌলিক পাঠ (১ম সাময়িক)'
        : '১ম অধ্যায়: প্রারম্ভিক পাঠ ও মৌলিক ধারণা (১ম সাময়িক)'
    },
    {
      id: `${bookId}-ch-2`,
      book_id: bookId,
      chapter_no: 2,
      title: isArabicOrQuran
        ? '২য় অধ্যায়: তানভীন, সাকিন ও তাজবীদ বিধান (২য় সাময়িক)'
        : '২য় অধ্যায়: মধ্যবর্তী বিষয়বস্তু ও অনুশীলন (২য় সাময়িক)'
    },
    {
      id: `${bookId}-ch-3`,
      book_id: bookId,
      chapter_no: 3,
      title: isArabicOrQuran
        ? '৩য় অধ্যায়: নির্বাচিত সূরা, হাদিস ও বিশুদ্ধ পাঠ (বার্ষিক)'
        : '৩য় অধ্যায়: বিস্তারিত আলোচনা ও অধ্যায়ভিত্তিক পাঠ (বার্ষিক)'
    },
    {
      id: `${bookId}-ch-4`,
      book_id: bookId,
      chapter_no: 4,
      title: '৪র্থ অধ্যায়: পুনরালোচনা, মডেল প্রশ্ন ও চূড়ান্ত প্রস্তুতি'
    }
  ];
}

export function generateQuestionsForBook(book: QBBook, existingChapters?: QBChapter[]): QBQuestion[] {
  const bId = book.id;
  const title = book.title || 'পাঠ্যবই';
  const isArabicOrQuran = /কুরআন|তাজবীদ|কায়দা|আমপারা|হরফ|আরবি|আরবী|হাদিস|ফিকহ|আকাইদ|নাজেরা|মিযান|নাহু|সরফ|বালাগাত|মানতিক|উসুল|তাফসীর|বুখারী|মুসলিম|তিরমিযী|আবু দাউদ|নাসায়ী|ইবনে মাজাহ|মিশকাত|হিদায়া|জালালাইন|কাফিয়া|শরহে|দোয়া|মাসআলা|সীরাত/i.test(title);
  const isMath = /গণিত|অঙ্ক|math|ধারাপাত|জ্যামিতি|algebra|arithmetic|calculus/i.test(title);
  const isEnglish = /english|reader|grammar|phonics|radiant|oxford|cambridge/i.test(title);

  const chapters =
    existingChapters && existingChapters.length > 0
      ? existingChapters
      : generateChaptersForBook(bId, title);

  const chIds = chapters.map((c) => c.id);
  const getCh = (index: number) => chIds[index % chIds.length];

  const qs: QBQuestion[] = [];

  if (isArabicOrQuran) {
    // Base pools for Arabic / Quran / Hadith / Fiqh
    const mcqPool = [
      { q: 'আরবি হরফ মোট কয়টি?', opts: ['২৭ টি', '২৮ টি', '২৯ টি', '৩০ টি'], ans: '২৯ টি' },
      { q: 'মাখরাজ মোট কয়টি?', opts: ['১৫ টি', '১৬ টি', '১৭ টি', '১৯ টি'], ans: '১৭ টি' },
      { q: 'মদ্দের হরফ কয়টি?', opts: ['২ টি', '৩ টি', '৪ টি', '৫ টি'], ans: '৩ টি' },
      { q: 'নুন সাকিন ও তানভীনের হুকুম কয়টি?', opts: ['৩ টি', '৪ টি', '৫ টি', '৬ টি'], ans: '৪ টি' },
      { q: 'ওয়াজিব গুন্নাহর হরফ কয়টি ও কী কী?', opts: ['২ টি (নুন ও মীম মুশদ্দাদ)', '৪ টি', '৫ টি', '৬ টি'], ans: '২ টি (নুন ও মীম মুশদ্দাদ)' },
      { q: 'কলক্বলাহর হরফ মোট কয়টি?', opts: ['৩ টি', '৪ টি', '৫ টি', '৭ টি'], ans: '৫ টি' },
      { q: 'কুরআন মাজীদে মোট পারার সংখ্যা কত?', opts: ['২৫ টি', '২৮ টি', '৩০ টি', '৩২ টি'], ans: '৩০ টি' },
      { q: 'কুরআন মাজীদে মোট সূরার সংখ্যা কতটি?', opts: ['১১০ টি', '১১২ টি', '১১৪ টি', '১১৬ টি'], ans: '১১৪ টি' },
      { q: 'ইযহার শব্দের আভিধানিক অর্থ কী?', opts: ['গোপন করা', 'স্পষ্ট করে পড়া', 'মিলিয়ে পড়া', 'পরিবর্তন করা'], ans: 'স্পষ্ট করে পড়া' },
      { q: 'ইকলাব-এর হরফ কোনটি?', opts: ['মীম (م)', 'বা (ب)', 'নুন (ن)', 'ওয়াও (و)'], ans: 'বা (ب)' },
      { q: 'হলকের হরফ কয়টি?', opts: ['৪ টি', '৫ টি', '৬ টি', '৭ টি'], ans: '৬ টি' },
      { q: 'মীম সাকিনের হুকুম কয়টি?', opts: ['২ টি', '৩ টি', '৪ টি', '৫ টি'], ans: '৩ টি' },
    ];

    const fbPool = [
      { q: 'হরকত বলা হয় এক জবর, এক যের, এক _____ কে।', ans: 'পেশ' },
      { q: 'তানভীন বলা হয় দুই জবর, দুই যের, দুই _____ কে।', ans: 'পেশ' },
      { q: 'কলক্বলাহ এর হরফ মোট _____ টি (কুতবু জাদ)।', ans: '৫' },
      { q: 'কুরআন মাজীদের সর্বপ্রথম সূরার নাম সূরা আল-_____।', ans: 'ফাতিহা' },
      { q: 'ইখফা শব্দের অর্থ _____ করে গুন্নাহসহ পড়া।', ans: 'গোপন' },
      { q: 'কুরআন মাজীদের সবচেয়ে ফযীলতপূর্ণ আয়াত হলো _____।', ans: 'আয়াতুল কুরসী' },
      { q: 'জযমওয়ালা হরফকে _____ হরফ বলা হয়।', ans: 'সাকিন' },
      { q: 'তাজবীদ সহকারে কুরআন মাজীদ তিলাওয়াত করা _____।', ans: 'ওয়াজিব' },
    ];

    const oneWordPool = [
      { q: 'হরফ উচ্চারণের স্থানকে কী বলা হয়?', ans: 'মাখরাজ' },
      { q: 'কুরআন মাজীদের হৃদপিণ্ড বলা হয় কোন সূরাকে?', ans: 'সূরা ইয়াসীন' },
      { q: 'তানভীন বা নুন সাকিনের পর বা (ب) আসলে কোন হুকুম হয়?', ans: 'ইকলাব' },
      { q: 'তিন আলিফ বা চার আলিফ টেনে পড়াকে কী বলে?', ans: 'মদ্দ' },
    ];

    const wordMeaningPool = [
      { q: 'শব্দের অর্থ লেখ: রব (رَبّ), রহমত (رَحْمَة), ইলম (عِلْم), সিরাত (صِرَاط)', ans: 'রব = প্রতিপালক, রহমত = দয়া, ইলম = জ্ঞান, সিরাত = পথ' },
      { q: 'শব্দের অর্থ লেখ: সালাত (صَلَاة), সওম (صَوْم), যাকাত (زَكَاة), হজ্জ (حَجّ)', ans: 'সালাত = নামাজ, সওম = রোজা, যাকাত = পবিত্রতা/দান, হজ্জ = সংকল্প' },
      { q: 'শব্দের অর্থ লেখ: জান্নাত (جَنَّة), নূর (نُور), হিদায়াত (هِدَايَة), তাকওয়া (تَقْوَى)', ans: 'জান্নাত = বাগান, নূর = আলো, হিদায়াত = সঠিক পথ, তাকওয়া = খোদাভীতি' },
      { q: 'শব্দের অর্থ লেখ: শোকর (شُكْر), সবর (صَبْر), আদব (أَدَب), আখলাক (أَخْلَاق)', ans: 'শোকর = কৃতজ্ঞতা, সবর = ধৈর্য, আদব = শিষ্টাচার, আখলাক = চরিত্র' },
    ];

    const tfPool = [
      { q: 'সত্য বা মিথ্যা লেখ: আরবি হরফ মোট ২৯টি এবং মাখরাজ ১৭টি।', ans: 'সত্য' },
      { q: 'সত্য বা মিথ্যা লেখ: নুন ও মীম হরফে তাশদীদ হলে ওয়াজিব গুন্নাহ করে পড়তে হয়।', ans: 'সত্য' },
      { q: 'সত্য বা মিথ্যা লেখ: ইযহারের হরফ মোট ১৫টি।', ans: 'মিথ্যা (৬টি)' },
      { q: 'সত্য বা মিথ্যা লেখ: কুরআন মাজীদ বিনা অযুতে স্পর্শ করা জায়েয নয়।', ans: 'সত্য' },
    ];

    const shortPool = [
      { q: 'মাখরাজ কাকে বলে? মাখরাজ কয়টি ও কী কী সংক্ষেপে লেখ।', ans: 'আরবি হরফ উচ্চারণের স্থানকে মাখরাজ বলে। মাখরাজ মোট ১৭টি।' },
      { q: 'ইযহার ও ইখফা কাকে বলে? উদাহরণসহ লেখ।', ans: 'নুন সাকিন বা তানভীনের পর হরফে হালকী আসলে স্পষ্ট করে পড়াকে ইযহার এবং ইখফার ১৫ হরফ আসলে গুন্নাহসহ পড়াকে ইখফা বলে।' },
      { q: 'কলক্বলাহ কাকে বলে? কলক্বলাহর হরফ কয়টি ও কী কী?', ans: 'ক্বাফ, ত্বা, বা, জীম, দাল—এই ৫টি হরফে জযম হলে ধাক্কা দিয়ে পড়াকে কলক্বলাহ বলে।' },
      { q: 'ওয়াজিব গুন্নাহ কাকে বলে? উদাহরণ দাও।', ans: 'নুন বা মীম হরফে তাশদীদ হলে এক আলিফ পরিমাণ গুন্নাহ করে পড়া ওয়াজিব। যেমন: إِنَّ, ثُمَّ।' },
      { q: 'মদ্দে আসলী বা ত্ববায়ী কাকে বলে? উদাহরণসহ লেখ।', ans: 'মদ্দের হরফের পর হামযাহ বা সাকিন না থাকলে এক আলিফ টেনে পড়াকে মদ্দে আসলী বলে। যেমন: نُوحِيهَا।' },
      { q: 'তিলাওয়াতের আদবসমূহ থেকে ৪টি আদব উল্লেখ করো।', ans: '১. অযুসহ বসা, ২. কিবলামুখী হওয়া, ৩. আউযুবিল্লাহ-বিসমিল্লাহ পড়া, ৪. তাজবীদসহ ধীরস্থিরভাবে পড়া।' },
    ];

    const broadPool = [
      { q: 'নুন সাকিন ও তানভীনের চারটি হুকুম (ইযহার, ইদগাম, ইকলাব, ইখফা) উদাহরণসহ বিস্তারিত আলোচনা করো।' },
      { q: 'সূরা আল-ফাতিহার বাংলা অনুবাদ, শানে নুযূল ও ফযীলত নিজের ভাষায় বিস্তারিত লেখ।' },
      { q: 'মীম সাকিনের হুকুম কয়টি ও কী কী? প্রত্যেক প্রকারের পরিচয় ও আরবি উদাহরণসহ বর্ণনা করো।' },
      { q: `${title} কিতাবের আলোকে বিশুদ্ধ তিলাওয়াত ও আমলের গুরুত্ব বিস্তারিতভাবে আলোচনা করো।` },
    ];

    const matchingPool = [
      {
        q: 'বাম পাশের হরফের সাথে ডান পাশের মাখরাজ মিল করো:',
        left: ['বা, মীম, ওয়াও (ب م و)', 'ফা (ف)', 'ক্বাফ (ق)', 'হামযাহ, হা (ء هـ)'],
        right: ['দুই ঠোঁট হতে উচ্চারিত হয়', 'নিচের ঠোঁটের পেট ও ওপরের দাঁতের আগা', 'জিহ্বার গোড়া ও ওপরের তালু', 'হলকের শেষ ভাগ হতে']
      },
      {
        q: 'বাম পাশের তাজবীদ পরিভাষার সাথে ডান পাশের হরফ সংখ্যা মিল করো:',
        left: ['ইযহারে হালকী', 'ইদগাম', 'ইকলাব', 'ইখফায়ে হাকিকী'],
        right: ['৬ টি হরফ', '৬ টি হরফ (ইয়ারমালুন)', '১ টি হরফ (বা)', '১৫ টি হরফ']
      }
    ];

    const arabicWritingPool = [
      { q: 'সহীহ শুদ্ধ করে হরকত লাগাও ও সুন্দর হস্তাক্ষরে লেখ: (بسم الله الرحمن الرحيم)', ans: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
      { q: 'সুন্দর হস্তাক্ষরে আরবিতে লিপিবদ্ধ করো: (الحمد لله رب العالمين - الرحمن الرحيم)', ans: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ' },
      { q: 'আরবি ইবারতটি হরকতসহ লেখ ও বাংলা অর্থ করো: (طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ)', ans: 'প্রত্যেক মুসলমানের ওপর দ্বীনি ইলম অর্জন করা ফরজ।' },
      { q: 'নিচের কালেমাটি সুন্দর আরবি ক্যালিগ্রাফিতে লেখ: (لَا إِلَٰهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ)', ans: 'لَا إِلَٰهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ' },
    ];

    mcqPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-mcq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'mcq',
        question_text: item.q,
        options: item.opts,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    fbPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-fb-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'fill_in_the_blanks',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    oneWordPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-ow-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'one_word',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    wordMeaningPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-wm-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'word_meaning',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 4
      });
    });

    tfPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-tf-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'true_false',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    shortPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-sq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'short_question',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 2
      });
    });

    broadPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-bq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'broad_question',
        question_text: item.q,
        default_marks: 5
      });
    });

    matchingPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-match-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'matching',
        question_text: item.q,
        left_items: item.left,
        right_items: item.right,
        default_marks: 4
      });
    });

    arabicWritingPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-ar-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'arabic_writing',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 3
      });
    });
  } else if (isMath) {
    const mcqPool = [
      { q: '১ ডজন সমান কতটি?', opts: ['১০ টি', '১২ টি', '১৪ টি', '১৬ টি'], ans: '১২ টি' },
      { q: '১ কিলোমিটার সমান কত মিটার?', opts: ['১০০ মিটার', '৫০০ মিটার', '১০০০ মিটার', '১৫০০ মিটার'], ans: '১০০০ মিটার' },
      { q: 'ত্রিভুজের তিন কোণের সমষ্টি কত ডিগ্রি?', opts: ['৯০°', '১৮০°', '২৭০°', '৩৬০°'], ans: '১৮০°' },
      { q: 'নিচের কোন সংখ্যাটি ক্ষুদ্রতম মৌলিক সংখ্যা?', opts: ['০', '১', '২', '৩'], ans: '২' },
      { q: '১ হালি সমান কতটি?', opts: ['২ টি', '৪ টি', '৬ টি', '৮ টি'], ans: '৪ টি' },
      { q: 'সমকোণের পরিমাপ কত ডিগ্রি?', opts: ['৪৫°', '৬০°', '৯০°', '১৮০°'], ans: '৯০°' },
      { q: 'দুই অঙ্কের বৃহত্তম সংখ্যা কোনটি?', opts: ['৯০', '৯৮', '৯৯', '১০০'], ans: '৯৯' },
      { q: 'চতুর্ভুজের চার কোণের সমষ্টি কত?', opts: ['১৮০°', '২৭০°', '৩৬০°', '৪৫০°'], ans: '৩৬০°' },
    ];

    const fbPool = [
      { q: 'যেকোনো সংখ্যাকে শূন্য (০) দিয়ে গুণ করলে গুণফল সর্বদা _____ হয়।', ans: '০' },
      { q: '১ মিটার = _____ সেন্টিমিটার।', ans: '১০০' },
      { q: 'জোড় সংখ্যার সাথে ১ যোগ করলে সর্বদা _____ সংখ্যা পাওয়া যায়।', ans: 'বিজোড়' },
      { q: 'ভাজ্য = (ভাজক × ভাগফল) + _____।', ans: 'ভাগশেষ' },
    ];

    const oneWordPool = [
      { q: '১ কুইন্টাল সমান কত কিলোগ্রাম?', ans: '১০০ কিলোগ্রাম' },
      { q: 'যে ত্রিভুজের তিনটি বাহুই সমান তাকে কী ত্রিভুজ বলে?', ans: 'সমবাহু ত্রিভুজ' },
      { q: '১ থেকে ১০০ পর্যন্ত মৌলিক সংখ্যা কয়টি?', ans: '২৫ টি' },
      { q: 'আয়তক্ষেত্রের ক্ষেত্রফল নির্ণয়ের সূত্র কী?', ans: 'দৈর্ঘ্য × প্রস্থ' },
    ];

    const shortPool = [
      { q: 'ভাগশেষ কাকে বলে? ভাজক ও ভাগশেষের সম্পর্ক কী?', ans: 'ভাগ করার পর যা অবশিষ্ট থাকে তাকে ভাগশেষ বলে। ভাগশেষ সর্বদা ভাজকের চেয়ে ছোট হয়।' },
      { q: 'সমকোণ, সূক্ষ্মকোণ ও স্থূলকোণ কাকে বলে?', ans: '৯০° কোণকে সমকোণ, ৯০° অপেক্ষা ছোট কোণকে সূক্ষ্মকোণ এবং ৯০° অপেক্ষা বড় কোণকে স্থূলকোণ বলে।' },
      { q: 'মৌলিক সংখ্যা ও যৌগিক সংখ্যার মধ্যে পার্থক্য উদাহরণসহ লেখ।', ans: 'যে সংখ্যার ১ ও ঐ সংখ্যা ছাড়া অন্য কোনো গুণনীয়ক নেই তা মৌলিক সংখ্যা (যেমন: ২, ৩, ৫)।' },
      { q: 'একটি কলমের দাম ১৫ টাকা হলে ১ ডজন কলমের দাম কত?', ans: '১ ডজন = ১২টি। ১২ × ১৫ = ১৮০ টাকা।' },
    ];

    const broadPool = [
      { q: 'একটি মাদ্রাসায় মোট ২৫০ জন শিক্ষার্থী আছে। তাদের মধ্যে ১৫০ জন বালক হলে বালিকার সংখ্যা কত এবং বালকের শতকরা হার নির্ণয় করো।' },
      { q: 'একটি আয়তাকার মাঠের দৈর্ঘ্য ৫০ মিটার এবং প্রস্থ ৩০ মিটার। মাঠের ক্ষেত্রফল ও পরিসীমা নির্ণয় করো।' },
      { q: 'পিতা ও পুত্রের বর্তমান বয়সের সমষ্টি ৬০ বছর। পিতার বয়স পুত্রের বয়সের ৩ গুণ হলে কার বর্তমান বয়স কত?' },
      { q: '৪টি খাতা ও ৩টি কলমের মোট দাম ১৩৫ টাকা। ১টি কলমের দাম ১৫ টাকা হলে ১টি খাতার দাম কত?' },
    ];

    const matchingPool = [
      {
        q: 'বাম পাশের এককের সাথে ডান পাশের সঠিক মান মিল করো:',
        left: ['১ ঘণ্টা', '১ দিন', '১ ডজন', '১ শতক'],
        right: ['৬০ মিনিট', '২৪ ঘণ্টা', '১২ টি', '১০০']
      }
    ];

    mcqPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-mcq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'mcq',
        question_text: item.q,
        options: item.opts,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    fbPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-fb-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'fill_in_the_blanks',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    oneWordPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-ow-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'one_word',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    shortPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-sq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'short_question',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 2
      });
    });

    broadPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-bq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'broad_question',
        question_text: item.q,
        default_marks: 5
      });
    });

    matchingPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-match-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'matching',
        question_text: item.q,
        left_items: item.left,
        right_items: item.right,
        default_marks: 4
      });
    });
  } else if (isEnglish) {
    const mcqPool = [
      { q: "What is the plural form of 'Child'?", opts: ['Childs', 'Children', 'Childrens', 'Childes'], ans: 'Children' },
      { q: 'Which word is an Adjective?', opts: ['Quickly', 'Honest', 'Read', 'Madrasah'], ans: 'Honest' },
      { q: "What is the antonym of 'Difficult'?", opts: ['Hard', 'Easy', 'Complex', 'Heavy'], ans: 'Easy' },
      { q: 'How many vowels are there in the English alphabet?', opts: ['4', '5', '6', '21'], ans: '5' },
      { q: 'Choose the correct article: He is ___ honest man.', opts: ['a', 'an', 'the', 'no article'], ans: 'an' },
      { q: "What is the past form of 'Go'?", opts: ['Goed', 'Went', 'Gone', 'Going'], ans: 'Went' },
      { q: 'Which one is a Proper Noun?', opts: ['City', 'River', 'Bangladesh', 'Country'], ans: 'Bangladesh' },
      { q: 'The sun ___ in the East.', opts: ['rise', 'rises', 'rising', 'risen'], ans: 'rises' },
    ];

    const fbPool = [
      { q: 'The sun rises in the _____ and sets in the west.', ans: 'East' },
      { q: 'Honesty is the _____ policy.', ans: 'best' },
      { q: 'We should _____ our parents and teachers.', ans: 'respect' },
      { q: 'A stitch in time saves _____.', ans: 'nine' },
    ];

    const oneWordPool = [
      { q: 'Write the opposite word of "Kind".', ans: 'Cruel / Unkind' },
      { q: 'What do we call a person who teaches in a school or madrasah?', ans: 'Teacher' },
      { q: 'Write the past participle of "Write".', ans: 'Written' },
      { q: 'Which punctuation mark is used at the end of a question?', ans: 'Question mark (?)' },
    ];

    const wordMeaningPool = [
      { q: 'Write the Bengali meaning of the words: Knowledge, Honesty, Respect, Environment', ans: 'Knowledge = জ্ঞান, Honesty = সততা, Respect = সম্মান, Environment = পরিবেশ' },
      { q: 'Write the Bengali meaning of the words: Patriotism, Discipline, Truthful,Gratitude', ans: 'Patriotism = দেশপ্রেম, Discipline = শৃঙ্খলা, Truthful = সত্যবাদী, Gratitude = কৃতজ্ঞতা' },
    ];

    const shortPool = [
      { q: 'Write three sentences about your Madrasah / School.', ans: 'My madrasah is an ideal institution. Qualified teachers teach us with care. I love my madrasah very much.' },
      { q: 'Translate into English: "সততা একটি মহৎ গুণ। আমাদের সর্বদা সত্য কথা বলা উচিত।"', ans: 'Honesty is a noble virtue. We should always speak the truth.' },
      { q: 'What is a Noun? Give two examples.', ans: 'A Noun is a naming word. Examples: Quran, Dhaka.' },
      { q: 'Make meaningful sentences with: (a) Mother, (b) Honest, (c) Morning.', ans: '(a) My mother loves me. (b) He is an honest boy. (c) I wake up early in the morning.' },
    ];

    const broadPool = [
      { q: "Write a paragraph on 'My Aim in Life' or 'Our Institution' in 10 sentences." },
      { q: 'Write an application to the Principal / Muhtamim praying for two days leave of absence.' },
      { q: "Write a short composition about 'The Importance of Learning English & Arabic'." },
      { q: "Read the passage carefully and answer the comprehension questions based on 'Daily Routine of a Good Student'." },
    ];

    const matchingPool = [
      {
        q: 'Match the words in Column A with their meanings in Column B:',
        left: ['Morning', 'Student', 'Teacher', 'Library'],
        right: ['Early part of the day', 'One who learns attentively', 'One who guides and teaches', 'A place with many books']
      }
    ];

    mcqPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-mcq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'mcq',
        question_text: item.q,
        options: item.opts,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    fbPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-fb-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'fill_in_the_blanks',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    oneWordPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-ow-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'one_word',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    wordMeaningPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-wm-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'word_meaning',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 4
      });
    });

    shortPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-sq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'short_question',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 2
      });
    });

    broadPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-bq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'broad_question',
        question_text: item.q,
        default_marks: 5
      });
    });

    matchingPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-match-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'matching',
        question_text: item.q,
        left_items: item.left,
        right_items: item.right,
        default_marks: 4
      });
    });
  } else {
    // Bangla / General / Social / Science / Islamic History
    const mcqPool = [
      { q: `${title} বিষয়ের প্রথম অধ্যায়ের মূল প্রতিপাদ্য কী?`, opts: ['মৌলিক শিক্ষা ও শিষ্টাচার', 'পরিবেশ পরিচিতি', 'ঐতিহাসিক ঘটনাবলী', 'ব্যবহারিক প্রয়োগ'], ans: 'মৌলিক শিক্ষা ও শিষ্টাচার' },
      { q: "'জ্ঞান' শব্দের বিপরীত শব্দ কোনটি?", opts: ['অজ্ঞান / মূর্খতা', 'বিজ্ঞান', 'প্রজ্ঞা', 'মেধা'], ans: 'অজ্ঞান / মূর্খতা' },
      { q: 'উত্তম চরিত্রের প্রধান লক্ষণ কোনটি?', opts: ['সততা ও সত্যবাদিতা', 'অহংকার', 'লোভ', 'আলস্য'], ans: 'সততা ও সত্যবাদিতা' },
      { q: 'বাংলা বর্ণমালায় মোট বর্ণ কয়টি?', opts: ['৩৯ টি', '৪৯ টি', '৫০ টি', '৫২ টি'], ans: '৫০ টি' },
      { q: 'বাংলা বর্ণমালায় স্বরবর্ণ কয়টি?', opts: ['১০ টি', '১১ টি', '১২ টি', '১৩ টি'], ans: '১১ টি' },
      { q: 'সময়ের কাজ সময়ে করাকে কী বলে?', opts: ['সময়ানুবর্তিতা', 'অলসতা', 'পরিশ্রম', 'দায়িত্ব'], ans: 'সময়ানুবর্তিতা' },
      { q: "'সূর্য' শব্দের সমার্থক শব্দ কোনটি?", opts: ['তপন / রবি', 'শশধর', 'গগন', 'বারিধি'], ans: 'তপন / রবি' },
      { q: 'পিতামাতা ও শিক্ষকের প্রতি আমাদের কর্তব্য কী?', opts: ['শ্রদ্ধা ও আনুগত্য প্রকাশ করা', 'অবহেলা করা', 'তর্ক করা', 'দূরে থাকা'], ans: 'শ্রদ্ধা ও আনুগত্য প্রকাশ করা' },
    ];

    const fbPool = [
      { q: 'আমাদের সকলের উচিত বড়দের সম্মান করা এবং ছোটদের _____ করা।', ans: 'স্নেহ' },
      { q: 'সততা মানুষের জীবনে সবচেয়ে বড় _____।', ans: 'সম্পদ' },
      { q: 'পরিশ্রম সৌভাগ্যের _____।', ans: 'প্রসূতি' },
      { q: 'বিদ্যা অমূল্য _____, যা দান করলে কমে না বরং বাড়ে।', ans: 'ধন' },
    ];

    const oneWordPool = [
      { q: 'যে উপকারীর উপকার স্বীকার করে তাকে এক কথায় কী বলে?', ans: 'কৃতজ্ঞ' },
      { q: 'বাংলা ভাষায় মাত্রাহীন বর্ণ কয়টি?', ans: '১০ টি' },
      { q: 'দেশের প্রতি ভালোবাসাকে কী বলা হয়?', ans: 'দেশপ্রেম' },
      { q: 'সত্য কথা যে বলে তাকে কী বলা হয়?', ans: 'সত্যবাদী' },
    ];

    const wordMeaningPool = [
      { q: 'শব্দের অর্থ লেখ: শ্রদ্ধা, অঙ্গীকার, কল্যাণ, আদর্শ', ans: 'শ্রদ্ধা = সম্মান, অঙ্গীকার = প্রতিজ্ঞা, কল্যাণ = মঙ্গল, আদর্শ = অনুসরণীয় নীতি' },
      { q: 'বিপরীত শব্দ লেখ: আলো, সত্য, সকাল, উত্থান', ans: 'আলো-আঁধার, সত্য-মিথ্যা, সকাল-বিকাল, উত্থান-পতন' },
    ];

    const shortPool = [
      { q: `${title} পাঠের মূল উদ্দেশ্য কী এবং এটি আমাদের দৈনন্দিন জীবনে কীভাবে সাহায্য করে?`, ans: 'নৈতিক চরিত্র গঠন, শুদ্ধ ভাষা শিক্ষা ও বাস্তব জীবনে আদর্শ মানুষ হিসেবে গড়ে উঠতে সাহায্য করে।' },
      { q: 'যুক্তবর্ণ ভেঙে দুইটি করে শব্দ তৈরি করো: (ক্ষ, জ্ঞ, ষ্ণ)', ans: 'ক্ষ = ক্ + ষ (শিক্ষা, ক্ষমা), জ্ঞ = জ্ + ঞ (জ্ঞান, বিজ্ঞান), ষ্ণ = ষ্ + ণ (উষ্ণ, তৃষ্ণা)' },
      { q: 'সময়ানুবর্তিতা কাকে বলে? ছাত্রজীবনে সময়ানুবর্তিতার গুরুত্ব লেখ।', ans: 'সঠিক সময়ে সঠিক কাজ সম্পন্ন করাকে সময়ানুবর্তিতা বলে।' },
      { q: 'পিতামাতা ও শিক্ষকের প্রতি আমাদের ৪টি করণীয় লেখ।', ans: '১. সালাম দেওয়া, ২. আদেশ মান্য করা, ৩. সেবা করা, ৪. তাঁদের জন্য দোয়া করা।' },
    ];

    const broadPool = [
      { q: `${title} বিষয়ের পাঠ্যসূচি থেকে তোমার পছন্দের একটি অধ্যায়ের মূলভাব নিজের ভাষায় বিস্তারিত লেখ।` },
      { q: 'আদর্শ শিক্ষার্থী ও উত্তম চরিত্র গঠন সম্পর্কে একটি রচনা বা অনুচ্ছেদ লেখ।' },
      { q: 'অসুস্থতার কারণে তিন দিনের ছুটি চেয়ে প্রতিষ্ঠানের প্রধান বরাবর একটি আবেদনপত্র লেখ।' },
      { q: 'নিচের অনুচ্ছেদটি পড়ে প্রদত্ত প্রশ্নগুলোর উত্তর দাও: "মানুষের শ্রেষ্ঠ সম্পদ হলো তার সৎ চরিত্র ও অর্জিত জ্ঞান..."' },
    ];

    const matchingPool = [
      {
        q: 'বাম পাশের শব্দের সাথে ডান পাশের বিপরীত শব্দ মিল করো:',
        left: ['আলো', 'সত্য', 'সুখ', 'উত্তম'],
        right: ['আঁধার', 'মিথ্যা', 'দুঃখ', 'অধম']
      }
    ];

    mcqPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-mcq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'mcq',
        question_text: item.q,
        options: item.opts,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    fbPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-fb-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'fill_in_the_blanks',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    oneWordPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-ow-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'one_word',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 1
      });
    });

    wordMeaningPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-wm-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'word_meaning',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 4
      });
    });

    shortPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-sq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'short_question',
        question_text: item.q,
        answer_text: item.ans,
        default_marks: 2
      });
    });

    broadPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-bq-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'broad_question',
        question_text: item.q,
        default_marks: 5
      });
    });

    matchingPool.forEach((item, idx) => {
      qs.push({
        id: `${bId}-q-match-${idx + 1}`,
        book_id: bId,
        chapter_id: getCh(idx),
        category_type: 'matching',
        question_text: item.q,
        left_items: item.left,
        right_items: item.right,
        default_marks: 4
      });
    });
  }

  return qs;
}
