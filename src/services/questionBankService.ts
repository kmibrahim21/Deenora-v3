import { supabase } from '../supabase';

export interface QBBook {
  id: string;
  board: string;
  class_name: string;
  title: string;
  subject_code?: string;
  cover_url?: string;
  pdf_url?: string;
  source_type: 'easyqbd' | 'nctb' | 'qawmi';
  total_chapters: number;
  total_questions: number;
}

export interface QBChapter {
  id: string;
  book_id: string;
  chapter_no: number;
  title: string;
}

export interface QBQuestion {
  id: string;
  book_id: string;
  chapter_id: string;
  category_type: string;
  question_text: string;
  options?: string[];
  answer_text?: string;
  default_marks: number;
  left_items?: string[];
  right_items?: string[];
}

export interface PaperQuestion {
  id: string;
  original_id?: string;
  question_text: string;
  category_type: string;
  options?: string[];
  answer_text?: string;
  marks?: number;
  left_items?: string[];
  right_items?: string[];
}

export interface PaperSection {
  id: string;
  category_type: string;
  title: string;
  layout: '1_col' | '2_col' | '3_col' | '4_col' | 'word_box';
  numbering_style: 'bangla_letter' | 'bangla_number' | 'english_number' | 'english_letter' | 'arabic_number' | 'bullet' | 'none';
  direction: 'ltr' | 'rtl';
  dotted_lines: number; // 0 to 4 lines
  marks_formula: string; // e.g. "১ × ১০ = ১০"
  total_marks: number;
  word_box_options?: string[];
  questions: PaperQuestion[];
}

export interface PaperConfig {
  bismillah_type: 'arabic' | 'bangla' | 'none';
  madrasah_name: string;
  madrasah_address: string;
  exam_title: string;
  class_name: string;
  subject_name: string;
  subject_code: string;
  time_duration: string;
  target_marks: number;
  show_student_info_box: boolean;
  show_instructions: boolean;
  instructions_text: string;
  font_size: number; // 11 to 20
  line_height: number; // 1.1 to 2.0
  question_gap: number; // 2 to 18
  border_style: 'none' | 'single' | 'double';
  style_preset: 'noorani' | 'befaq' | 'worksheet' | 'compact' | 'custom';
  bangla_font?: string;
  arabic_font?: string;
  english_font?: string;
  paper_size?: 'A4' | 'Legal';
}

export interface QBSavedPaper {
  id: string;
  madrasa_id?: string;
  user_id?: string;
  title: string;
  exam_name: string;
  class_name: string;
  subject_name: string;
  total_marks: number;
  time_duration: string;
  paper_config: PaperConfig;
  sections_data: PaperSection[];
  created_at: string;
  updated_at?: string;
}

// ----------------------------------------------------
// BOARDS & PRESETS
// ----------------------------------------------------
export const SUPPORTED_BOARDS = [
  { id: 'all', name: 'সকল বোর্ড (All Boards)' },
  { id: 'noorani_ctg', name: 'নূরানী তালিমুল কুরআন বোর্ড বাংলাদেশ (চট্টগ্রাম)' },
  { id: 'noorani_jatrabari', name: "নূরানী তা'লিমুল কুরআন বোর্ড বাংলাদেশ (যাত্রাবাড়ী)" },
  { id: 'befaq', name: 'বেফাকুল মাদারিসিল আরাবিয়া বাংলাদেশ (Befaq)' },
  { id: 'alia', name: 'ইবতেদায়ী ও দাখিল (আলিয়া মাদ্রাসা বোর্ড)' },
  { id: 'nctb', name: 'NCTB সরকারি প্রাথমিক ও মাধ্যমিক শিক্ষা বোর্ড' },
  { id: 'salsabil_jamjam', name: 'সালসাবিল, ইতমিনান, আন-নূর ও জমজম বোর্ড' },
];

export const SUPPORTED_CLASSES = [
  'প্লে (Play)',
  'নার্সারী (Nursery)',
  'প্রথম শ্রেণি (Class 1)',
  'দ্বিতীয় শ্রেণি (Class 2)',
  'তৃতীয় শ্রেণি (Class 3)',
  'চতুর্থ শ্রেণি (Class 4)',
  'পঞ্চম শ্রেণি (Class 5)',
  'ষষ্ঠ শ্রেণি (Class 6)',
  'সপ্তম শ্রেণি (Class 7)',
  'অষ্টম শ্রেণি (Class 8)',
  'দাখিল / নবম-দশম (Class 9-10)',
  'মুতাওয়াসসিতাহ / সানিয়াহ (Befaq)',
  'ফযীলত / তাকমীল (Befaq)',
];

export const QUESTION_CATEGORIES = [
  { id: 'all', label: 'সকল ধরন (All Categories)' },
  { id: 'mcq', label: 'সঠিক উত্তরটি বেছে নাও (MCQ)' },
  { id: 'fill_in_the_blanks', label: 'শূন্যস্থান পূরণ করো' },
  { id: 'one_word', label: 'এক কথায় উত্তর দাও' },
  { id: 'short_question', label: 'সংক্ষিপ্ত প্রশ্ন' },
  { id: 'broad_question', label: 'রচনামূলক / বর্ণনামূলক প্রশ্ন' },
  { id: 'word_meaning', label: 'শব্দার্থ ও বিপরীত শব্দ' },
  { id: 'true_false', label: 'সত্য / মিথ্যা নির্ণয় করো' },
  { id: 'matching', label: 'ডান-বাম মিলকরণ' },
  { id: 'arabic_writing', label: 'আরবি হরফ, বাক্য ও আয়াত লিখন' },
];

// ----------------------------------------------------
// COMPREHENSIVE SEED DATA (Fallbacks covering all boards)
// ----------------------------------------------------
export const SEED_BOOKS: QBBook[] = [
  {
    id: 'b-noorani-quran-1',
    board: 'noorani_ctg',
    class_name: 'প্রথম শ্রেণি (Class 1)',
    title: 'নূরানী কুরআন শিক্ষা ও তাজবীদ',
    subject_code: '১০১',
    source_type: 'qawmi',
    total_chapters: 5,
    total_questions: 64,
  },
  {
    id: 'b-noorani-bangla-1',
    board: 'noorani_ctg',
    class_name: 'প্রথম শ্রেণি (Class 1)',
    title: 'নূরানী বাংলা পাঠ ও ব্যাকরণ',
    subject_code: '১০২',
    source_type: 'qawmi',
    total_chapters: 4,
    total_questions: 52,
  },
  {
    id: 'b-noorani-math-1',
    board: 'noorani_ctg',
    class_name: 'প্রথম শ্রেণি (Class 1)',
    title: 'নূরানী সহজ গণিত',
    subject_code: '১০৩',
    source_type: 'qawmi',
    total_chapters: 4,
    total_questions: 48,
  },
  {
    id: 'b-noorani-eng-1',
    board: 'noorani_ctg',
    class_name: 'প্রথম শ্রেণি (Class 1)',
    title: 'Noorani English Reader',
    subject_code: '১০৪',
    source_type: 'qawmi',
    total_chapters: 4,
    total_questions: 45,
  },
  {
    id: 'b-befaq-akaid-ibte',
    board: 'befaq',
    class_name: 'দ্বিতীয় শ্রেণি (Class 2)',
    title: 'আকাইদ ও ফিকহুল ইসলাম',
    subject_code: '২০১',
    source_type: 'qawmi',
    total_chapters: 6,
    total_questions: 72,
  },
  {
    id: 'b-befaq-arabic-2',
    board: 'befaq',
    class_name: 'দ্বিতীয় শ্রেণি (Class 2)',
    title: 'আত-তারীকু ইল্যাল আরাবিয়্যাহ',
    subject_code: '২০২',
    source_type: 'qawmi',
    total_chapters: 5,
    total_questions: 58,
  },
  {
    id: 'b-alia-islam-3',
    board: 'alia',
    class_name: 'তৃতীয় শ্রেণি (Class 3)',
    title: 'কুরআন মাজিদ ও তাজভিদ (ইবতেদায়ী)',
    subject_code: '৩০১',
    source_type: 'nctb',
    total_chapters: 6,
    total_questions: 68,
  },
  {
    id: 'b-nctb-bangla-4',
    board: 'nctb',
    class_name: 'চতুর্থ শ্রেণি (Class 4)',
    title: 'আমার বাংলা বই (NCTB)',
    subject_code: '৪০১',
    source_type: 'nctb',
    total_chapters: 7,
    total_questions: 84,
  },
  {
    id: 'b-salsabil-deeni-play',
    board: 'salsabil_jamjam',
    class_name: 'প্লে (Play)',
    title: 'ছোটদের দ্বীন শিক্ষা ও হরফ পরিচিতি',
    subject_code: '০০১',
    source_type: 'qawmi',
    total_chapters: 3,
    total_questions: 35,
  },
];

export const SEED_CHAPTERS: QBChapter[] = [
  // b-noorani-quran-1
  { id: 'ch-q-1', book_id: 'b-noorani-quran-1', chapter_no: 1, title: 'আরবি হরফ ও মাখরাজ পরিচিতি' },
  { id: 'ch-q-2', book_id: 'b-noorani-quran-1', chapter_no: 2, title: 'হারাকাত, তানভীন ও জযম' },
  { id: 'ch-q-3', book_id: 'b-noorani-quran-1', chapter_no: 3, title: 'মাদ্দের বিবরণ ও প্রকারভেদ' },
  { id: 'ch-q-4', book_id: 'b-noorani-quran-1', chapter_no: 4, title: 'নূন সাকিন ও তানভীনের ৪টি কায়দা' },
  { id: 'ch-q-5', book_id: 'b-noorani-quran-1', chapter_no: 5, title: 'সূরা ফাতিহা ও শেষ ৩টি সূরা' },

  // b-noorani-bangla-1
  { id: 'ch-bn-1', book_id: 'b-noorani-bangla-1', chapter_no: 1, title: 'স্বরবর্ণ ও ব্যঞ্জনবর্ণের সঠিক উচ্চারণ' },
  { id: 'ch-bn-2', book_id: 'b-noorani-bangla-1', chapter_no: 2, title: 'কার চিহ্ন ও ফলা যোগে শব্দ গঠন' },
  { id: 'ch-bn-3', book_id: 'b-noorani-bangla-1', chapter_no: 3, title: 'ছড়া ও কবিতা: ভোর হলো' },
  { id: 'ch-bn-4', book_id: 'b-noorani-bangla-1', chapter_no: 4, title: 'মহানবী (সা.)-এর শিশুকাল' },

  // b-befaq-akaid-ibte
  { id: 'ch-ak-1', book_id: 'b-befaq-akaid-ibte', chapter_no: 1, title: 'কালেমা তাইয়্যিবাহ ও কালেমা শাহাদাত' },
  { id: 'ch-ak-2', book_id: 'b-befaq-akaid-ibte', chapter_no: 2, title: 'ঈমানের সাতটি মূল স্তম্ভ' },
  { id: 'ch-ak-3', book_id: 'b-befaq-akaid-ibte', chapter_no: 3, title: 'ওযুর ফরজ, ওয়াজিব ও সুন্নত' },
  { id: 'ch-ak-4', book_id: 'b-befaq-akaid-ibte', chapter_no: 4, title: 'পাঁচ ওয়াক্ত নামাজের নিয়ম ও রাকাত' },

  // b-noorani-math-1
  { id: 'ch-m-1', book_id: 'b-noorani-math-1', chapter_no: 1, title: '১ থেকে ১০০ পর্যন্ত সংখ্যা গণনা' },
  { id: 'ch-m-2', book_id: 'b-noorani-math-1', chapter_no: 2, title: 'সহজ যোগ ও বিয়োগের ধারণা' },
  { id: 'ch-m-3', book_id: 'b-noorani-math-1', chapter_no: 3, title: 'নামতা (১ থেকে ৫ এর ঘর)' },

  // b-noorani-eng-1
  { id: 'ch-en-1', book_id: 'b-noorani-eng-1', chapter_no: 1, title: 'Alphabet Letters (Capital & Small)' },
  { id: 'ch-en-2', book_id: 'b-noorani-eng-1', chapter_no: 2, title: 'Words & Rhymes' },
  { id: 'ch-en-3', book_id: 'b-noorani-eng-1', chapter_no: 3, title: 'Islamic Greetings & Manners' },

  // b-salsabil-deeni-play
  { id: 'ch-play-1', book_id: 'b-salsabil-deeni-play', chapter_no: 1, title: 'মৌখিক প্রশ্ন: আল্লাহ কে?' },
  { id: 'ch-play-2', book_id: 'b-salsabil-deeni-play', chapter_no: 2, title: 'আরবি হরফ আলিফ থেকে ইয়া' },
];

export const SEED_QUESTIONS: QBQuestion[] = [
  // --- TAJWEED & QURAN (b-noorani-quran-1) ---
  {
    id: 'q-taj-1',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-1',
    category_type: 'mcq',
    question_text: 'আরবি হরফ মোট কতটি?',
    options: ['২৭টি', '২৮টি', '২৯টি', '৩০টি'],
    answer_text: '২৯টি',
    default_marks: 1,
  },
  {
    id: 'q-taj-2',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-1',
    category_type: 'mcq',
    question_text: 'মাখরাজ মোট কতটি?',
    options: ['১৫টি', '১৬টি', '১৭টি', '১৮টি'],
    answer_text: '১৭টি',
    default_marks: 1,
  },
  {
    id: 'q-taj-3',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-1',
    category_type: 'fill_in_the_blanks',
    question_text: 'হরফ উচ্চারণের স্থানকে __________ বলে।',
    answer_text: 'মাখরাজ',
    default_marks: 1,
  },
  {
    id: 'q-taj-4',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-1',
    category_type: 'one_word',
    question_text: 'হলকের শুরু থেকে কোন কোন হরফ উচ্চারিত হয়?',
    answer_text: 'হামযাহ ও হা (ء، هـ)',
    default_marks: 2,
  },
  {
    id: 'q-taj-5',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-2',
    category_type: 'mcq',
    question_text: 'এক জবর, এক যের, এক পেশকে কী বলে?',
    options: ['তানভীন', 'হারাকাত', 'জযম', 'তাশদীদ'],
    answer_text: 'হারাকাত',
    default_marks: 1,
  },
  {
    id: 'q-taj-6',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-2',
    category_type: 'fill_in_the_blanks',
    question_text: 'দুই জবর, দুই যের, দুই পেশকে __________ বলে।',
    answer_text: 'তানভীন',
    default_marks: 1,
  },
  {
    id: 'q-taj-7',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-3',
    category_type: 'short_question',
    question_text: 'মাদ্দের হরফ কয়টি ও কী কী?',
    answer_text: 'মাদ্দের হরফ ৩টি: আলিফ (ا), ওয়াও (و), ইয়া (ي)। জবরের বামে খালি আলিফ, পেশের বামে জযমওয়ালা ওয়াও, যেরের বামে জযমওয়ালা ইয়া।',
    default_marks: 3,
  },
  {
    id: 'q-taj-8',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-4',
    category_type: 'broad_question',
    question_text: 'নূন সাকিন ও তানভীনের ৪টি কায়দা বিস্তারিত উদাহরণসহ লেখো।',
    answer_text: 'নূন সাকিন ও তানভীনের কায়দা ৪টি: ১. ইজহার, ২. ইদগাম, ৩. ইকলাব, ৪. ইখফা।',
    default_marks: 5,
  },
  {
    id: 'q-taj-9',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-5',
    category_type: 'arabic_writing',
    question_text: 'সূরা ফাতিহার প্রথম ৩টি আয়াত নুকতা ও হারাকাতসহ সুন্দর করে লেখো:',
    answer_text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ',
    default_marks: 5,
  },
  {
    id: 'q-taj-10',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-1',
    category_type: 'true_false',
    question_text: 'কলকলাহর হরফ ৫টি: ক্বফ, ত্বর, বা, জীম, দাল।',
    answer_text: 'সত্য',
    default_marks: 1,
  },
  {
    id: 'q-taj-11',
    book_id: 'b-noorani-quran-1',
    chapter_id: 'ch-q-1',
    category_type: 'matching',
    question_text: 'সঠিক মাখরাজের সাথে হরফ মিল করো:',
    left_items: ['১ নম্বর মাখরাজ (হলকের শুরু)', '২ নম্বর মাখরাজ (হলকের মাঝখান)', '৩ নম্বর মাখরাজ (হলকের শেষ)', '৪ নম্বর মাখরাজ (জিহ্বার গোড়া)'],
    right_items: ['হামযাহ, হা (ء، هـ)', 'আইন, হা (ع، ح)', 'গাইন, খা (غ، خ)', 'ক্বফ (ق)'],
    answer_text: '১-হামযাহ হা, ২-আইন হা, ৩-গাইন খা, ৪-ক্বফ',
    default_marks: 4,
  },

  // --- BANGLA (b-noorani-bangla-1) ---
  {
    id: 'q-bn-1',
    book_id: 'b-noorani-bangla-1',
    chapter_id: 'ch-bn-1',
    category_type: 'mcq',
    question_text: 'বাংলা বর্ণমালায় মোট স্বরবর্ণ কতটি?',
    options: ['৯টি', '১০টি', '১১টি', '১২টি'],
    answer_text: '১১টি',
    default_marks: 1,
  },
  {
    id: 'q-bn-2',
    book_id: 'b-noorani-bangla-1',
    chapter_id: 'ch-bn-1',
    category_type: 'mcq',
    question_text: 'বাংলা বর্ণমালায় মোট ব্যঞ্জনবর্ণ কতটি?',
    options: ['৩৯টি', '৪০টি', '৪১টি', '৪২টি'],
    answer_text: '৩৯টি',
    default_marks: 1,
  },
  {
    id: 'q-bn-3',
    book_id: 'b-noorani-bangla-1',
    chapter_id: 'ch-bn-2',
    category_type: 'word_meaning',
    question_text: 'নিচের শব্দগুলোর অর্থ লেখো:',
    options: ['প্রভাত', 'কুসুম', 'আলসে', 'রোজ'],
    answer_text: 'প্রভাত = সকাল, কুসুম = ফুল, আলসে = অলস, রোজ = প্রতিদিন',
    default_marks: 4,
  },
  {
    id: 'q-bn-4',
    book_id: 'b-noorani-bangla-1',
    chapter_id: 'ch-bn-2',
    category_type: 'word_meaning',
    question_text: 'বিপরীত শব্দ লেখো:',
    options: ['সকাল', 'ভালো', 'দিন', 'আলো'],
    answer_text: 'সকাল - বিকাল, ভালো - মন্দ, দিন - রাত, আলো - আঁধার',
    default_marks: 4,
  },
  {
    id: 'q-bn-5',
    book_id: 'b-noorani-bangla-1',
    chapter_id: 'ch-bn-3',
    category_type: 'broad_question',
    question_text: "'ভোর হলো' কবিতার প্রথম চার লাইন কবি ও কবিতার নামসহ লেখো।",
    answer_text: 'ভোর হলো দোর খোলো / খুকুমণি ওঠো রে! / ওই ডাকে জুঁই-শাখে / ফুল-খুকী ছোট রে!',
    default_marks: 5,
  },
  {
    id: 'q-bn-6',
    book_id: 'b-noorani-bangla-1',
    chapter_id: 'ch-bn-4',
    category_type: 'short_question',
    question_text: 'মহানবী হযরত মুহাম্মদ (সা.) কত সালে কোথায় জন্মগ্রহণ করেন?',
    answer_text: 'মহানবী (সা.) ৫৭০ খ্রিস্টাব্দে সৌদি আরবের মক্কা নগরীর বিখ্যাত কুরাইশ বংশে জন্মগ্রহণ করেন।',
    default_marks: 2,
  },
  {
    id: 'q-bn-7',
    book_id: 'b-noorani-bangla-1',
    chapter_id: 'ch-bn-4',
    category_type: 'fill_in_the_blanks',
    question_text: 'আমাদের প্রিয় নবীর পিতার নাম ছিল __________।',
    answer_text: 'আব্দুল্লাহ',
    default_marks: 1,
  },

  // --- AKAID & FIQH (b-befaq-akaid-ibte) ---
  {
    id: 'q-ak-1',
    book_id: 'b-befaq-akaid-ibte',
    chapter_id: 'ch-ak-1',
    category_type: 'one_word',
    question_text: 'কালেমা তাইয়্যিবাহ অর্থসহ মুখে বলো ও খাতায় লেখো।',
    answer_text: 'লা ইলাহা ইল্লাল্লাহু মুহাম্মাদুর রাসুলুল্লাহ (সা.)। অর্থ: আল্লাহ ছাড়া কোনো উপাস্য নেই, মুহাম্মদ (সা.) আল্লাহর রাসূল।',
    default_marks: 2,
  },
  {
    id: 'q-ak-2',
    book_id: 'b-befaq-akaid-ibte',
    chapter_id: 'ch-ak-2',
    category_type: 'mcq',
    question_text: 'প্রধান আসমানী কিতাব কয়টি?',
    options: ['২টি', '৩টি', '৪টি', '৫টি'],
    answer_text: '৪টি',
    default_marks: 1,
  },
  {
    id: 'q-ak-3',
    book_id: 'b-befaq-akaid-ibte',
    chapter_id: 'ch-ak-3',
    category_type: 'short_question',
    question_text: 'ওযুর ফরজ কয়টি ও কী কী?',
    answer_text: 'ওযুর ফরজ ৪টি: ১. সম্পূর্ণ মুখমণ্ডল ধৌত করা, ২. দুই হাতের কনুইসহ ধৌত করা, ৩. মাথার চারভাগের একভাগ মাসেহ করা, ৪. দুই পায়ের টাখনুসহ ধৌত করা।',
    default_marks: 4,
  },
  {
    id: 'q-ak-4',
    book_id: 'b-befaq-akaid-ibte',
    chapter_id: 'ch-ak-4',
    category_type: 'mcq',
    question_text: 'দৈনিক পাঁচ ওয়াক্তে মোট কয় রাকাত ফরজ নামাজ আদায় করতে হয়?',
    options: ['১৫ রাকাত', '১৬ রাকাত', '১৭ রাকাত', '২০ রাকাত'],
    answer_text: '১৭ রাকাত',
    default_marks: 1,
  },
  {
    id: 'q-ak-5',
    book_id: 'b-befaq-akaid-ibte',
    chapter_id: 'ch-ak-3',
    category_type: 'true_false',
    question_text: 'গোসলের ফরজ ৩টি: কুলি করা, নাকে পানি দেওয়া এবং সমস্ত শরীর ভালো করে ধৌত করা।',
    answer_text: 'সত্য',
    default_marks: 1,
  },

  // --- MATHEMATICS (b-noorani-math-1) ---
  {
    id: 'q-m-1',
    book_id: 'b-noorani-math-1',
    chapter_id: 'ch-m-1',
    category_type: 'fill_in_the_blanks',
    question_text: 'সংখ্যাগুলোর মাঝের ঘর পূরণ করো: ২৫, ____, ২৭, ____, ২৯।',
    answer_text: '২৬, ২৮',
    default_marks: 2,
  },
  {
    id: 'q-m-2',
    book_id: 'b-noorani-math-1',
    chapter_id: 'ch-m-2',
    category_type: 'short_question',
    question_text: 'যোগফল নির্ণয় করো: ৩৫ + ২৪ = কত?',
    answer_text: '৫৯',
    default_marks: 2,
  },
  {
    id: 'q-m-3',
    book_id: 'b-noorani-math-1',
    chapter_id: 'ch-m-2',
    category_type: 'short_question',
    question_text: 'বিয়োগফল নির্ণয় করো: ৫০ - ১৮ = কত?',
    answer_text: '৩২',
    default_marks: 2,
  },
  {
    id: 'q-m-4',
    book_id: 'b-noorani-math-1',
    chapter_id: 'ch-m-3',
    category_type: 'broad_question',
    question_text: '৫-এর ঘরের নামতা সুন্দরভাবে খাতায় লেখো।',
    answer_text: '৫×১=৫, ৫×২=১০, ৫×৩=১৫, ৫×৪=২০, ৫×৫=২৫, ৫×৬=৩০, ৫×৭=৩৫, ৫×৮=৪০, ৫×৯=৪৫, ৫×১০=৫০',
    default_marks: 5,
  },

  // --- ENGLISH (b-noorani-eng-1) ---
  {
    id: 'q-en-1',
    book_id: 'b-noorani-eng-1',
    chapter_id: 'ch-en-1',
    category_type: 'fill_in_the_blanks',
    question_text: 'Write the missing small letters: a, b, ___, d, ___, f, g, ___',
    answer_text: 'c, e, h',
    default_marks: 3,
  },
  {
    id: 'q-en-2',
    book_id: 'b-noorani-eng-1',
    chapter_id: 'ch-en-2',
    category_type: 'one_word',
    question_text: 'Write two words starting with letter "B":',
    answer_text: 'Book, Boy',
    default_marks: 2,
  },
  {
    id: 'q-en-3',
    book_id: 'b-noorani-eng-1',
    chapter_id: 'ch-en-3',
    category_type: 'mcq',
    question_text: 'What do Muslims say when meeting someone?',
    options: ['Good Morning', 'Assalamu Alaikum', 'Hello', 'Goodbye'],
    answer_text: 'Assalamu Alaikum',
    default_marks: 1,
  },

  // --- PLAY / NURSERY (b-salsabil-deeni-play) ---
  {
    id: 'q-play-1',
    book_id: 'b-salsabil-deeni-play',
    chapter_id: 'ch-play-1',
    category_type: 'one_word',
    question_text: 'আমাদের সৃষ্টিকর্তা কে?',
    answer_text: 'আল্লাহ তায়ালা',
    default_marks: 2,
  },
  {
    id: 'q-play-2',
    book_id: 'b-salsabil-deeni-play',
    chapter_id: 'ch-play-1',
    category_type: 'one_word',
    question_text: 'আমাদের ধর্মের নাম কী?',
    answer_text: 'ইসলাম',
    default_marks: 2,
  },
  {
    id: 'q-play-3',
    book_id: 'b-salsabil-deeni-play',
    chapter_id: 'ch-play-2',
    category_type: 'arabic_writing',
    question_text: 'আরবি হরফ "আলিফ" থেকে "ছা" পর্যন্ত সুন্দর করে লেখো:',
    answer_text: 'ا  ب  ت  ث',
    default_marks: 4,
  },
];

// ----------------------------------------------------
// DEFAULT EXAM PAPER TEMPLATE GENERATOR
// ----------------------------------------------------
export function createDefaultPaper(madrasah?: any): QBSavedPaper {
  const mName = madrasah?.name || 'আল-জামিয়া আল-ইসলামিয়া মডেল মাদ্রাসা';
  const mAddress = madrasah?.address || 'কলেজ রোড, কুড়িগ্রাম সদর, বাংলাদেশ';

  return {
    id: 'paper-' + Date.now(),
    title: '১ম সাময়িক পরীক্ষা প্রশ্নপত্র - ২০২৬',
    exam_name: '১ম সাময়িক পরীক্ষা - ২০২৬ ইং',
    class_name: 'প্রথম শ্রেণি (Class 1)',
    subject_name: 'কুরআন মাজীদ ও তাজবীদ',
    total_marks: 50,
    time_duration: '২ ঘণ্টা ৩০ মিনিট',
    paper_config: {
      bismillah_type: 'arabic',
      madrasah_name: mName,
      madrasah_address: mAddress,
      exam_title: '১ম সাময়িক পরীক্ষা - ২০২৬ ইং',
      class_name: 'প্রথম শ্রেণি (Class 1)',
      subject_name: 'কুরআন মাজীদ ও তাজবীদ',
      subject_code: '১০১',
      time_duration: '২ ঘণ্টা ৩০ মিনিট',
      target_marks: 50,
      show_student_info_box: false,
      show_instructions: true,
      instructions_text: 'সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা প্রশ্নের মান নির্দেশ করে।',
      font_size: 14,
      line_height: 1.45,
      question_gap: 6,
      border_style: 'double',
      style_preset: 'noorani',
    },
    sections_data: [
      {
        id: 'sec-1',
        category_type: 'mcq',
        title: '১। সঠিক উত্তরটিতে টিক চিহ্ন (✓) দাও:',
        layout: '2_col',
        numbering_style: 'bangla_letter',
        direction: 'ltr',
        dotted_lines: 0,
        marks_formula: '১ × ৪ = ৪',
        total_marks: 4,
        questions: [
          {
            id: 'q-taj-1',
            question_text: 'আরবি হরফ মোট কতটি?',
            category_type: 'mcq',
            options: ['২৭টি', '২৮টি', '২৯টি', '৩০টি'],
            answer_text: '২৯টি',
            marks: 1,
          },
          {
            id: 'q-taj-2',
            question_text: 'মাখরাজ মোট কতটি?',
            category_type: 'mcq',
            options: ['১৫টি', '১৬টি', '১৭টি', '১৮টি'],
            answer_text: '১৭টি',
            marks: 1,
          },
          {
            id: 'q-taj-5',
            question_text: 'এক জবর, এক যের, এক পেশকে কী বলে?',
            category_type: 'mcq',
            options: ['তানভীন', 'হারাকাত', 'জযম', 'তাশদীদ'],
            answer_text: 'হারাকাত',
            marks: 1,
          },
          {
            id: 'q-ak-2',
            question_text: 'প্রধান আসমানী কিতাব কয়টি?',
            category_type: 'mcq',
            options: ['২টি', '৩টি', '৪টি', '৫টি'],
            answer_text: '৪টি',
            marks: 1,
          },
        ],
      },
      {
        id: 'sec-2',
        category_type: 'fill_in_the_blanks',
        title: '২। উপযুক্ত শব্দ বসিয়ে শূন্যস্থান পূরণ করো:',
        layout: '1_col',
        numbering_style: 'bangla_letter',
        direction: 'ltr',
        dotted_lines: 0,
        marks_formula: '১ × ৩ = ৩',
        total_marks: 3,
        word_box_options: ['মাখরাজ', 'তানভীন', 'আব্দুল্লাহ'],
        questions: [
          {
            id: 'q-taj-3',
            question_text: 'হরফ উচ্চারণের স্থানকে __________ বলে।',
            category_type: 'fill_in_the_blanks',
            answer_text: 'মাখরাজ',
            marks: 1,
          },
          {
            id: 'q-taj-6',
            question_text: 'দুই জবর, দুই যের, দুই পেশকে __________ বলে।',
            category_type: 'fill_in_the_blanks',
            answer_text: 'তানভীন',
            marks: 1,
          },
          {
            id: 'q-bn-7',
            question_text: 'আমাদের প্রিয় নবীর পিতার নাম ছিল __________।',
            category_type: 'fill_in_the_blanks',
            answer_text: 'আব্দুল্লাহ',
            marks: 1,
          },
        ],
      },
      {
        id: 'sec-3',
        category_type: 'short_question',
        title: '৩। সংক্ষেপে উত্তর দাও:',
        layout: '1_col',
        numbering_style: 'bangla_letter',
        direction: 'ltr',
        dotted_lines: 0,
        marks_formula: '৩ × ২ = ৬',
        total_marks: 6,
        questions: [
          {
            id: 'q-taj-7',
            question_text: 'মাদ্দের হরফ কয়টি ও কী কী?',
            category_type: 'short_question',
            answer_text: 'মাদ্দের হরফ ৩টি: আলিফ, ওয়াও, ইয়া।',
            marks: 3,
          },
          {
            id: 'q-bn-6',
            question_text: 'মহানবী হযরত মুহাম্মদ (সা.) কত সালে কোথায় জন্মগ্রহণ করেন?',
            category_type: 'short_question',
            answer_text: '৫৭০ খ্রিস্টাব্দে মক্কায় জন্মগ্রহণ করেন।',
            marks: 3,
          },
        ],
      },
      {
        id: 'sec-4',
        category_type: 'broad_question',
        title: '৪। বিস্তারিত উত্তর লেখো:',
        layout: '1_col',
        numbering_style: 'bangla_number',
        direction: 'ltr',
        dotted_lines: 0,
        marks_formula: '৫ × ২ = ১০',
        total_marks: 10,
        questions: [
          {
            id: 'q-taj-8',
            question_text: 'নূন সাকিন ও তানভীনের ৪টি কায়দা বিস্তারিত উদাহরণসহ লেখো।',
            category_type: 'broad_question',
            answer_text: 'কায়দা ৪টি: ইজহার, ইদগাম, ইকলাব ও ইখফা।',
            marks: 5,
          },
          {
            id: 'q-ak-3',
            question_text: 'ওযুর ফরজ কয়টি ও কী কী বিস্তারিত ব্যাখ্যা করো।',
            category_type: 'broad_question',
            answer_text: 'ওযুর ফরজ ৪টি।',
            marks: 5,
          },
        ],
      },
      {
        id: 'sec-5',
        category_type: 'arabic_writing',
        title: '৫। আরবি ক্যালিগ্রাফি ও হরফ সুন্দর করে খাতায় লেখো:',
        layout: '1_col',
        numbering_style: 'arabic_number',
        direction: 'rtl',
        dotted_lines: 0,
        marks_formula: '৫ × ১ = ৫',
        total_marks: 5,
        questions: [
          {
            id: 'q-taj-9',
            question_text: 'সূরা ফাতিহার প্রথম ৩টি আয়াত নুকতা ও হারাকাতসহ সুন্দর করে লেখো:',
            category_type: 'arabic_writing',
            answer_text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ',
            marks: 5,
          },
        ],
      },
    ],
    created_at: new Date().toISOString(),
  };
}

// ----------------------------------------------------
// BENGALI & BOARD NORMALIZATION HELPERS
// ----------------------------------------------------
export const normalizeBengaliText = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\u09AF\u09BC/g, '\u09DF') // normalize ya + nukta to yya (য় -> য়)
    .replace(/\u09A1\u09BC/g, '\u09DC') // normalize da + nukta to rra (ড়)
    .replace(/\u09A2\u09BC/g, '\u09DD') // normalize dha + nukta to rha (ঢ়)
    .replace(/['’‘`"]/g, '')            // remove punctuation/apostrophes like তা'লিমুল -> তালিমুল
    .trim()
    .toLowerCase();
};

export const normalizeBoardId = (boardInput?: string): string => {
  if (!boardInput) return 'all';
  const str = normalizeBengaliText(boardInput);
  if (str === 'all' || str === 'সকল' || str.includes('সকল বোর্ড')) return 'all';

  if (str.includes('chattogram') || str.includes('ctg') || str.includes('চট্টগ্রাম')) {
    return 'noorani_ctg';
  }
  if (str.includes('jatrabari') || str.includes('যাত্রাবাড়ী') || str.includes('যাত্রাবাড়ি')) {
    return 'noorani_jatrabari';
  }
  if (str.includes('noorani') || str.includes('নূরানী') || str.includes('নুরানী') || str.includes('তাঈলিমুল') || str.includes('তালিমুল')) {
    return 'noorani_ctg';
  }
  if (str.includes('befaq') || str.includes('বেফাক') || str.includes('কওমি') || str.includes('কওমী')) {
    return 'befaq';
  }
  if (
    str.includes('alia') ||
    str.includes('আলিয়া') ||
    str.includes('আলিয়া') ||
    str.includes('ইবতেদায়ী') ||
    str.includes('ইবতেদায়ি') ||
    str.includes('দাখিল')
  ) {
    return 'alia';
  }
  if (
    str.includes('nctb') ||
    str.includes('এনসিটিবি') ||
    str.includes('স্কুল') ||
    str.includes('সরকারি') ||
    str.includes('প্রাথমিক শিক্ষা')
  ) {
    return 'nctb';
  }
  if (
    str.includes('salsabil') ||
    str.includes('সালসাবিল') ||
    str.includes('জমজম') ||
    str.includes('ইতমিনান') ||
    str.includes('আন-নূর') ||
    str.includes('আন নূর')
  ) {
    return 'salsabil_jamjam';
  }

  return str;
};

export const doesBoardMatch = (bookBoard?: string, targetBoard?: string): boolean => {
  if (!targetBoard || targetBoard === 'all') return true;
  if (!bookBoard) return false;

  const targetNorm = normalizeBoardId(targetBoard);
  const bookNorm = normalizeBoardId(bookBoard);

  if (targetNorm === bookNorm) return true;

  // Direct string equality after text normalization
  const cleanTarget = normalizeBengaliText(targetBoard);
  const cleanBook = normalizeBengaliText(bookBoard);
  if (cleanBook === cleanTarget) return true;

  // Check board definition in SUPPORTED_BOARDS
  const targetObj = SUPPORTED_BOARDS.find((b) => b.id === targetBoard || b.name === targetBoard);
  if (targetObj) {
    if (bookBoard === targetObj.name || bookBoard === targetObj.id) return true;
    if (cleanBook.includes(normalizeBengaliText(targetObj.name)) || normalizeBengaliText(targetObj.name).includes(cleanBook)) {
      return true;
    }
  }

  return false;
};

export const doesClassMatch = (bookClass?: string, targetClass?: string): boolean => {
  if (!targetClass || targetClass === 'all' || targetClass.includes('সকল')) return true;
  if (!bookClass) return false;

  const normBook = normalizeBengaliText(bookClass);
  const normTarget = normalizeBengaliText(targetClass);

  if (normBook === normTarget) return true;
  if (normBook.includes(normTarget) || normTarget.includes(normBook)) return true;

  // Keyword / Number matching
  const classKeywords = [
    { keys: ['প্লে', 'play'], id: 'play' },
    { keys: ['নার্সারী', 'নার্সারি', 'nursery'], id: 'nursery' },
    { keys: ['প্রথম', '১', 'class 1', '১ম'], id: 'c1' },
    { keys: ['দ্বিতীয়', 'দ্বিতিয়', '২', 'class 2', '২য়'], id: 'c2' },
    { keys: ['তৃতীয়', 'তৃতিয়', '৩', 'class 3', '৩য়'], id: 'c3' },
    { keys: ['চতুর্থ', '৪', 'class 4', '৪র্থ'], id: 'c4' },
    { keys: ['পঞ্চম', '৫', 'class 5', '৫ম'], id: 'c5' },
    { keys: ['ষষ্ঠ', '৬', 'class 6', '৬ষ্ঠ'], id: 'c6' },
    { keys: ['সপ্তম', '৭', 'class 7', '৭ম'], id: 'c7' },
    { keys: ['অষ্টম', '৮', 'class 8', '৮ম'], id: 'c8' },
    { keys: ['দাখিল', 'নবম', 'দশম', '৯', '১০', 'class 9', 'class 10'], id: 'c910' },
    { keys: ['মুতাওয়াসসিতাহ', 'সানিয়াহ'], id: 'befaq_mut' },
    { keys: ['ফযীলত', 'তাকমীল'], id: 'befaq_tak' },
  ];

  for (const group of classKeywords) {
    const targetHas = group.keys.some((k) => normTarget.includes(k));
    const bookHas = group.keys.some((k) => normBook.includes(k));
    if (targetHas && bookHas) {
      return true;
    }
  }

  return false;
};

// ----------------------------------------------------
// SERVICE METHODS
// ----------------------------------------------------
export const questionBankService = {
  /**
   * Fetch books by Board and Class with smart normalization
   */
  async getBooks(board = 'all', className?: string): Promise<QBBook[]> {
    let supabaseBooks: QBBook[] = [];

    try {
      const { data, error } = await supabase.from('qb_books').select('*').order('title', { ascending: true });
      if (!error && data && data.length > 0) {
        supabaseBooks = data as QBBook[];
      }
    } catch (e) {
      console.warn('qb_books table lookup fallback:', e);
    }

    // Combine Supabase books with Seed Books (avoid duplicate IDs)
    const combinedMap = new Map<string, QBBook>();
    supabaseBooks.forEach((b) => combinedMap.set(b.id, b));
    SEED_BOOKS.forEach((b) => {
      if (!combinedMap.has(b.id)) {
        combinedMap.set(b.id, b);
      }
    });

    const allBooks = Array.from(combinedMap.values());

    // Filter books using robust board and class matching
    return allBooks.filter((b) => {
      const matchBoard = doesBoardMatch(b.board, board);
      const matchClass = doesClassMatch(b.class_name, className);
      return matchBoard && matchClass;
    });
  },

  /**
   * Fetch all chapters across the entire library
   */
  async getAllChapters(): Promise<QBChapter[]> {
    let supabaseChapters: QBChapter[] = [];

    try {
      const { data, error } = await supabase.from('qb_chapters').select('*').order('chapter_no', { ascending: true });
      if (!error && data && data.length > 0) {
        supabaseChapters = data as QBChapter[];
      }
    } catch (e) {
      console.warn('qb_chapters lookup error:', e);
    }

    const chapterMap = new Map<string, QBChapter>();
    supabaseChapters.forEach((c) => chapterMap.set(c.id, c));
    SEED_CHAPTERS.forEach((c) => {
      if (!chapterMap.has(c.id)) {
        chapterMap.set(c.id, c);
      }
    });

    return Array.from(chapterMap.values());
  },

  /**
   * Fetch chapters of a specific book or list of books
   */
  async getChapters(bookIdOrIds?: string | string[]): Promise<QBChapter[]> {
    if (!bookIdOrIds || bookIdOrIds === 'all') {
      return this.getAllChapters();
    }

    const targetIds = Array.isArray(bookIdOrIds) ? bookIdOrIds : [bookIdOrIds];
    if (targetIds.length === 0) return [];

    let supabaseChapters: QBChapter[] = [];

    try {
      const { data, error } = await supabase
        .from('qb_chapters')
        .select('*')
        .in('book_id', targetIds)
        .order('chapter_no', { ascending: true });

      if (!error && data && data.length > 0) {
        supabaseChapters = data as QBChapter[];
      }
    } catch (e) {
      console.warn('qb_chapters table lookup fallback to seed data:', e);
    }

    // Merge with seed chapters
    const chapterMap = new Map<string, QBChapter>();
    supabaseChapters.forEach((c) => chapterMap.set(c.id, c));
    SEED_CHAPTERS.filter((c) => targetIds.includes(c.book_id)).forEach((c) => {
      if (!chapterMap.has(c.id)) {
        chapterMap.set(c.id, c);
      }
    });

    return Array.from(chapterMap.values());
  },

  /**
   * Fetch questions with cascading filters (supports bookId or multiple bookIds)
   */
  async getQuestions(filter: {
    bookId?: string;
    bookIds?: string[];
    chapterId?: string;
    categoryType?: string;
    search?: string;
    limit?: number;
  }): Promise<QBQuestion[]> {
    let supabaseQuestions: QBQuestion[] = [];

    try {
      let query = supabase.from('qb_questions').select('*');
      if (filter.bookId && filter.bookId !== 'all') {
        query = query.eq('book_id', filter.bookId);
      } else if (filter.bookIds && filter.bookIds.length > 0) {
        query = query.in('book_id', filter.bookIds);
      }

      if (filter.chapterId && filter.chapterId !== 'all') {
        query = query.eq('chapter_id', filter.chapterId);
      }
      if (filter.categoryType && filter.categoryType !== 'all') {
        query = query.eq('category_type', filter.categoryType);
      }
      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        supabaseQuestions = data as QBQuestion[];
      }
    } catch (e) {
      console.warn('qb_questions table lookup fallback to seed data:', e);
    }

    // Merge with seed questions
    const qMap = new Map<string, QBQuestion>();
    supabaseQuestions.forEach((q) => qMap.set(q.id, q));

    const targetBookIds = filter.bookId && filter.bookId !== 'all'
      ? [filter.bookId]
      : filter.bookIds && filter.bookIds.length > 0
      ? filter.bookIds
      : null;

    SEED_QUESTIONS.forEach((q) => {
      if (targetBookIds && !targetBookIds.includes(q.book_id)) {
        return;
      }
      if (filter.chapterId && filter.chapterId !== 'all' && q.chapter_id !== filter.chapterId) {
        return;
      }
      if (filter.categoryType && filter.categoryType !== 'all' && q.category_type !== filter.categoryType) {
        return;
      }
      if (!qMap.has(q.id)) {
        qMap.set(q.id, q);
      }
    });

    let results = Array.from(qMap.values());

    if (filter.search && filter.search.trim()) {
      const s = filter.search.toLowerCase().trim();
      results = results.filter(
        (q) =>
          q.question_text?.toLowerCase().includes(s) ||
          q.answer_text?.toLowerCase().includes(s) ||
          q.options?.some((opt) => opt.toLowerCase().includes(s))
      );
    }

    return results;
  },

  /**
   * Save Question Paper to Supabase and LocalStorage
   */
  async savePaper(paper: QBSavedPaper, madrasaId?: string): Promise<{ success: boolean; id: string }> {
    const paperToSave: QBSavedPaper = {
      ...paper,
      madrasa_id: madrasaId || paper.madrasa_id,
      updated_at: new Date().toISOString(),
    };

    // 1. Always save in localStorage for instant reliability
    try {
      const existing = localStorage.getItem('deenora_saved_question_papers');
      const list: QBSavedPaper[] = existing ? JSON.parse(existing) : [];
      const index = list.findIndex((p) => p.id === paperToSave.id);
      if (index >= 0) {
        list[index] = paperToSave;
      } else {
        list.unshift(paperToSave);
      }
      localStorage.setItem('deenora_saved_question_papers', JSON.stringify(list.slice(0, 30)));
    } catch (lsErr) {
      console.warn('LocalStorage save failed:', lsErr);
    }

    // 2. Save in Supabase
    try {
      const { data, error } = await supabase
        .from('qb_saved_papers')
        .upsert(
          {
            id: paperToSave.id,
            madrasa_id: paperToSave.madrasa_id,
            title: paperToSave.title,
            exam_name: paperToSave.exam_name,
            class_name: paperToSave.class_name,
            subject_name: paperToSave.subject_name,
            total_marks: paperToSave.total_marks,
            time_duration: paperToSave.time_duration,
            paper_config: paperToSave.paper_config,
            sections_data: paperToSave.sections_data,
            updated_at: paperToSave.updated_at,
          },
          { onConflict: 'id' }
        )
        .select('id')
        .single();

      if (!error && data?.id) {
        return { success: true, id: data.id };
      }
    } catch (e) {
      console.warn('Supabase save error (saved in local fallback):', e);
    }

    return { success: true, id: paperToSave.id };
  },

  /**
   * Load Saved Papers for a Madrasa
   */
  async getSavedPapers(madrasaId?: string): Promise<QBSavedPaper[]> {
    let supabaseList: QBSavedPaper[] = [];

    if (madrasaId) {
      try {
        const { data, error } = await supabase
          .from('qb_saved_papers')
          .select('*')
          .eq('madrasa_id', madrasaId)
          .order('updated_at', { ascending: false });
        if (!error && data) {
          supabaseList = data as QBSavedPaper[];
        }
      } catch (e) {
        console.warn('Failed to load saved papers from Supabase:', e);
      }
    }

    // LocalStorage papers
    let localList: QBSavedPaper[] = [];
    try {
      const raw = localStorage.getItem('deenora_saved_question_papers');
      if (raw) localList = JSON.parse(raw);
    } catch (e) {}

    // Merge by id
    const map = new Map<string, QBSavedPaper>();
    [...supabaseList, ...localList].forEach((p) => {
      if (p.id && !map.has(p.id)) {
        map.set(p.id, p);
      }
    });

    return Array.from(map.values());
  },

  /**
   * Delete a saved paper
   */
  async deleteSavedPaper(paperId: string): Promise<boolean> {
    try {
      await supabase.from('qb_saved_papers').delete().eq('id', paperId);
    } catch (e) {}

    try {
      const raw = localStorage.getItem('deenora_saved_question_papers');
      if (raw) {
        const list: QBSavedPaper[] = JSON.parse(raw);
        const filtered = list.filter((p) => p.id !== paperId);
        localStorage.setItem('deenora_saved_question_papers', JSON.stringify(filtered));
      }
    } catch (e) {}

    return true;
  },

  /**
   * 1-Click Auto Question Paper Generator
   */
  async autoGenerateExam(criteria: {
    bookId: string;
    chapterIds?: string[];
    mcqCount: number;
    fillBlankCount: number;
    shortCount: number;
    broadCount: number;
    arabicCount: number;
  }): Promise<PaperSection[]> {
    const allQuestions = await this.getQuestions({ bookId: criteria.bookId });

    const filterByChapter = (qs: QBQuestion[]) => {
      if (!criteria.chapterIds || criteria.chapterIds.length === 0 || criteria.chapterIds.includes('all')) {
        return qs;
      }
      return qs.filter((q) => criteria.chapterIds!.includes(q.chapter_id));
    };

    const chapterFiltered = filterByChapter(allQuestions);

    const pickRandom = (qs: QBQuestion[], count: number) => {
      const shuffled = [...qs].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    const sections: PaperSection[] = [];
    let secCounter = 1;

    // 1. MCQ Section
    if (criteria.mcqCount > 0) {
      const mcqQs = pickRandom(
        chapterFiltered.filter((q) => q.category_type === 'mcq'),
        criteria.mcqCount
      );
      if (mcqQs.length > 0) {
        const marks = mcqQs.reduce((acc, q) => acc + (q.default_marks || 1), 0);
        sections.push({
          id: 'sec-' + Date.now() + '-1',
          category_type: 'mcq',
          title: `${toBnNum(secCounter++)}। সঠিক উত্তরটি বেছে নিয়ে লেখো:`,
          layout: '2_col',
          numbering_style: 'bangla_letter',
          direction: 'ltr',
          dotted_lines: 0,
          marks_formula: `১ × ${toBnNum(mcqQs.length)} = ${toBnNum(marks)}`,
          total_marks: marks,
          questions: mcqQs.map((q) => ({
            id: 'q-' + Math.random().toString(36).substring(2, 9),
            original_id: q.id,
            question_text: q.question_text,
            category_type: q.category_type,
            options: q.options,
            answer_text: q.answer_text,
            marks: q.default_marks || 1,
          })),
        });
      }
    }

    // 2. Fill in the blanks
    if (criteria.fillBlankCount > 0) {
      const fbQs = pickRandom(
        chapterFiltered.filter((q) => q.category_type === 'fill_in_the_blanks'),
        criteria.fillBlankCount
      );
      if (fbQs.length > 0) {
        const marks = fbQs.reduce((acc, q) => acc + (q.default_marks || 1), 0);
        sections.push({
          id: 'sec-' + Date.now() + '-2',
          category_type: 'fill_in_the_blanks',
          title: `${toBnNum(secCounter++)}। উপযুক্ত শব্দ বসিয়ে শূন্যস্থান পূরণ করো:`,
          layout: '1_col',
          numbering_style: 'bangla_letter',
          direction: 'ltr',
          dotted_lines: 0,
          marks_formula: `১ × ${toBnNum(fbQs.length)} = ${toBnNum(marks)}`,
          total_marks: marks,
          questions: fbQs.map((q) => ({
            id: 'q-' + Math.random().toString(36).substring(2, 9),
            original_id: q.id,
            question_text: q.question_text,
            category_type: q.category_type,
            answer_text: q.answer_text,
            marks: q.default_marks || 1,
          })),
        });
      }
    }

    // 3. Short Questions
    if (criteria.shortCount > 0) {
      const sqQs = pickRandom(
        chapterFiltered.filter((q) => q.category_type === 'short_question' || q.category_type === 'one_word'),
        criteria.shortCount
      );
      if (sqQs.length > 0) {
        const marks = sqQs.reduce((acc, q) => acc + (q.default_marks || 2), 0);
        sections.push({
          id: 'sec-' + Date.now() + '-3',
          category_type: 'short_question',
          title: `${toBnNum(secCounter++)}। সংক্ষেপে উত্তর দাও:`,
          layout: '1_col',
          numbering_style: 'bangla_letter',
          direction: 'ltr',
          dotted_lines: 0,
          marks_formula: `২ × ${toBnNum(sqQs.length)} = ${toBnNum(marks)}`,
          total_marks: marks,
          questions: sqQs.map((q) => ({
            id: 'q-' + Math.random().toString(36).substring(2, 9),
            original_id: q.id,
            question_text: q.question_text,
            category_type: q.category_type,
            answer_text: q.answer_text,
            marks: q.default_marks || 2,
          })),
        });
      }
    }

    // 4. Broad Questions
    if (criteria.broadCount > 0) {
      const bqQs = pickRandom(
        chapterFiltered.filter((q) => q.category_type === 'broad_question'),
        criteria.broadCount
      );
      if (bqQs.length > 0) {
        const marks = bqQs.reduce((acc, q) => acc + (q.default_marks || 5), 0);
        sections.push({
          id: 'sec-' + Date.now() + '-4',
          category_type: 'broad_question',
          title: `${toBnNum(secCounter++)}। নিচের যেকোনো প্রশ্নগুলোর বিস্তারিত উত্তর লেখো:`,
          layout: '1_col',
          numbering_style: 'bangla_number',
          direction: 'ltr',
          dotted_lines: 0,
          marks_formula: `৫ × ${toBnNum(bqQs.length)} = ${toBnNum(marks)}`,
          total_marks: marks,
          questions: bqQs.map((q) => ({
            id: 'q-' + Math.random().toString(36).substring(2, 9),
            original_id: q.id,
            question_text: q.question_text,
            category_type: q.category_type,
            answer_text: q.answer_text,
            marks: q.default_marks || 5,
          })),
        });
      }
    }

    // 5. Arabic Writing
    if (criteria.arabicCount > 0) {
      const arQs = pickRandom(
        chapterFiltered.filter((q) => q.category_type === 'arabic_writing'),
        criteria.arabicCount
      );
      if (arQs.length > 0) {
        const marks = arQs.reduce((acc, q) => acc + (q.default_marks || 5), 0);
        sections.push({
          id: 'sec-' + Date.now() + '-5',
          category_type: 'arabic_writing',
          title: `${toBnNum(secCounter++)}। আরবি হরফ ও আয়াত সুন্দর করে খাতায় লেখো:`,
          layout: '1_col',
          numbering_style: 'arabic_number',
          direction: 'rtl',
          dotted_lines: 0,
          marks_formula: `৫ × ${toBnNum(arQs.length)} = ${toBnNum(marks)}`,
          total_marks: marks,
          questions: arQs.map((q) => ({
            id: 'q-' + Math.random().toString(36).substring(2, 9),
            original_id: q.id,
            question_text: q.question_text,
            category_type: q.category_type,
            answer_text: q.answer_text,
            marks: q.default_marks || 5,
          })),
        });
      }
    }

    return sections;
  },
};

export const QuestionBankService = questionBankService;

export const toBnNum = (n: number | string): string => {
  return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
};

export const toArabicNum = (n: number | string): string => {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
};

export const getNumberingLabel = (
  idx: number,
  style: PaperSection['numbering_style']
): string => {
  const banglaLetters = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন'];
  const englishLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'];

  switch (style) {
    case 'bangla_letter':
      return (banglaLetters[idx] || `(${toBnNum(idx + 1)})`) + ')';
    case 'bangla_number':
      return `${toBnNum(idx + 1)}।`;
    case 'english_number':
      return `${idx + 1}.`;
    case 'english_letter':
      return `(${englishLetters[idx] || idx + 1})`;
    case 'arabic_number':
      return `${toArabicNum(idx + 1)} -`;
    case 'bullet':
      return '•';
    case 'none':
      return '';
    default:
      return `${toBnNum(idx + 1)}।`;
  }
};
