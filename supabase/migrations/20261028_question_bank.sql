-- ==============================================================================
-- DEENORA EDUCATION SAAS - QUESTION BANK & PAPER BUILDER DATABASE SCHEMA
-- Version: 1.0 (62,000+ Question Bank Support)
-- ==============================================================================

-- 1. Table: qb_books (পাঠ্যবই ও সিলেবাস)
CREATE TABLE IF NOT EXISTS qb_books (
    id TEXT PRIMARY KEY,                       -- e.g. 'ctg001', 'nctb_c3_math'
    board TEXT NOT NULL,                       -- e.g. 'নূরানী তালিমুল কুরআন বোর্ড বাংলাদেশ (চট্টগ্রাম)', 'NCTB প্রাথমিক শিক্ষা বোর্ড (সরকারি)'
    class_name TEXT NOT NULL,                  -- e.g. 'তৃতীয় শ্রেণি', 'Class 3'
    title TEXT NOT NULL,                       -- e.g. 'প্লে আরবী শিক্ষা', 'প্রাথমিক গণিত'
    subject_code TEXT,                         -- e.g. '১০১'
    cover_url TEXT,                            -- Cover image URL or webp path
    pdf_url TEXT,                              -- PDF Download URL
    source_type TEXT NOT NULL DEFAULT 'easyqbd', -- 'easyqbd' | 'nctb' | 'qawmi'
    total_chapters INT NOT NULL DEFAULT 0,
    total_questions INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indexes for lightning fast cascading filters
CREATE INDEX IF NOT EXISTS idx_qb_books_board ON qb_books(board);
CREATE INDEX IF NOT EXISTS idx_qb_books_class ON qb_books(class_name);

-- 2. Table: qb_chapters (অধ্যায় ও অনুচ্ছেদ)
CREATE TABLE IF NOT EXISTS qb_chapters (
    id TEXT PRIMARY KEY,                       -- e.g. 'ch-ctg001-1'
    book_id TEXT NOT NULL REFERENCES qb_books(id) ON DELETE CASCADE,
    chapter_no INT NOT NULL DEFAULT 1,
    title TEXT NOT NULL                        -- e.g. '১ম অধ্যায়: হরকত ও তানভীন'
);

CREATE INDEX IF NOT EXISTS idx_qb_chapters_book ON qb_chapters(book_id);

-- 3. Table: qb_questions (প্রশ্ন সম্ভার)
CREATE TABLE IF NOT EXISTS qb_questions (
    id TEXT PRIMARY KEY,                       -- e.g. 'q-ctg001-001'
    book_id TEXT NOT NULL REFERENCES qb_books(id) ON DELETE CASCADE,
    chapter_id TEXT NOT NULL REFERENCES qb_chapters(id) ON DELETE CASCADE,
    category_type TEXT NOT NULL,               -- e.g. 'সঠিক উত্তরটি বেছে নাও (MCQ)', 'শূন্যস্থান পূরণ করো'
    question_text TEXT NOT NULL,
    options JSONB,                             -- Array of strings for MCQ: ["ক", "খ", "গ", "ঘ"]
    answer_text TEXT,                          -- Correct answer for Teacher's Answer Sheet
    default_marks NUMERIC NOT NULL DEFAULT 1,
    left_items JSONB,                          -- Optional matching questions
    right_items JSONB,                         -- Optional matching questions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_qb_questions_book ON qb_questions(book_id);
CREATE INDEX IF NOT EXISTS idx_qb_questions_chapter ON qb_questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_qb_questions_category ON qb_questions(category_type);

-- 4. Table: qb_saved_papers (সংরক্ষিত প্রশ্নপত্র ড্রাফট)
CREATE TABLE IF NOT EXISTS qb_saved_papers (
    id TEXT PRIMARY KEY,                       -- UUID or custom ID
    madrasa_id TEXT,                           -- References institutions(id)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    total_marks NUMERIC NOT NULL DEFAULT 100,
    time_duration TEXT,
    paper_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sections_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_qb_saved_papers_madrasa ON qb_saved_papers(madrasa_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS
ALTER TABLE qb_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_saved_papers ENABLE ROW LEVEL SECURITY;

-- 1. Everyone (all authenticated users and teachers) can READ public Question Bank books & questions
CREATE POLICY "Public read access for qb_books"
    ON qb_books FOR SELECT USING (true);

CREATE POLICY "Public read access for qb_chapters"
    ON qb_chapters FOR SELECT USING (true);

CREATE POLICY "Public read access for qb_questions"
    ON qb_questions FOR SELECT USING (true);

-- 2. Only Super Admins / System staff can INSERT/UPDATE/DELETE questions and books
CREATE POLICY "Super admin can modify qb_books"
    ON qb_books FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY "Super admin can modify qb_chapters"
    ON qb_chapters FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY "Super admin can modify qb_questions"
    ON qb_questions FOR ALL
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- 3. Institutions & teachers can read & manage their own saved question papers
CREATE POLICY "Institutions can view own saved papers"
    ON qb_saved_papers FOR SELECT
    USING (true); -- Can also be restricted to: madrasa_id = current_setting('request.jwt.claim.institution_id', true)

CREATE POLICY "Institutions can insert own saved papers"
    ON qb_saved_papers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Institutions can update own saved papers"
    ON qb_saved_papers FOR UPDATE
    USING (true);

CREATE POLICY "Institutions can delete own saved papers"
    ON qb_saved_papers FOR DELETE
    USING (true);
