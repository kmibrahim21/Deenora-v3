
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

    if (action === 'update_institution') {
      const { id, ...updateFields } = body;
      if (!id) return res.status(400).json({ error: 'Institution ID is required' });

      // If updating config_json, ensure it's handled as an object
      if (updateFields.config_json && typeof updateFields.config_json === 'string') {
        try {
          updateFields.config_json = JSON.parse(updateFields.config_json);
        } catch (e) {
          // ignore
        }
      }

      const { data, error } = await supabase
        .from('institutions')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (action === 'delete_institution') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Institution ID is required' });

      // Delete the institution (cascades should handle profiles/students etc in DB)
      const { error } = await supabase.from('institutions').delete().eq('id', id);
      if (error) throw error;
      
      // Also delete from auth if possible
      try {
        await supabase.auth.admin.deleteUser(id);
      } catch (e) {
        console.warn('Failed to delete auth user during institution deletion:', e);
      }

      return res.status(200).json({ success: true });
    }

    if (action === 'update_staff') {
      const { id, name, email, password, role, permissions, is_active } = body;
      if (!id) return res.status(400).json({ error: 'Staff ID is required' });

      const updates: any = {};
      if (name !== undefined) updates.full_name = name;
      if (role !== undefined) updates.role = role;
      if (permissions !== undefined) updates.permissions = permissions;
      if (is_active !== undefined) updates.is_active = is_active;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);

      if (profileError) throw profileError;

      // Update auth user if name/email/password changed
      const authUpdates: any = {};
      if (name) authUpdates.user_metadata = { name: name };
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdates);
        if (authError) throw authError;
      }

      return res.status(200).json({ success: true });
    }

    if (action === 'update_system_settings') {
      const { id, ...updates } = body;
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({ id: id || '00000000-0000-0000-0000-000000000001', ...updates })
        .select()
        .single();
      
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (action === 'update_package') {
      const { id, name, rate, features, sort_order } = body;
      let result;
      if (id && id.length > 5) {
        result = await supabase
          .from('subscription_packages')
          .update({ name, rate, features, sort_order })
          .eq('id', id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('subscription_packages')
          .insert([{ name, rate, features, sort_order }])
          .select()
          .single();
      }
      
      if (result.error) throw result.error;
      return res.status(200).json({ success: true, data: result.data });
    }

    if (action === 'delete_staff') {
      const { id } = body;
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'quick_recharge') {
      const { id, type, amount } = body;
      
      // Fetch current balance
      const { data: inst, error: fetchError } = await supabase
        .from('institutions')
        .select('balance, sms_balance')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      const currentBalance = type === 'voice' ? (inst.balance || 0) : (inst.sms_balance || 0);
      const newBalance = currentBalance + Number(amount);
      
      const updateData = type === 'voice' ? { balance: newBalance } : { sms_balance: newBalance };
      
      const { error: updateError } = await supabase
        .from('institutions')
        .update(updateData)
        .eq('id', id);
      
      if (updateError) throw updateError;

      // Log transaction
      await supabase.from('transactions').insert({
        institution_id: id,
        amount: type === 'voice' ? Number(amount) : 0,
        description: `Admin Quick ${type.toUpperCase()} Credit`,
        module: type,
        status: 'approved',
        payment_method: 'Admin Transfer'
      });

      return res.status(200).json({ success: true });
    }

    if (action === 'approve_transaction') {
      const { id, status, amount, institution_id, module, metadata } = body;
      
      // Update transaction status
      const updatePayload: any = { status };
      if (amount !== undefined) updatePayload.amount = amount;
      
      const { error: trError } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', id);
      
      if (trError) throw trError;

      if (status === 'approved') {
        if (module === 'voice' || module === 'payment') {
          const { data: instData, error: instError } = await supabase.from('institutions').select('balance').eq('id', institution_id).single();
          if (instError) throw instError;
          const newBalance = Number(instData.balance || 0) + Number(amount);
          const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', institution_id);
          if (balanceError) throw balanceError;
        } else if (module === 'sms') {
          const { data: instData, error: instError } = await supabase.from('institutions').select('sms_balance').eq('id', institution_id).single();
          if (instError) throw instError;
          const newBalance = Number(instData.sms_balance || 0) + Number(amount);
          const { error: balanceError } = await supabase.from('institutions').update({ sms_balance: newBalance }).eq('id', institution_id);
          if (balanceError) throw balanceError;

          // Update Admin SMS Stock
          const { data: stockData, error: stockFetchError } = await supabase
            .from('admin_sms_stock')
            .select('*')
            .limit(1)
            .single();
          if (!stockFetchError && stockData) {
            await supabase
              .from('admin_sms_stock')
              .update({ 
                remaining_sms: (stockData.remaining_sms || 0) - Number(amount),
                last_updated: new Date().toISOString()
              })
              .eq('id', stockData.id);
          }
        } else if (module === 'subscription') {
          const { data: instData, error: instFetchError } = await supabase
            .from('institutions')
            .select('config_json, subscription_end')
            .eq('id', institution_id)
            .single();
          
          if (!instFetchError && instData) {
            const config = (instData.config_json as any) || {};
            const currentPaidMonths = config.paid_months || [];
            const newMonths = metadata?.months || [];
            const updatedPaidMonths = Array.from(new Set([...currentPaidMonths, ...newMonths])).sort();
            
            const updatedConfig = {
              ...config,
              paid_months: updatedPaidMonths,
              package_name: metadata?.package_name || config.package_name,
              package_rate: metadata?.package_rate || config.package_rate,
              subscription_type: metadata?.subscription_type || config.subscription_type
            };

            let newSubEnd = instData.subscription_end;
            if (updatedPaidMonths.length > 0) {
              const lastMonthStr = updatedPaidMonths[updatedPaidMonths.length - 1];
              const [year, month] = lastMonthStr.split('-').map(Number);
              const lastDay = new Date(year, month, 0);
              newSubEnd = lastDay.toISOString();
            }

            const { error: instUpdateError } = await supabase
              .from('institutions')
              .update({ 
                config_json: updatedConfig,
                subscription_end: newSubEnd,
                status: 'active'
              })
              .eq('id', institution_id);
            if (instUpdateError) throw instUpdateError;
          }
        }
      }

      return res.status(200).json({ success: true });
    }

    if (action === 'payment_update') {
      const { id, amount, description, payment_method, metadata, updated_config } = body;
      
      // 1. Insert Transaction
      const { error: trError } = await supabase.from('transactions').insert({
        institution_id: id,
        amount: Number(amount),
        description: description || 'Payment received',
        status: 'approved',
        payment_method: payment_method || 'Admin Direct',
        module: 'subscription',
        metadata: metadata
      });
      if (trError) throw trError;

      // 2. Update Institution
      const { error: updateError } = await supabase
        .from('institutions')
        .update({ config_json: updated_config })
        .eq('id', id);
      
      if (updateError) throw updateError;

      return res.status(200).json({ success: true });
    }

    if (action === 'assign_voice') {
      const { institution_id, voice_id, voice_name, preview_url } = body;
      
      let insertInstId = institution_id;
      if (institution_id === 'system') {
        const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
        let sysId = sysInst && sysInst[0]?.id;
        if (!sysId) {
          const { data: newSys, error: sysError } = await supabase.from('institutions').insert({
            name: 'SYSTEM_GLOBAL_INTERNAL',
            address: 'System',
            phone: '00000000000',
            institution_type: 'system',
            is_active: true,
            is_super_admin: false,
            theme: 'default'
          }).select('id').single();
          if (sysError) throw sysError;
          sysId = newSys?.id;
        }
        insertInstId = sysId;
      }

      const { data, error } = await supabase.from('voice_templates').insert({
        institution_id: insertInstId,
        title: voice_name,
        file_url: preview_url || '',
        admin_status: 'approved',
        provider_status: 'approved',
        provider_voice_id: voice_id.toString(),
        provider_voice_name: voice_name
      }).select().single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (action === 'unassign_voice') {
      const { id } = body;
      const { error } = await supabase.from('voice_templates').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'delete_voice_assignments') {
      const { voice_id } = body;
      const { error } = await supabase.from('voice_templates').delete().eq('provider_voice_id', voice_id.toString());
      if (error) throw error;
      return res.status(200).json({ success: true });
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
