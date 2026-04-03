
import { getSupabaseAdmin } from '../lib/supabase-admin';
import * as crypto from 'crypto';

export default async function handler(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;
  if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  
  // More robust action detection for Vercel rewrites
  let action = pathname.split('/').pop();
  if (action === 'teachers' || !action) {
    // If rewritten to /api/teachers, check query param or original path
    action = (req.query.action as string) || (req.headers['x-original-action'] as string) || 'list';
  }

  console.log(`Teachers API: ${req.method} ${pathname} (action: ${action})`);

  try {
    const supabase = getSupabaseAdmin();
    
    // Ensure body is parsed if it's a string (Vercel usually does this, but just in case)
    if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        console.warn('Failed to parse req.body as JSON:', e);
      }
    }
    
    const body = req.body || {};
    if (action === 'login' && req.method === 'POST') {
      const { mobile, password } = body;
      if (!mobile || !password) {
        return res.status(400).json({ error: 'Mobile and password are required' });
      }
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      const { data: teacher, error } = await supabase.rpc('check_teacher_login', { 
        p_mobile: mobile, 
        p_password_hash: passwordHash 
      });
      if (error) throw error;
      if (!teacher || teacher.length === 0) {
        return res.status(401).json({ error: 'Invalid mobile number or password' });
      }
      const teacherData = teacher[0];
      let parsedPermissions = teacherData.permissions || {};
      if (typeof teacherData.permissions === 'string') {
        try {
          parsedPermissions = JSON.parse(teacherData.permissions);
        } catch (e) {
          console.error('Failed to parse permissions for teacher login', teacherData.id, teacherData.permissions);
          parsedPermissions = {};
        }
      }
      await supabase.from('teachers').update({ last_login_at: new Date().toISOString() }).eq('id', teacherData.id);
      return res.status(200).json({ 
        user: {
          id: teacherData.id,
          role: 'teacher',
          name: teacherData.teacher_name,
          institute_id: teacherData.institution_id,
          designation: teacherData.designation,
          photo_url: teacherData.photo_url,
          permissions: parsedPermissions
        }
      });
    }

    if (action === 'list' && req.method === 'GET') {
      const institute_id = req.query.institute_id || url.searchParams.get('institute_id');
      if (!institute_id) return res.status(400).json({ error: 'Institute ID is required' });
      const { data: teachers, error } = await supabase.from('teachers').select('*').eq('institution_id', institute_id).order('created_at', { ascending: false });
      if (error) throw error;
      const formattedTeachers = (teachers || []).map(t => {
        let parsedPermissions = t.permissions || {};
        if (typeof t.permissions === 'string') {
          try {
            parsedPermissions = JSON.parse(t.permissions);
          } catch (e) {
            console.error('Failed to parse permissions for teacher list', t.id, t.permissions);
            parsedPermissions = {};
          }
        }
        return {
          ...t,
          permissions: parsedPermissions
        };
      });
      return res.status(200).json({ teachers: formattedTeachers });
    }

    if (action === 'create' && req.method === 'POST') {
      const { institute_id, name, phone, pin, designation, photo_url, permissions } = body;
      if (!institute_id || !name || !phone || !pin) return res.status(400).json({ error: 'Required fields missing' });
      
      console.log('Creating teacher:', { institute_id, name, phone });

      const { data: teacher, error: teacherError } = await supabase.from('teachers').insert({
        institution_id: institute_id,
        name,
        phone,
        pin,
        designation,
        photo_url,
        permissions: permissions || {},
        is_active: true
      }).select().single();
      if (teacherError) throw teacherError;
      return res.status(201).json({ success: true, teacher });
    }

    if (action === 'update' && req.method === 'PUT') {
      const { id, name, phone, pin, designation, photo_url, is_active, permissions } = body;
      if (!id) return res.status(400).json({ error: 'Teacher ID is required' });
      const updateData: any = { name, phone, designation, photo_url, is_active, permissions };
      if (pin) updateData.pin = pin;
      const { error: teacherError } = await supabase.from('teachers').update(updateData).eq('id', id);
      if (teacherError) throw teacherError;
      return res.status(200).json({ success: true });
    }

    if (action === 'delete' && req.method === 'DELETE') {
      const id = req.query.id || body?.id;
      if (!id) return res.status(400).json({ error: 'Teacher ID is required' });
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'permissions' && req.method === 'POST') {
      const { teacher_id, permissions } = body;
      if (!teacher_id || !permissions) return res.status(400).json({ error: 'Teacher ID and permissions are required' });
      const { error } = await supabase.from('teacher_permissions').upsert({ teacher_id, ...permissions });
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (err: any) {
    console.error(`Teachers API error (${action}):`, err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', JSON.stringify(err, null, 2));
    
    res.status(500).json({ 
      error: err.message || err.error_description || 'Internal server error',
      details: err.details || err.hint || null,
      code: err.code || null
    });
  }
}
