
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import * as crypto from 'crypto';

export default async function handler(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;
  if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  
  // More robust action detection for Vercel rewrites
  let action = url.searchParams.get('action') || (req.query?.action as string);
  
  if (!action) {
    const parts = pathname.split('/');
    action = parts.pop();
    // Handle cases where action might be 'teachers' or 'teachers.ts' due to rewrites
    if (action === 'teachers' || action === 'teachers.ts' || !action) {
      action = (req.headers['x-original-action'] as string) || 'list';
    }
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
      
      // Generate deterministic auth credentials
      const authEmail = `t_${teacherData.id}@deenora.local`;
      const authPassword = crypto.createHash('sha256').update(teacherData.id + (process.env.VITE_SUPABASE_URL || '')).digest('hex').substring(0, 16) + 'Aa1!';
      
      // Ensure Supabase Auth user exists with the same ID
      const { data: existingUser, error: getUserError } = await supabase.auth.admin.getUserById(teacherData.id);
      
      if (getUserError || !existingUser?.user) {
        const { error: createError } = await supabase.auth.admin.createUser({
          id: teacherData.id,
          email: authEmail,
          password: authPassword,
          email_confirm: true,
          user_metadata: { role: 'teacher' }
        });
        if (createError && !createError.message.includes('already exists')) {
          console.error('Failed to create auth user for teacher:', createError);
        }
      } else {
        // Update password just in case
        await supabase.auth.admin.updateUserById(teacherData.id, { password: authPassword });
      }
      
      // Upsert profile to ensure RLS works
      await supabase.from('profiles').upsert({
        id: teacherData.id,
        institution_id: teacherData.institution_id,
        full_name: teacherData.teacher_name,
        role: 'teacher',
        permissions: parsedPermissions,
        is_active: teacherData.is_active
      });

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
        },
        auth: {
          email: authEmail,
          password: authPassword
        }
      });
    }

    if (action === 'list' && req.method === 'GET') {
      const institute_id = req.query.institute_id || url.searchParams.get('institute_id');
      if (!institute_id) return res.status(400).json({ error: 'Institute ID is required' });
      const { data: teachers, error } = await supabase.from('teachers').select('*').eq('institution_id', institute_id).order('created_at', { ascending: false });
      if (error) throw error;
      if (teachers && teachers.length > 0) {
        console.log('Teacher keys:', Object.keys(teachers[0]));
      }
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
          name: t.teacher_name,
          phone: t.mobile,
          permissions: parsedPermissions
        };
      });
      return res.status(200).json({ teachers: formattedTeachers });
    }

    if (action === 'create' && req.method === 'POST') {
      const { institute_id, name, phone, pin, designation, photo_url, permissions } = body;
      if (!institute_id || !name || !phone || !pin) return res.status(400).json({ error: 'Required fields missing' });
      
      console.log('Creating teacher:', { institute_id, name, phone });

      const passwordHash = crypto.createHash('sha256').update(pin).digest('hex');

      const { data: teacher, error: teacherError } = await supabase.from('teachers').insert({
        institution_id: institute_id,
        teacher_name: name,
        mobile: phone,
        password_hash: passwordHash,
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
      const updateData: any = { teacher_name: name, mobile: phone, designation, photo_url, is_active, permissions };
      if (pin) {
        updateData.password_hash = crypto.createHash('sha256').update(pin).digest('hex');
      }
      const { error: teacherError } = await supabase.from('teachers').update(updateData).eq('id', id);
      if (teacherError) throw teacherError;
      return res.status(200).json({ success: true });
    }

    if (action === 'delete' && req.method === 'DELETE') {
      const id = req.query.id || url.searchParams.get('id') || body?.id;
      if (!id) return res.status(400).json({ error: 'Teacher ID is required' });
      
      console.log('Deleting teacher:', id);
      
      // Also delete from profiles and auth if possible
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) throw error;
      
      // Cleanup profile too
      await supabase.from('profiles').delete().eq('id', id);
      
      // Cleanup teacher_permissions too
      await supabase.from('teacher_permissions').delete().eq('teacher_id', id);
      
      // Delete auth user
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(id);
        if (authError && !authError.message.includes('User not found') && !authError.message.includes('user not found')) {
          console.warn('Failed to delete auth user:', authError.message);
        }
      } catch (e: any) {
        if (e?.message && !e.message.includes('User not found') && !e.message.includes('user not found')) {
          console.warn('Error deleting auth user:', e);
        }
      }
      
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
    
    // Safely extract error message
    const errorMessage = err.message || err.error_description || 'Internal server error';
    const errorCode = err.code || null;
    const errorDetails = err.details || err.hint || null;

    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      code: errorCode
    });
  }
}
