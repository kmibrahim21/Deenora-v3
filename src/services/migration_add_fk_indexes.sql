-- Performance Indexes for Foreign Keys identified by Supabase Advisor
-- These indexes will dramatically improve JOIN and RLS evaluation performance.

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_institution_id ON profiles(institution_id);

-- Classes
CREATE INDEX IF NOT EXISTS idx_classes_institution_id ON classes(institution_id);

-- Students
CREATE INDEX IF NOT EXISTS idx_students_institution_id ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_academic_year_id ON students(academic_year_id);

-- Teachers
CREATE INDEX IF NOT EXISTS idx_teachers_institution_id ON teachers(institution_id);

-- Exams
CREATE INDEX IF NOT EXISTS idx_exams_institution_id ON exams(institution_id);
CREATE INDEX IF NOT EXISTS idx_exams_class_id ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_academic_year_id ON exams(academic_year_id);

-- Exam Subjects
CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam_id ON exam_subjects(exam_id);

-- Exam Marks
CREATE INDEX IF NOT EXISTS idx_exam_marks_exam_id ON exam_marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student_id ON exam_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_subject_id ON exam_marks(subject_id);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_institution_id ON attendance(institution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_academic_year_id ON attendance(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_by ON attendance(recorded_by);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date); -- often queried

-- Ledger
CREATE INDEX IF NOT EXISTS idx_ledger_institution_id ON ledger(institution_id);
CREATE INDEX IF NOT EXISTS idx_ledger_academic_year_id ON ledger(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_date ON ledger(transaction_date);

-- Fee Structures
CREATE INDEX IF NOT EXISTS idx_fee_structures_institution_id ON fee_structures(institution_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_class_id ON fee_structures(class_id);

-- Fees
CREATE INDEX IF NOT EXISTS idx_fees_institution_id ON fees(institution_id);
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_class_id ON fees(class_id);
CREATE INDEX IF NOT EXISTS idx_fees_academic_year_id ON fees(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_month ON fees(month);

-- Student Fee Settings
CREATE INDEX IF NOT EXISTS idx_student_fee_settings_inst_id ON student_fee_settings(institution_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_settings_stud_id ON student_fee_settings(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_settings_fee_str_id ON student_fee_settings(fee_structure_id);

-- Academic Years
CREATE INDEX IF NOT EXISTS idx_academic_years_institution_id ON academic_years(institution_id);

-- Promotion Logs
CREATE INDEX IF NOT EXISTS idx_promotion_logs_institution_id ON promotion_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_student_id ON promotion_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_academic_year_from ON promotion_logs(academic_year_from);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_academic_year_to ON promotion_logs(academic_year_to);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_executed_by ON promotion_logs(executed_by);

-- Voice Templates
CREATE INDEX IF NOT EXISTS idx_voice_templates_institution_id ON voice_templates(institution_id);

-- Calendar Events
CREATE INDEX IF NOT EXISTS idx_calendar_events_institution_id ON calendar_events(institution_id);

-- Sponsors & Sponsorships
CREATE INDEX IF NOT EXISTS idx_sponsors_institution_id ON sponsors(institution_id);
CREATE INDEX IF NOT EXISTS idx_student_sponsorships_student_id ON student_sponsorships(student_id);
CREATE INDEX IF NOT EXISTS idx_student_sponsorships_sponsor_id ON student_sponsorships(sponsor_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_institution_id ON transactions(institution_id);

-- SMS Templates
CREATE INDEX IF NOT EXISTS idx_sms_templates_institution_id ON sms_templates(institution_id);

-- Final Results
CREATE INDEX IF NOT EXISTS idx_final_results_institution_id ON final_results(institution_id);
CREATE INDEX IF NOT EXISTS idx_final_results_class_id ON final_results(class_id);
CREATE INDEX IF NOT EXISTS idx_final_results_academic_year_id ON final_results(academic_year_id);

-- Final Result Exams
CREATE INDEX IF NOT EXISTS idx_final_result_exams_final_result_id ON final_result_exams(final_result_id);
CREATE INDEX IF NOT EXISTS idx_final_result_exams_exam_id ON final_result_exams(exam_id);

-- Befaq Exams & Marks
CREATE INDEX IF NOT EXISTS idx_befaq_exams_institution_id ON befaq_exams(institution_id);
CREATE INDEX IF NOT EXISTS idx_befaq_exams_marhala_id ON befaq_exams(marhala_id);
CREATE INDEX IF NOT EXISTS idx_befaq_exams_academic_year_id ON befaq_exams(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_befaq_subjects_exam_id ON befaq_subjects(exam_id);
CREATE INDEX IF NOT EXISTS idx_befaq_results_exam_id ON befaq_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_befaq_results_student_id ON befaq_results(student_id);
CREATE INDEX IF NOT EXISTS idx_befaq_results_subject_id ON befaq_results(subject_id);

-- Qawmi Result Configs
CREATE INDEX IF NOT EXISTS idx_qawmi_result_configs_institution_id ON qawmi_result_configs(institution_id);

-- Inform PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
