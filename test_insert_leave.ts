import { getSupabaseAdmin } from './lib/supabase-admin';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const admin = getSupabaseAdmin();
  const { data: inst } = await admin.from('institutions').select('id').limit(1).single();
  if (!inst) {
    console.error('No institution found');
    return;
  }
  const { data: std } = await admin.from('students').select('id, class_id').eq('institution_id', inst.id).limit(1).single();
  if (!std) {
    console.error('No student found');
    return;
  }

  console.log('Testing insert status "leave" for student:', std.id);
  const testDate = '2020-01-01'; // dummy old date to not conflict

  // Try to delete dummy test row if exists
  await admin.from('attendance').delete().eq('student_id', std.id).eq('date', testDate);

  const { data, error } = await admin.from('attendance').insert({
    institution_id: inst.id,
    student_id: std.id,
    class_id: std.class_id,
    status: 'leave',
    date: testDate
  }).select();

  if (error) {
    console.error('Error inserting status "leave":', error.message || error);
  } else {
    console.log('Successfully inserted status "leave":', data);
    // Cleanup
    await admin.from('attendance').delete().eq('student_id', std.id).eq('date', testDate);
  }
}

main();
