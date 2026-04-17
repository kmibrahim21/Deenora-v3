
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req, res) {
  const { method, body, query } = req;
  const action = query.action || body.action;

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: Missing token' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { data: adminProfile } = await supabase.from('institutions').select('is_super_admin').eq('id', user.id).single();
    if (!adminProfile?.is_super_admin) {
      return res.status(403).json({ error: 'Forbidden: Requires Super Admin' });
    }

    if (action === 'sync_all_to_sheet') {
      const { data: allInsts, error: fetchErr } = await supabase.from('institutions').select('*').eq('is_super_admin', false);
      if (fetchErr) throw fetchErr;

      const sheetUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;
      if (!sheetUrl) return res.status(400).json({ error: 'Sheet URL not configured' });

      const formattedInsts = allInsts.map(inst => ({
        sync_date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
        reg_date: new Date(inst.created_at || Date.now()).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
        id: inst.id,
        name: inst.name,
        phone: inst.phone,
        email: inst.email,
        type: inst.institution_type || 'madrasah',
        status: inst.is_active ? 'Active' : 'Inactive',
        modules: inst.config_json?.modules ? Object.keys(inst.config_json.modules).filter(k => inst.config_json.modules[k]).join(', ') : ''
      }));

      await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_add_institutions', institutions: formattedInsts })
      });

      return res.status(200).json({ success: true, count: formattedInsts.length });
    }

    if (action === 'create_institution') {
      const { name, phone, email, password, institution_type } = body;

      if (!name || !phone || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      console.log('Admin API: Creating institution:', { name, email: trimmedEmail, phone });

      // 1. Check if user already exists in auth to avoid "Database error checking email"
      let userId: string | null = null;
      
      try {
        // Try to find user by email using Admin API
        const { data: userData, error: findError } = await supabase.auth.admin.listUsers();
        if (!findError && userData?.users) {
          const existingUser = userData.users.find(u => u.email?.toLowerCase() === trimmedEmail);
          if (existingUser) {
            userId = existingUser.id;
            console.log('User already exists in auth:', userId);
          }
        }
      } catch (e) {
        console.warn('Error checking for existing user:', e);
      }

      if (!userId) {
        // 2. Create the auth user if not found
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: trimmedEmail,
          password: password.trim(),
          email_confirm: true,
          user_metadata: { 
            name: name.trim(),
            madrasah_name: name.trim()
          }
        });

        if (authError) {
          console.error('Auth creation error:', authError);
          // If it still says already registered, try one more time to find them
          if (authError.message.includes('already registered')) {
            const { data: listData } = await supabase.auth.admin.listUsers();
            const found = listData?.users?.find(u => u.email?.toLowerCase() === trimmedEmail);
            if (found) {
              userId = found.id;
            } else {
              throw authError;
            }
          } else {
            throw authError;
          }
        } else {
          userId = authData.user.id;
        }
      }

      if (!userId) throw new Error('Failed to obtain User ID');

      return await setupInstitution(supabase, userId, body, res);
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

  // 4. Send data to Google Sheets (Web App URL)
  try {
    const sheetUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;
    if (sheetUrl) {
      await fetch(sheetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add_institution',
          sync_date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
          reg_date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
          id: userId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          type: institution_type || 'madrasah',
          status: 'Active',
          modules: 'attendance, results, admit_card, seat_plan, accounting, academic_year_promotion, voice_broadcast, sms'
        }),
      });
      console.log('Successfully sent institution data to Google Sheets');
    }
  } catch (sheetError) {
    console.error('Failed to send data to Google Sheets:', sheetError);
  }

  return res.status(200).json({ 
    success: true, 
    user_id: userId,
    institution: instData
  });
}
