-- Migration: Library Management Module Tables
-- Safe execution, does not modify existing tables.

CREATE TABLE IF NOT EXISTS public.library_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT,
    category TEXT,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    available_quantity INTEGER NOT NULL DEFAULT 1,
    rack_number TEXT,
    description TEXT,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_library_books_inst ON public.library_books(institution_id);
CREATE INDEX IF NOT EXISTS idx_library_books_class ON public.library_books(class_id);

-- RLS
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view books of their institution" ON public.library_books;
DROP POLICY IF EXISTS "Users can insert books for their institution" ON public.library_books;
DROP POLICY IF EXISTS "Users can update books of their institution" ON public.library_books;
DROP POLICY IF EXISTS "Users can delete books of their institution" ON public.library_books;

CREATE POLICY "Users can view books of their institution" 
    ON public.library_books FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert books for their institution" 
    ON public.library_books FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = library_books.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

CREATE POLICY "Users can update books of their institution" 
    ON public.library_books FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = library_books.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

CREATE POLICY "Users can delete books of their institution" 
    ON public.library_books FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = library_books.institution_id 
            AND role IN ('madrasah_admin', 'super_admin')
        )
    );


CREATE TABLE IF NOT EXISTS public.library_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
    user_type TEXT NOT NULL CHECK (user_type IN ('student', 'teacher')),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    return_date DATE,
    status TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'lost')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_issues_inst ON public.library_issues(institution_id);
CREATE INDEX IF NOT EXISTS idx_library_issues_book ON public.library_issues(book_id);
CREATE INDEX IF NOT EXISTS idx_library_issues_student ON public.library_issues(student_id);

ALTER TABLE public.library_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view issues of their institution" ON public.library_issues;
DROP POLICY IF EXISTS "Users can insert issues for their institution" ON public.library_issues;
DROP POLICY IF EXISTS "Users can update issues of their institution" ON public.library_issues;
DROP POLICY IF EXISTS "Users can delete issues of their institution" ON public.library_issues;

CREATE POLICY "Users can view issues of their institution" 
    ON public.library_issues FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert issues for their institution" 
    ON public.library_issues FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = library_issues.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

CREATE POLICY "Users can update issues of their institution" 
    ON public.library_issues FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = library_issues.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

CREATE POLICY "Users can delete issues of their institution" 
    ON public.library_issues FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = library_issues.institution_id 
            AND role IN ('madrasah_admin', 'super_admin')
        )
    );
