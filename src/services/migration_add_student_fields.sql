-- Add mother_name and registration_number columns to students table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='mother_name') THEN
        ALTER TABLE students ADD COLUMN mother_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='registration_number') THEN
        ALTER TABLE students ADD COLUMN registration_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='notes') THEN
        ALTER TABLE students ADD COLUMN notes TEXT;
    END IF;
END $$;
