import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseAdmin();
  const body = req.body || {};
  const query = req.query || {};
  const action = body.action || query.action || 'list';

  try {
    if (action === 'list' || req.method === 'GET') {
      const institutionId = (query.institution_id || query.institutionId || body.institution_id || body.institutionId) as string;
      if (!institutionId) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', institutionId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, classes: data || [] });
    }

    if (action === 'create' && req.method === 'POST') {
      const { class_name, institution_id, sort_order } = body;
      if (!class_name || !institution_id) {
        return res.status(400).json({ error: 'class_name and institution_id are required' });
      }

      const { data, error } = await supabase
        .from('classes')
        .insert({
          class_name: String(class_name).trim(),
          institution_id: String(institution_id).trim(),
          sort_order: sort_order != null ? Number(sort_order) : null
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, class: data });
    }

    if (action === 'update' && req.method === 'POST') {
      const { id, class_name, sort_order } = body;
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const updateData: any = {};
      if (class_name !== undefined) updateData.class_name = String(class_name).trim();
      if (sort_order !== undefined) updateData.sort_order = sort_order != null ? Number(sort_order) : null;

      const { data, error } = await supabase
        .from('classes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, class: data });
    }

    if (action === 'delete' && req.method === 'POST') {
      const { id, institution_id: bodyInstId } = body;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id is required' });
      }

      // Fetch class row first to verify existence and authoritative tenant ownership
      const { data: classRow, error: classFetchErr } = await supabase
        .from('classes')
        .select('id, institution_id')
        .eq('id', id)
        .maybeSingle();

      if (classFetchErr) throw classFetchErr;
      if (!classRow) {
        return res.status(404).json({ error: 'Class not found' });
      }

      const instId = classRow.institution_id as string;
      if (!bodyInstId || String(bodyInstId).trim() !== instId) {
        return res.status(403).json({ error: 'Forbidden: Class does not belong to this institution' });
      }

      // If a Bearer token is provided, strictly validate the token and institution ownership
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized: Missing access token' });
        }
        const { data: authData, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !authData?.user) {
          return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        }
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('institution_id, role')
          .eq('id', authData.user.id)
          .maybeSingle();

        const isSuperAdmin = userProfile?.role === 'super_admin';
        const belongsToInstitution = userProfile?.institution_id === instId;

        if (!isSuperAdmin && !belongsToInstitution) {
          // Also check if user is a branch/owner admin via institutions table
          const { data: ownedInst } = await supabase
            .from('institutions')
            .select('id')
            .eq('id', instId)
            .eq('user_id', authData.user.id)
            .maybeSingle();
          if (!ownedInst) {
            return res.status(403).json({ error: 'Forbidden: Unauthorized institution access' });
          }
        }
      }

      const deleteDependentStudentRecords = async (studentIds: string[]) => {
        if (!studentIds.length) return;
        const studentDependentTables = [
          'attendance',
          'fees',
          'student_fee_settings',
          'exam_marks',
          'befaq_exam_marks',
          'befaq_results',
          'hifz_records',
          'hostel_allocations',
          'hostel_leaves',
          'hostel_meal_logs',
          'library_issues',
          'app_notifications',
        ];
        const CHUNK_SIZE = 200;
        for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
          const chunk = studentIds.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            studentDependentTables.map(async (table) => {
              try {
                await supabase.from(table).delete().in('student_id', chunk);
              } catch {
                // ignore optional tables
              }
            })
          );
        }
      };

      // 1. Fetch all students belonging to this class
      const { data: classStudents } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', id)
        .eq('institution_id', instId);

      const studentIds = (classStudents || []).map((s: any) => s.id).filter(Boolean);

      // 2. Delete dependent records for those students (attendance, fees, marks, etc.)
      await deleteDependentStudentRecords(studentIds);

      // 3. Delete students belonging to this class
      const { error: delStudentsErr } = await supabase
        .from('students')
        .delete()
        .eq('class_id', id)
        .eq('institution_id', instId);
      if (delStudentsErr) throw delStudentsErr;

      // 4. Clean up class-level dependent tables before deleting the class
      const classDependentTables = ['attendance', 'sections', 'fee_structures', 'class_routines'];
      await Promise.all(
        classDependentTables.map(async (table) => {
          try {
            await supabase.from(table).delete().eq('class_id', id);
          } catch {
            // ignore optional tables
          }
        })
      );

      // 5. Delete the class itself
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id)
        .eq('institution_id', instId);
      if (error) throw error;

      // 6. If all classes for this institution have been deleted, clean up any legacy orphaned students (class_id IS NULL)
      const { count: remainingClasses } = await supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', instId);

      if (remainingClasses === 0) {
        const { data: orphanStudents } = await supabase
          .from('students')
          .select('id')
          .eq('institution_id', instId)
          .is('class_id', null);
        const orphanIds = (orphanStudents || []).map((s: any) => s.id).filter(Boolean);
        if (orphanIds.length > 0) {
          await deleteDependentStudentRecords(orphanIds);
          await supabase
            .from('students')
            .delete()
            .eq('institution_id', instId)
            .is('class_id', null);
        }
      }

      return res.status(200).json({ success: true, deleted_students: studentIds.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error('[API Classes Error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
