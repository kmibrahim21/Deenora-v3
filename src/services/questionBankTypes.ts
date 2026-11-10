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
