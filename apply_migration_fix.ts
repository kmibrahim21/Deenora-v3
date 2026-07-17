
import { getSupabaseAdmin } from './lib/supabase-admin.ts';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const admin = getSupabaseAdmin();
  const sql = `
    -- 1. Clean up duplicate befaq_results records keeping the latest one
    DELETE FROM befaq_results
    WHERE id NOT IN (
        SELECT id
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER(PARTITION BY exam_id, student_id, subject_id ORDER BY created_at DESC) as rn
            FROM befaq_results
        ) t
        WHERE t.rn = 1
    );

    -- 2. Add the UNIQUE constraint to ensure ON CONFLICT works for befaq_results
    ALTER TABLE befaq_results 
    DROP CONSTRAINT IF EXISTS befaq_results_exam_student_subject_unique;
    
    ALTER TABLE befaq_results 
    ADD CONSTRAINT befaq_results_exam_student_subject_unique UNIQUE (exam_id, student_id, subject_id);
  `;
  console.log('Running unique constraint migration for befaq_results...');
  const { data, error } = await admin.rpc('run_sql', {
    sql: sql
  });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}
main();
