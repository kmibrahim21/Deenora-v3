import { QBBook, QBChapter, QBQuestion } from './questionBankTypes';

export function generateChaptersForBook(bookId: string, bookTitle: string = ''): QBChapter[] {
  const isArabicOrQuran = /কুরআন|তাজবীদ|কায়দা|আমপারা|হরফ|আরবি|আরবী|হাদিস|ফিকহ|আকাইদ/i.test(bookTitle);
  
  return [
    {
      id: `${bookId}-ch-1`,
      book_id: bookId,
      chapter_no: 1,
      title: isArabicOrQuran ? '১ম অধ্যায়: প্রাথমিক মাখরাজ ও হরকত পরিচিতি (১ম সাময়িক)' : '১ম অধ্যায়: প্রারম্ভিক পাঠ ও মৌলিক ধারণা (১ম সাময়িক)'
    },
    {
      id: `${bookId}-ch-2`,
      book_id: bookId,
      chapter_no: 2,
      title: isArabicOrQuran ? '২য় অধ্যায়: তানভীন, সাকিন ও তাজবীদ বিধান (২য় সাময়িক)' : '২য় অধ্যায়: মধ্যবর্তী বিষয়বস্তু ও অনুশীলন (২য় সাময়িক)'
    },
    {
      id: `${bookId}-ch-3`,
      book_id: bookId,
      chapter_no: 3,
      title: isArabicOrQuran ? '৩য় অধ্যায়: নির্বাচিত সূরা ও বিশুদ্ধ তিলাওয়াত (বার্ষিক)' : '৩য় অধ্যায়: বিস্তারিত আলোচনা ও অধ্যায়ভিত্তিক পাঠ (বার্ষিক)'
    },
    {
      id: `${bookId}-ch-4`,
      book_id: bookId,
      chapter_no: 4,
      title: '৪র্থ অধ্যায়: পুনরালোচনা, মডেল প্রশ্ন ও চূড়ান্ত প্রস্তুতি'
    }
  ];
}

export function generateQuestionsForBook(book: QBBook): QBQuestion[] {
  const bId = book.id;
  const title = book.title || '';
  const isArabicOrQuran = /কুরআন|তাজবীদ|কায়দা|আমপারা|হরফ|আরবি|আরবী|হাদিস|ফিকহ|আকাইদ|নাজেরা/i.test(title);
  const isBangla = /বাংলা|ছড়া|আনন্দপাঠ|সাহিত্য|ব্যাকরণ/i.test(title);
  const isMath = /গণিত|অঙ্ক|math/i.test(title);
  const isEnglish = /english|reader|grammar/i.test(title);

  const qs: QBQuestion[] = [];
  const ch1 = `${bId}-ch-1`;
  const ch2 = `${bId}-ch-2`;
  const ch3 = `${bId}-ch-3`;
  const ch4 = `${bId}-ch-4`;

  if (isArabicOrQuran) {
    // MCQ
    qs.push(
      {
        id: `${bId}-q-mcq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'mcq',
        question_text: 'মাখরাজ মোট কয়টি?',
        options: ['১৫ টি', '১৬ টি', '১৭ টি', '১৮ টি'],
        answer_text: '১৭ টি',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-2`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'mcq',
        question_text: 'মদ্দের হরফ কয়টি?',
        options: ['২ টি', '৩ টি', '৪ টি', '৫ টি'],
        answer_text: '৩ টি',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-3`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'mcq',
        question_text: 'নুন সাকিন ও তানভীনের হুকুম কয়টি?',
        options: ['৩ টি', '৪ টি', '৫ টি', '৬ টি'],
        answer_text: '৪ টি',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-4`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'mcq',
        question_text: 'ওয়াজিব গুন্নাহ কোন হরফে হয়?',
        options: ['নুন ও মীম মুশদ্দাদ', 'বা ও তা', 'লাম ও রা', 'হা ও খ'],
        answer_text: 'নুন ও মীম মুশদ্দাদ',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-5`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'mcq',
        question_text: 'কুরআন মাজীদে মোট পারার সংখ্যা কত?',
        options: ['২৫ টি', '২৮ টি', '৩০ টি', '৩২ টি'],
        answer_text: '৩০ টি',
        default_marks: 1
      }
    );

    // Fill in the blanks
    qs.push(
      {
        id: `${bId}-q-fb-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'fill_in_the_blanks',
        question_text: 'হরকত বলা হয় এক জবর, এক যের, এক _____ কে।',
        answer_text: 'পেশ',
        default_marks: 1
      },
      {
        id: `${bId}-q-fb-2`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'fill_in_the_blanks',
        question_text: 'তানভীন বলা হয় দুই জবর, দুই যের, দুই _____ কে।',
        answer_text: 'পেশ',
        default_marks: 1
      },
      {
        id: `${bId}-q-fb-3`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'fill_in_the_blanks',
        question_text: 'কলক্বলাহ এর হরফ মোট _____ টি।',
        answer_text: '৫',
        default_marks: 1
      },
      {
        id: `${bId}-q-fb-4`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'fill_in_the_blanks',
        question_text: 'কুরআন মাজীদের সবচেয়ে ফযীলতপূর্ণ আয়াত হলো _____।',
        answer_text: 'আয়াতুল কুরসী',
        default_marks: 1
      }
    );

    // Short Questions
    qs.push(
      {
        id: `${bId}-q-sq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'short_question',
        question_text: 'মাখরাজ কাকে বলে? হরফ উচ্চারণের স্থানকে কী বলা হয়?',
        answer_text: 'হরফ উচ্চারণের স্থানকে মাখরাজ বলে। মাখরাজ মোট ১৭টি।',
        default_marks: 2
      },
      {
        id: `${bId}-q-sq-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'short_question',
        question_text: 'ইযহার ও ইখফা শব্দের অর্থ কী?',
        answer_text: 'ইযহার অর্থ প্রকাশ করে পড়া, ইখফা অর্থ গোপন বা গুন্নাহ সহ পড়া।',
        default_marks: 2
      },
      {
        id: `${bId}-q-sq-3`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'short_question',
        question_text: 'কলক্বলাহর পাঁচটি হরফ কী কী?',
        answer_text: 'ক্বাফ (ق), ত্বা (ط), বা (ب), জীম (ج), দাল (د)। সংক্ষেপে কুতবু জাদ।',
        default_marks: 2
      },
      {
        id: `${bId}-q-sq-4`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'short_question',
        question_text: 'তিলাওয়াতের সিজদা আদায়ের নিয়ম কী?',
        answer_text: 'সিজদার আয়াত তিলাওয়াত করলে বা শুনলে একটি সিজদা দেওয়া ওয়াজিব।',
        default_marks: 2
      }
    );

    // Matching Table
    qs.push({
      id: `${bId}-q-match-1`,
      book_id: bId,
      chapter_id: ch2,
      category_type: 'matching',
      question_text: 'বাম পাশের হরফের সাথে ডান পাশের মাখরাজ মিল করো:',
      left_items: ['বা (ب)', 'ফা (ف)', 'ক্বাফ (ق)', 'হামযাহ (ء)'],
      right_items: ['দুই ঠোঁটের ভিজা অংশ', 'নিচের ঠোঁটের পেট ও ওপরের দাঁতের আগা', 'জিহ্বার গোড়া ও ওপরের তালু', 'হলকের শেষ ভাগ'],
      default_marks: 4
    });

    // Broad Question
    qs.push(
      {
        id: `${bId}-q-bq-1`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'broad_question',
        question_text: 'নুন সাকিন ও তানভীনের চারটি হুকুম (ইযহার, ইদগাম, ইকলাব, ইখফা) উদাহরণসহ আলোচনা করো।',
        default_marks: 5
      },
      {
        id: `${bId}-q-bq-2`,
        book_id: bId,
        chapter_id: ch4,
        category_type: 'broad_question',
        question_text: 'সূরা ফাতিহার বাংলা তরজমা ও ফযীলত নিজের ভাষায় বিস্তারিত লেখ।',
        default_marks: 5
      }
    );

    // Arabic Writing
    qs.push(
      {
        id: `${bId}-q-ar-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'arabic_writing',
        question_text: 'সহীহ শুদ্ধ করে হরকত লাগাও: (بسم الله الرحمن الرحيم)',
        answer_text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        default_marks: 3
      },
      {
        id: `${bId}-q-ar-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'arabic_writing',
        question_text: 'সুন্দর হস্তাক্ষরে আরবিতে লেখ: (الحمد لله رب العالمين)',
        answer_text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
        default_marks: 3
      }
    );
  } else if (isMath) {
    // Math questions
    qs.push(
      {
        id: `${bId}-q-mcq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'mcq',
        question_text: '১ ডজন সমান কতটি?',
        options: ['১০ টি', '১২ টি', '১৪ টি', '১৬ টি'],
        answer_text: '১২ টি',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-2`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'mcq',
        question_text: '১ কিলোমিটার সমান কত মিটার?',
        options: ['১০০ মিটার', '৫০০ মিটার', '১০০০ মিটার', '১৫০০ মিটার'],
        answer_text: '১০০০ মিটার',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-3`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'mcq',
        question_text: 'ত্রিভুজের তিন কোণের সমষ্টি কত?',
        options: ['৯০°', '১৮০°', '২৭০°', '৩৬০°'],
        answer_text: '১৮০°',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-4`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'mcq',
        question_text: 'কোন সংখ্যাটি ক্ষুদ্রতম মৌলিক সংখ্যা?',
        options: ['০', '১', '২', '৩'],
        answer_text: '২',
        default_marks: 1
      }
    );

    qs.push(
      {
        id: `${bId}-q-fb-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'fill_in_the_blanks',
        question_text: 'যেকোনো সংখ্যাকে শূন্য দিয়ে গুণ করলে গুণফল _____ হয়।',
        answer_text: '০',
        default_marks: 1
      },
      {
        id: `${bId}-q-fb-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'fill_in_the_blanks',
        question_text: '১ মিটার = _____ সেন্টিমিটার।',
        answer_text: '১০০',
        default_marks: 1
      },
      {
        id: `${bId}-q-fb-3`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'fill_in_the_blanks',
        question_text: 'জোড় সংখ্যার সাথে ১ যোগ করলে সর্বদা _____ সংখ্যা পাওয়া যায়।',
        answer_text: 'বিজোড়',
        default_marks: 1
      }
    );

    qs.push(
      {
        id: `${bId}-q-sq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'short_question',
        question_text: 'ভাগশেষ কাকে বলে? ভাজক ও ভাগশেষের সম্পর্ক কী?',
        answer_text: 'ভাগ করার পর যা অবশিষ্ট থাকে তাকে ভাগশেষ বলে। ভাগশেষ সর্বদা ভাজকের চেয়ে ছোট হয়।',
        default_marks: 2
      },
      {
        id: `${bId}-q-sq-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'short_question',
        question_text: 'সমকোণ ও সরলকোণ কাকে বলে?',
        answer_text: '৯০° কোণকে সমকোণ এবং ১৮০° কোণকে সরলকোণ বলে।',
        default_marks: 2
      }
    );

    qs.push({
      id: `${bId}-q-match-1`,
      book_id: bId,
      chapter_id: ch2,
      category_type: 'matching',
      question_text: 'বাম পাশের সাথে ডান পাশের রাশি মিল করো:',
      left_items: ['১ ঘণ্টা', '১ দিন', '১ হালি', '১ শতক'],
      right_items: ['৬০ মিনিট', '২৪ ঘণ্টা', '৪ টি', '১০০'],
      default_marks: 4
    });

    qs.push(
      {
        id: `${bId}-q-bq-1`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'broad_question',
        question_text: 'একটি মাদ্রাসায় মোট ২৫০ জন শিক্ষার্থী আছে। তাদের মধ্যে ১৫০ জন বালক হলে বালিকার সংখ্যা কত এবং বালকের শতকরা হার নির্ণয় করো।',
        default_marks: 5
      },
      {
        id: `${bId}-q-bq-2`,
        book_id: bId,
        chapter_id: ch4,
        category_type: 'broad_question',
        question_text: 'একটি আয়তাকার মাঠের দৈর্ঘ্য ৫০ মিটার এবং প্রস্থ ৩০ মিটার হলে মাঠের ক্ষেত্রফল ও পরিসীমা নির্ণয় করো।',
        default_marks: 5
      }
    );
  } else if (isEnglish) {
    // English questions
    qs.push(
      {
        id: `${bId}-q-mcq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'mcq',
        question_text: "What is the plural form of 'Child'?",
        options: ['Childs', 'Children', 'Childrens', 'Childes'],
        answer_text: 'Children',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'mcq',
        question_text: "Which word is an adjective?",
        options: ['Quickly', 'Honest', 'Sing', 'Madrasah'],
        answer_text: 'Honest',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-3`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'mcq',
        question_text: "What is the antonym of 'Difficult'?",
        options: ['Hard', 'Easy', 'Complex', 'Slow'],
        answer_text: 'Easy',
        default_marks: 1
      }
    );

    qs.push(
      {
        id: `${bId}-q-fb-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'fill_in_the_blanks',
        question_text: 'The sun rises in the _____ and sets in the west.',
        answer_text: 'East',
        default_marks: 1
      },
      {
        id: `${bId}-q-fb-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'fill_in_the_blanks',
        question_text: 'Honesty is the _____ policy.',
        answer_text: 'best',
        default_marks: 1
      }
    );

    qs.push(
      {
        id: `${bId}-q-sq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'short_question',
        question_text: 'Write three sentences about your classroom.',
        default_marks: 3
      },
      {
        id: `${bId}-q-sq-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'short_question',
        question_text: 'Translate into English: "সততা একটি মহৎ গুণ।"',
        answer_text: 'Honesty is a noble virtue.',
        default_marks: 2
      }
    );

    qs.push({
      id: `${bId}-q-match-1`,
      book_id: bId,
      chapter_id: ch2,
      category_type: 'matching',
      question_text: 'Match the words in column A with their meanings in column B:',
      left_items: ['Morning', 'Student', 'Teacher', 'Book'],
      right_items: ['Early part of the day', 'One who learns', 'One who guides', 'Source of knowledge'],
      default_marks: 4
    });

    qs.push({
      id: `${bId}-q-bq-1`,
      book_id: bId,
      chapter_id: ch3,
      category_type: 'broad_question',
      question_text: "Write a short paragraph on 'My Aim in Life' or 'My Favorite Teacher'.",
      default_marks: 6
    });
  } else {
    // General / Bangla / Social / Islamic
    qs.push(
      {
        id: `${bId}-q-mcq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'mcq',
        question_text: `${title} বিষয়ের প্রথম অধ্যায়ের মূল প্রতিপাদ্য কী?`,
        options: ['মৌলিক শিক্ষা ও শিষ্টাচার', 'পরিবেশ পরিচিতি', 'ঐতিহাসিক ঘটনাবলী', 'ব্যবহারিক প্রয়োগ'],
        answer_text: 'মৌলিক শিক্ষা ও শিষ্টাচার',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'mcq',
        question_text: "'জ্ঞান' শব্দের বিপরীত শব্দ কোনটি?",
        options: ['অজ্ঞান / মূর্খতা', 'বিজ্ঞান', 'প্রজ্ঞা', 'মেধা'],
        answer_text: 'অজ্ঞান / মূর্খতা',
        default_marks: 1
      },
      {
        id: `${bId}-q-mcq-3`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'mcq',
        question_text: 'উত্তম চরিত্রের প্রধান লক্ষণ কোনটি?',
        options: ['সততা ও সত্যবাদিতা', 'অহংকার', 'লোভ', 'আলস্য'],
        answer_text: 'সততা ও সত্যবাদিতা',
        default_marks: 1
      }
    );

    qs.push(
      {
        id: `${bId}-q-fb-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'fill_in_the_blanks',
        question_text: 'আমাদের সকলের উচিত বড়দের সম্মান করা এবং ছোটদের _____ করা।',
        answer_text: 'স্নেহ',
        default_marks: 1
      },
      {
        id: `${bId}-q-fb-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'fill_in_the_blanks',
        question_text: 'সততা মানুষের জীবনে সবচেয়ে বড় _____।',
        answer_text: 'সম্পদ',
        default_marks: 1
      }
    );

    qs.push(
      {
        id: `${bId}-q-sq-1`,
        book_id: bId,
        chapter_id: ch1,
        category_type: 'short_question',
        question_text: `${title} পাঠের মূল উদ্দেশ্য কী এবং এটি আমাদের দৈনন্দিন জীবনে কীভাবে সাহায্য করে?`,
        default_marks: 2
      },
      {
        id: `${bId}-q-sq-2`,
        book_id: bId,
        chapter_id: ch2,
        category_type: 'short_question',
        question_text: 'যুক্তবর্ণ ভেঙে শব্দ তৈরি করো: (ক্ষ, জ্ঞ, ষ্ণ)',
        answer_text: 'ক্ষ = ক্ + ষ, জ্ঞ = জ্ + ঞ, ষ্ণ = ষ্ + ণ',
        default_marks: 3
      }
    );

    qs.push({
      id: `${bId}-q-match-1`,
      book_id: bId,
      chapter_id: ch2,
      category_type: 'matching',
      question_text: 'বাম পাশের শব্দের সাথে ডান পাশের বিপরীত শব্দ মিল করো:',
      left_items: ['আলো', 'সত্য', 'সুখ', 'উত্তম'],
      right_items: ['আঁধার', 'মিথ্যা', 'দুঃখ', 'অধম'],
      default_marks: 4
    });

    qs.push(
      {
        id: `${bId}-q-bq-1`,
        book_id: bId,
        chapter_id: ch3,
        category_type: 'broad_question',
        question_text: `${title} বিষয়ের পাঠ্যসূচি থেকে তোমার পছন্দের একটি অধ্যায়ের সারসংক্ষেপ নিজের ভাষায় লেখ।`,
        default_marks: 5
      },
      {
        id: `${bId}-q-bq-2`,
        book_id: bId,
        chapter_id: ch4,
        category_type: 'broad_question',
        question_text: 'নৈতিকতা ও সময়ানুবর্তিতা সম্পর্কে একটি সংক্ষিপ্ত অনুচ্ছেদ রচনা করো।',
        default_marks: 5
      }
    );
  }

  return qs;
}
