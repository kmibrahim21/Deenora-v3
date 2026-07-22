
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
    const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    
    const isSuperAdmin = !!adminProfile?.is_super_admin;
    const isManager = userProfile?.role === 'manager';

    if (!isSuperAdmin && !isManager) {
      return res.status(403).json({ error: 'Forbidden: Requires Super Admin or Manager role' });
    }

    if (action === 'get_global_stats') {
      const [studentsRes, classesRes, teachersRes, transactionsRes, instsRes, stockRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('sms_count, amount, module, description, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(10000),
        supabase.from('institutions').select('sms_balance, balance, is_active, institution_type, config_json').eq('is_super_admin', false),
        supabase.from('admin_sms_stock').select('remaining_sms').single()
      ]);

      const totalAllocated = transactionsRes.data?.reduce((sum, t) => sum + (Number(t.sms_count) || 0), 0) || 0;
      
      const subTransactions = transactionsRes.data?.filter(t => 
        t.module === 'subscription' || 
        (t.description?.toLowerCase().includes('subscription')) || 
        (t.description?.toLowerCase().includes('package')) ||
        (t.description?.toLowerCase().includes('renew')) ||
        (t.description?.toLowerCase().includes('প্যাকেজ')) ||
        (t.description?.toLowerCase().includes('সাবস্ক্রিপশন'))
      ) || [];
      const subRev = subTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      
      const totalInWallets = instsRes.data?.reduce((sum, m) => sum + (Number(m.sms_balance) || 0), 0) || 0;
      const sentCount = Math.max(0, totalAllocated - totalInWallets);
      
      const voiceTransactions = transactionsRes.data?.filter(t => t.module === 'voice' || (t.module === 'sms' || !t.module ? (t.description || '').toLowerCase().includes('voice') : false)) || [];
      const totalVoiceRecharged = voiceTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const totalVoiceBalance = instsRes.data?.reduce((sum, m) => sum + (Number(m.balance) || 0), 0) || 0;
      const spentVoiceTk = Math.max(0, totalVoiceRecharged - totalVoiceBalance);
      
      const smsRev = Math.round(sentCount * 0.10);
      const voiceRev = Math.round((spentVoiceTk / 0.5) * 0.15);
      
      const monthlySubscriptionRevenue = subTransactions.reduce((acc: Record<string, number>, t) => {
        const date = new Date(t.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {});

      const totalRevenue = smsRev + voiceRev + subRev;
      const activeInsts = instsRes.data?.filter(m => m.is_active).length || 0;
      const adminStock = stockRes.data?.remaining_sms || 0;

      const typeBreakdown = instsRes.data?.reduce((acc: any, m) => {
        const type = m.institution_type || 'madrasah';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, { madrasah: 0, school: 0, kindergarten: 0, choching: 0, system: 0 });

      // Add student/class count aggregation if instsRes includes it
      // But instsRes currently doesn't have it.
      // We'll rely on the head:true counts for totals.

      return res.status(200).json({
        totalStudents: studentsRes.count || 0,
        totalClasses: classesRes.count || 0,
        totalTeachers: teachersRes.count || 0,
        totalDistributedSMS: totalAllocated,
        totalSentSMS: sentCount,
        currentInUserWallets: totalInWallets,
        smsRevenue: smsRev,
        voiceRevenue: voiceRev,
        subscriptionRevenue: subRev,
        monthlySubscriptionRevenue,
        totalRevenue,
        pendingApprovals: 0, // Will be fetched separately if needed or add here
        totalInstitutions: instsRes.data?.length || 0,
        activeInstitutions: activeInsts,
        totalVoiceBalance,
        adminSMSStock: adminStock,
        typeBreakdown
      });
    }

    if (action === 'get_detailed_report') {
      const { filterMode, month, year } = body;
      let startDate: Date;
      let endDate: Date;
      
      if (filterMode === 'monthly') {
        const [y, m] = month.split('-');
        startDate = new Date(Number(y), Number(m) - 1, 1);
        endDate = new Date(Number(y), Number(m), 0, 23, 59, 59);
      } else {
        startDate = new Date(Number(year), 0, 1);
        endDate = new Date(Number(year), 11, 31, 23, 59, 59);
      }

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      const [txRes, smsLogsRes, voiceBroadcastsRes] = await Promise.all([
        supabase.from('transactions').select('amount, description, module').eq('status', 'approved').gte('created_at', startISO).lte('created_at', endISO).limit(10000),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('voice_broadcasts').select('total_numbers').gte('created_at', startISO).lte('created_at', endISO).limit(10000)
      ]);
      
      const transactions = txRes.data || [];
      
      const subTransactions = transactions.filter(t => 
        t.module === 'subscription' || 
        (t.description?.toLowerCase().includes('subscription')) || 
        (t.description?.toLowerCase().includes('package')) ||
        (t.description?.toLowerCase().includes('renew')) ||
        (t.description?.toLowerCase().includes('প্যাকেজ')) ||
        (t.description?.toLowerCase().includes('সাবস্ক্রিপশন'))
      );
      const subRechargeTotal = subTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

      const smsTransactions = transactions.filter(t => {
        const isSmsModule = t.module === 'sms' || !t.module;
        const desc = (t.description || '').toLowerCase();
        const isVoice = desc.includes('voice');
        const isSub = desc.includes('subscription') || desc.includes('package') || desc.includes('renew') || desc.includes('প্যাকেজ') || desc.includes('সাবস্ক্রিপশন');
        return isSmsModule && !isVoice && !isSub;
      });
      const smsRechargeTotal = smsTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

      const voiceTransactions = transactions.filter(t => t.module === 'voice' || (t.module === 'sms' || !t.module ? (t.description || '').toLowerCase().includes('voice') : false));
      const voiceRechargeTotal = voiceTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

      const smsSentNum = smsLogsRes.count || 0;
      const voiceCallsNum = (voiceBroadcastsRes.data || []).reduce((sum, t) => sum + (Number(t.total_numbers) || 0), 0) || 0;

      return res.status(200).json({
        smsRechargeTotal,
        voiceRechargeTotal,
        subRechargeTotal,
        smsSentNum,
        voiceCallsNum
      });
    }

    if (action === 'get_all_institutions') {
      const { data, error } = await supabase.from('institutions')
        .select('*, student_count:students(count), class_count:classes(count)')
        .eq('is_super_admin', false)
        .neq('name', 'SYSTEM_GLOBAL_INTERNAL')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return res.status(200).json({ institutions: data || [] });
    }

    if (action === 'sync_all_to_sheet') {
      const { data: allInsts, error: fetchErr } = await supabase.from('institutions').select('*').eq('is_super_admin', false);
      if (fetchErr) throw fetchErr;

      const sheetUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;
      if (!sheetUrl) return res.status(400).json({ error: 'Sheet URL not configured' });

      const formattedInsts = allInsts.map(inst => {
        const config = typeof inst.config_json === 'string' ? JSON.parse(inst.config_json) : (inst.config_json || {});
        return {
          id: inst.id || '',
          code: config?.institute_code || 'N/A',
          name: inst.name || '',
          address: inst.address || 'N/A',
          subscription_type: config?.package_name || 'Free',
          phone: inst.phone || '',
          email: inst.email || '',
          type: inst.institution_type || 'madrasah'
        };
      });

      await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_add_institutions', institutions: formattedInsts })
      });

      return res.status(200).json({ success: true, count: formattedInsts.length });
    }

    if (action === 'activate_module_for_all') {
      const { module_name } = body;
      if (!module_name) return res.status(400).json({ error: 'Module name is required' });

      // Get all institutions
      const { data: allInsts, error: fetchErr } = await supabase.from('institutions').select('id, config_json');
      if (fetchErr) throw fetchErr;

      let count = 0;
      for (const inst of allInsts) {
        const config = typeof inst.config_json === 'string' ? JSON.parse(inst.config_json) : (inst.config_json || {});
        if (!config.modules) config.modules = {};
        
        // Only update if it's not already true to avoid unnecessary writes
        if (config.modules[module_name] !== true) {
          config.modules[module_name] = true;
          await supabase.from('institutions').update({ config_json: config }).eq('id', inst.id);
          count++;
        }
      }

      return res.status(200).json({ success: true, updated: count, total: allInsts.length });
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

    if (action === 'create_staff') {
      const { name, email, password, role } = body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: trimmedEmail,
        password: password.trim(),
        email_confirm: true,
        user_metadata: { name: name.trim() }
      });

      if (authError) throw authError;
      const userId = authData.user.id;

      // 2. Find system institution ID
      const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').single();
      let sysId = sysInst?.id;

      if (!sysId) {
        // Create if missing
        const { data: newSys } = await supabase.from('institutions').insert([{
          name: 'SYSTEM_GLOBAL_INTERNAL',
          institution_type: 'system',
          is_active: true,
          is_super_admin: false,
          theme: 'default'
        }]).select('id').single();
        sysId = newSys?.id;
      }

      // 3. Create profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        institution_id: sysId,
        full_name: name.trim(),
        role: role, // 'manager' or 'super_admin'
        is_active: true
      });

      if (profileError) throw profileError;

      return res.status(200).json({ success: true, user_id: userId });
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
      student_limit: 200,
      modules: {
        attendance: true,
        exam: true,
        results: true,
        admit_card: true,
        seat_plan: true,
        exam_routine: true,
        accounting: true,
        academic_year_promotion: false,
        voice_broadcast: true,
        sms: true,
        messages: false,
        certificates: true,
        class_routine: true,
        parent_portal: false,
        backup_restore: false
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
          id: userId,
          code: '',
          name: name.trim(),
          address: '',
          subscription_type: 'Free',
          phone: phone.trim(),
          email: email.trim(),
          type: institution_type || 'madrasah'
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
