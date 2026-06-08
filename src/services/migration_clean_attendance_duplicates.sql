-- Clean up duplicate attendance records keeping only the most recent one
DELETE FROM attendance
WHERE id NOT IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER(PARTITION BY institution_id, class_id, student_id, date, COALESCE(session, 'daily') ORDER BY created_at DESC) as rn
        FROM attendance
    ) t
    WHERE t.rn = 1
);

-- Note: We do not add a UNIQUE constraint yet because we need to be careful about COALESCE in unique index, 
-- but this script cleans up the existing mess.
