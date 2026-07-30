import { getSupabaseAdmin } from './lib/supabase-admin.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get all teachers
    const { data: allTeachers, error: tError } = await supabase.from('teachers').select('*');
    if (tError) throw tError;
    
    const today = '2026-07-29'; // Let's check for today
    
    // Group by institution_id
    const instGroups = {};
    allTeachers.forEach(t => {
      if (!instGroups[t.institution_id]) {
        instGroups[t.institution_id] = [];
      }
      instGroups[t.institution_id].push(t);
    });
    
    console.log('Checking all institutions for mismatch on date:', today);
    for (const [instId, teachers] of Object.entries(instGroups)) {
      const totalCount = teachers.length;
      
      // Filter teachers using the exact frontend logic:
      const visibleInAttendance = teachers.filter(teacher => {
        let parsedPermissions = teacher.permissions || {};
        if (typeof teacher.permissions === 'string') {
          try { parsedPermissions = JSON.parse(teacher.permissions); } catch(e) {}
        }
        const join_date = parsedPermissions.join_date;
        const leave_date = parsedPermissions.leave_date;
        
        if (join_date && today < join_date) {
          return false;
        }
        if (leave_date && today > leave_date) {
          return false;
        }
        return true;
      });
      
      if (totalCount !== visibleInAttendance.length) {
        const { data: inst } = await supabase.from('institutions').select('name').eq('id', instId).single();
        console.log(`\nMISMATCH FOUND!`);
        console.log(`Institution: ${inst?.name} (${instId})`);
        console.log(`Total Teachers in List: ${totalCount}`);
        console.log(`Visible in Attendance: ${visibleInAttendance.length}`);
        
        console.log('All Teachers in this institution:');
        teachers.forEach(t => {
          let parsedPermissions = t.permissions || {};
          if (typeof t.permissions === 'string') {
            try { parsedPermissions = JSON.parse(t.permissions); } catch(e) {}
          }
          const join_date = parsedPermissions.join_date;
          const leave_date = parsedPermissions.leave_date;
          const is_visible = visibleInAttendance.some(vt => vt.id === t.id);
          console.log(`- ${t.teacher_name} (ID: ${t.id}): Active: ${t.is_active}, Join: ${join_date}, Leave: ${leave_date}, Visible in Att: ${is_visible}`);
        });
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
