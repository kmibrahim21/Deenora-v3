
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req, res) {
  const { method, body, query } = req;
  const action = query.action || body.action;

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();

    if (action === 'create_institution') {
      const { name, phone, email, password, institution_type } = body;

      if (!name || !phone || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      console.log('Admin API: Creating institution:', { name, email, phone });

      // 1. Create the auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim(),
        password: password.trim(),
        email_confirm: true,
        user_metadata: { 
          name: name.trim(),
          madrasah_name: name.trim()
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          // User exists, try to find them
          const { data: existingUsers, error: findError } = await supabase.auth.admin.listUsers();
          if (findError) throw findError;
          const existingUser = existingUsers.users.find(u => u.email === email.trim());
          if (!existingUser) throw new Error('User already exists but could not be found');
          
          return await setupInstitution(supabase, existingUser.id, body, res);
        }
        throw authError;
      }

      return await setupInstitution(supabase, authData.user.id, body, res);
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (err: any) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

async function setupInstitution(supabase, userId, body, res) {
  const { name, phone, email, institution_type } = body;

  // 2. Create/Update the institution record
  const { data: instData, error: instError } = await supabase.from('institutions').upsert({
    id: userId,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    institution_type: institution_type || 'madrasah',
    is_active: true,
    is_super_admin: false,
    status: 'active',
    config_json: {
      modules: {
        attendance: true,
        results: true,
        admit_card: true,
        seat_plan: true,
        accounting: true,
        academic_year_promotion: true,
        voice_broadcast: true,
        sms: true
      },
      result_engine: 'school',
      result_system: 'grading',
      fee_structure: 'monthly',
      ui_mode: 'madrasah'
    }
  }).select().single();

  if (instError) throw instError;

  // 3. Create/Update the profile record
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    institution_id: userId,
    full_name: name.trim(),
    role: 'madrasah_admin',
    is_active: true
  });

  if (profileError) throw profileError;

  return res.status(200).json({ 
    success: true, 
    user_id: userId,
    institution: instData
  });
}
