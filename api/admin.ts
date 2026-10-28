
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

let lastVoiceRefundAudit = 0;
const serverAdminCache = {
  globalStats: { data: null as any, timestamp: 0 },
  institutions: { data: null as any, timestamp: 0 },
  invalidate() {
    this.globalStats.data = null;
    this.globalStats.timestamp = 0;
    this.institutions.data = null;
    this.institutions.timestamp = 0;
  }
};
const SERVER_CACHE_TTL = 45 * 1000; // 45 seconds TTL to prevent statement timeout & connection pool exhaustion

async function autoFixVoiceRefunds(supabase: any) {
  try {
    const now = Date.now();
    // Throttle: Only run at most once per hour to avoid locking Postgres on every admin call
    if (now - lastVoiceRefundAudit < 60 * 60 * 1000) return;
    lastVoiceRefundAudit = now;

    const { data: broadcasts } = await supabase
      .from('voice_broadcasts')
      .select('id, institution_id, estimated_cost, refunded_amount')
      .gt('refunded_amount', 0);

    if (!broadcasts || broadcasts.length === 0) return;

    for (const item of broadcasts) {
      const estCost = Number(item.estimated_cost || 0);
      const refAmount = Number(item.refunded_amount || 0);
      if (refAmount > estCost) {
        const excessAmount = Number((refAmount - estCost).toFixed(2));
        if (excessAmount > 0) {
          const { data: inst } = await supabase
            .from('institutions')
            .select('balance')
            .eq('id', item.institution_id)
            .single();

          if (inst) {
            const currentBal = Number(inst.balance || 0);
            const newBal = Math.max(0, Number((currentBal - excessAmount).toFixed(2)));

            await supabase
              .from('institutions')
              .update({ balance: newBal })
              .eq('id', item.institution_id);

            await supabase.from('transactions').insert({
              institution_id: item.institution_id,
              amount: excessAmount,
              transaction_id: `CORRECT_VOICE_${item.id.slice(0, 8)}_${Date.now()}`,
              sender_phone: 'SYSTEM',
              description: `Voice refund auto-correction: Deducted ${excessAmount} ৳ excess refund`,
              type: 'debit',
              status: 'approved',
              module: 'voice'
            });

            await supabase
              .from('voice_broadcasts')
              .update({ refunded_amount: estCost, is_refunded: true })
              .eq('id', item.id);
          }
        }
      }
    }
  } catch (err) {
    console.error('Auto fix voice refunds error:', err);
  }
}

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
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    let user: any = null;
    let userId: string = '';
    let userEmail: string = '';

    // 1. Try standard Supabase auth.getUser(token)
    try {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        user = userData.user;
        userId = user.id;
        userEmail = user.email?.trim().toLowerCase() || '';
      }
    } catch (e) {
      console.warn('supabase.auth.getUser error:', e);
    }

    // 2. Fallback: Parse JWT payload directly if getUser fails
    if (!user) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload && (payload.sub || payload.email)) {
            userId = payload.sub || '';
            userEmail = (payload.email || payload.user_metadata?.email || '').trim().toLowerCase();
            user = {
              id: userId,
              email: userEmail,
              user_metadata: payload.user_metadata || {},
              app_metadata: payload.app_metadata || {}
            };
          }
        }
      } catch (jwtErr) {
        console.warn('JWT parse error:', jwtErr);
      }
    }

    if (!user || (!userId && !userEmail)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const superAdminEmails = [
      'kmibrahim@gmail.com',
      'thedevomix@gmail.com',
      'ibrahimkhan269596@gmail.com',
      'admin@deenora.com'
    ];
    const isSuperAdminEmail = superAdminEmails.includes(userEmail);

    let adminProfile: any = null;
    let userProfile: any = null;

    if (userId) {
      const [{ data: ap }, { data: up }] = await Promise.all([
        supabase.from('institutions').select('is_super_admin').eq('id', userId).maybeSingle(),
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
      ]);
      adminProfile = ap;
      userProfile = up;
    }

    if (!userProfile && userEmail) {
      const { data: upByEmail } = await supabase.from('profiles').select('role').eq('email', userEmail).maybeSingle();
      if (upByEmail) userProfile = upByEmail;
    }

    const roleStr = (userProfile?.role || user.user_metadata?.role || user.app_metadata?.role || '').toString().toLowerCase();
    const isSuperAdmin = isSuperAdminEmail || !!adminProfile?.is_super_admin || roleStr === 'super_admin';
    const isManager = roleStr === 'manager';

    if (!isSuperAdmin && !isManager) {
      return res.status(403).json({ error: 'Forbidden: Requires Super Admin or Manager role' });
    }

    // Invalidate cache if action is a mutation/write action
    if (action && typeof action === 'string' && !action.startsWith('get_') && !action.startsWith('audit_') && !action.startsWith('check_')) {
      serverAdminCache.invalidate();
    }

    // Auto-fix any voice balance overflow issues transparently in background
    await autoFixVoiceRefunds(supabase);

    if (action === 'get_global_stats') {
      const now = Date.now();
      if (serverAdminCache.globalStats.data && (now - serverAdminCache.globalStats.timestamp < SERVER_CACHE_TTL)) {
        return res.status(200).json(serverAdminCache.globalStats.data);
      }

      const [studentsRes, classesRes, teachersRes, transactionsRes, instsRes, stockRes, pendingRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('sms_count, amount, module, description, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(2500),
        supabase.from('institutions').select('sms_balance, balance, is_active, institution_type, config_json').eq('is_super_admin', false).neq('name', 'SYSTEM_GLOBAL_INTERNAL'),
        supabase.from('admin_sms_stock').select('remaining_sms').single(),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending').not('transaction_id', 'like', 'PENDING_%')
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
      const voiceRev = Math.round((spentVoiceTk / 0.45) * 0.15);
      
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

      const globalStatsResult = {
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
        pendingApprovals: pendingRes?.count || 0,
        totalInstitutions: instsRes.data?.length || 0,
        activeInstitutions: activeInsts,
        totalVoiceBalance,
        adminSMSStock: adminStock,
        typeBreakdown
      };

      serverAdminCache.globalStats.data = globalStatsResult;
      serverAdminCache.globalStats.timestamp = now;

      return res.status(200).json(globalStatsResult);
    }

    if (action === 'audit_voice_balances') {
      const { data: broadcasts, error: fetchErr } = await supabase
        .from('voice_broadcasts')
        .select('*');

      if (fetchErr) throw fetchErr;

      const itemsToFix = (broadcasts || []).filter(b => Number(b.refunded_amount || 0) > Number(b.estimated_cost || 0));

      let totalExcessDeducted = 0;
      const results = [];

      for (const item of itemsToFix) {
        const estCost = Number(item.estimated_cost || 0);
        const refAmount = Number(item.refunded_amount || 0);
        const excessAmount = Number((refAmount - estCost).toFixed(2));

        if (excessAmount > 0) {
          const { data: inst } = await supabase
            .from('institutions')
            .select('balance, name')
            .eq('id', item.institution_id)
            .single();

          if (inst) {
            const currentBal = Number(inst.balance || 0);
            const newBal = Math.max(0, Number((currentBal - excessAmount).toFixed(2)));

            await supabase
              .from('institutions')
              .update({ balance: newBal })
              .eq('id', item.institution_id);

            await supabase.from('transactions').insert({
              institution_id: item.institution_id,
              amount: excessAmount,
              transaction_id: `CORRECT_VOICE_${item.id.slice(0, 8)}_${Date.now()}`,
              sender_phone: 'SYSTEM',
              description: `Voice refund audit correction: Deducted ${excessAmount} ৳ excess refund`,
              type: 'debit',
              status: 'approved',
              module: 'voice'
            });

            await supabase
              .from('voice_broadcasts')
              .update({ refunded_amount: estCost, is_refunded: true })
              .eq('id', item.id);

            totalExcessDeducted += excessAmount;
            results.push({
              institution_name: inst.name,
              broadcast_id: item.id,
              excess_refund: excessAmount,
              previous_balance: currentBal,
              new_balance: newBal
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        fixed_count: results.length,
        total_excess_deducted: Number(totalExcessDeducted.toFixed(2)),
        details: results
      });
    }

    if (action === 'get_detailed_report') {
      const { filterMode, month, year, startDate: customStart, endDate: customEnd } = body;
      let startDate: Date;
      let endDate: Date;
      
      if (filterMode === 'monthly') {
        const [y, m] = month.split('-');
        startDate = new Date(Number(y), Number(m) - 1, 1);
        endDate = new Date(Number(y), Number(m), 0, 23, 59, 59);
      } else if (filterMode === 'custom' && customStart && customEnd) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(Number(year), 0, 1);
        endDate = new Date(Number(year), 11, 31, 23, 59, 59);
      }

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();
      const monthStr = filterMode === 'monthly' ? month : null; // e.g. "2024-08"

      // 1. Fetch SMS/Voice recharges and usage logs based on creation date
      const [txRes, smsLogsRes, voiceBroadcastsRes] = await Promise.all([
        supabase.from('transactions')
          .select('id, amount, description, module, metadata, created_at, transaction_id, status, institution_id, institutions(name)')
          .eq('status', 'approved')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase.from('sms_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase.from('voice_broadcasts')
          .select('total_numbers')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .limit(10000)
      ]);

      // 2. Fetch Subscription payments specifically if they target this month (even if paid earlier/later)
      let subRechargeTotal = 0;
      if (monthStr) {
        // Fetch all approved subscription transactions
        // We fetch ALL to catch multi-month payments made in the past that cover this month
        const { data: allSubTx } = await supabase.from('transactions')
          .select('amount, metadata, created_at, module, description')
          .eq('status', 'approved')
          .eq('module', 'subscription');

        (allSubTx || []).forEach(t => {
          const months = t.metadata?.months;
          if (Array.isArray(months) && months.length > 0) {
            if (months.includes(monthStr)) {
              // Pro-rata: Divide total amount by number of months it covers
              subRechargeTotal += (Number(t.amount) || 0) / months.length;
            }
          } else {
            // Fallback for legacy: use created_at if monthStr matches transaction's month
            const tDate = new Date(t.created_at);
            const tMonthStr = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
            if (tMonthStr === monthStr) {
              subRechargeTotal += (Number(t.amount) || 0);
            }
          }
        });
      } else {
        // Yearly mode: just sum subscriptions created in that year
        const { data: yearlySubTx } = await supabase.from('transactions')
          .select('amount')
          .eq('status', 'approved')
          .eq('module', 'subscription')
          .gte('created_at', startISO)
          .lte('created_at', endISO);
        subRechargeTotal = (yearlySubTx || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      }

      const transactions = txRes.data || [];
      
      const smsTransactions = transactions.filter(t => {
        // SMS transactions are those explicitly marked as sms, OR recharges without a module that aren't subscriptions/voice
        const isSmsModule = t.module === 'sms';
        const isLegacySms = !t.module && !(t.description || '').toLowerCase().includes('voice') && !(t.description || '').toLowerCase().includes('subscription');
        return isSmsModule || isLegacySms;
      });
      const smsRechargeTotal = smsTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

      const voiceTransactions = transactions.filter(t => {
        const isVoiceModule = t.module === 'voice';
        const isLegacyVoice = !t.module && (t.description || '').toLowerCase().includes('voice');
        return isVoiceModule || isLegacyVoice;
      });
      const voiceRechargeTotal = voiceTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

      const smsSentNum = smsLogsRes.count || 0;
      const voiceCallsNum = (voiceBroadcastsRes.data || []).reduce((sum, t) => sum + (Number(t.total_numbers) || 0), 0) || 0;

      return res.status(200).json({
        smsRechargeTotal,
        voiceRechargeTotal,
        subRechargeTotal,
        smsSentNum,
        voiceCallsNum,
        transactions
      });
    }

    if (action === 'get_all_institutions') {
      const now = Date.now();
      if (serverAdminCache.institutions.data && (now - serverAdminCache.institutions.timestamp < SERVER_CACHE_TTL)) {
        return res.status(200).json({ institutions: serverAdminCache.institutions.data });
      }

      const { data, error } = await supabase.from('institutions')
        .select('*, student_count:students(count), class_count:classes(count), teacher_count:teachers(count)')
        .eq('is_super_admin', false)
        .neq('name', 'SYSTEM_GLOBAL_INTERNAL')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const directCounts: Record<string, { students: number; classes: number; teachers: number; sms_balance: number; balance: number }> = {};
      const parentMap: Record<string, string> = {};

      (data || []).forEach(inst => {
        const sCount = inst.student_count?.[0]?.count || 0;
        const cCount = inst.class_count?.[0]?.count || 0;
        const tCount = inst.teacher_count?.[0]?.count || 0;
        const smsBal = Number(inst.sms_balance || 0);
        const voiceBal = Number(inst.balance || 0);

        directCounts[inst.id] = { students: sCount, classes: cCount, teachers: tCount, sms_balance: smsBal, balance: voiceBal };

        const config = typeof inst.config_json === 'string' ? (() => { try { return JSON.parse(inst.config_json); } catch(e) { return {}; } })() : (inst.config_json || {});
        if (config?.parent_institution_id) {
          parentMap[inst.id] = config.parent_institution_id;
        }
      });

      // Aggregate child counts and balances into parent main institution
      const aggregateCounts: Record<string, { students: number; classes: number; teachers: number; sms_balance: number; balance: number }> = {};
      Object.keys(directCounts).forEach(id => {
        aggregateCounts[id] = { ...directCounts[id] };
      });

      Object.entries(parentMap).forEach(([childId, parentId]) => {
        if (aggregateCounts[parentId] && directCounts[childId]) {
          aggregateCounts[parentId].students += directCounts[childId].students;
          aggregateCounts[parentId].classes += directCounts[childId].classes;
          aggregateCounts[parentId].teachers += directCounts[childId].teachers;
          aggregateCounts[parentId].sms_balance += directCounts[childId].sms_balance;
          aggregateCounts[parentId].balance = Number((aggregateCounts[parentId].balance + directCounts[childId].balance).toFixed(2));
        }
      });

      // Flatten counts and balances for Super Admin panel frontend
      const flattened = (data || []).map(inst => {
        const isBranch = !!parentMap[inst.id];
        const counts = isBranch ? (directCounts[inst.id] || { students: 0, classes: 0, teachers: 0, sms_balance: 0, balance: 0 }) : (aggregateCounts[inst.id] || { students: 0, classes: 0, teachers: 0, sms_balance: 0, balance: 0 });

        return {
          ...inst,
          sms_balance: counts.sms_balance,
          balance: counts.balance,
          student_count: counts.students,
          class_count: counts.classes,
          teacher_count: counts.teachers,
          direct_student_count: directCounts[inst.id]?.students || 0,
          direct_teacher_count: directCounts[inst.id]?.teachers || 0,
          direct_sms_balance: directCounts[inst.id]?.sms_balance || 0,
          direct_voice_balance: directCounts[inst.id]?.balance || 0
        };
      });

      serverAdminCache.institutions.data = flattened;
      serverAdminCache.institutions.timestamp = now;

      return res.status(200).json({ institutions: flattened });
    }

    if (action === 'get_recent_institutions') {
      const limit = Number(body.limit) || 5;
      const { data, error } = await supabase.from('institutions')
        .select('*, student_count:students(count), teacher_count:teachers(count)')
        .eq('is_super_admin', false)
        .neq('name', 'SYSTEM_GLOBAL_INTERNAL')
        .order('created_at', { ascending: false })
        .limit(limit * 3);
      
      if (error) throw error;
      
      const directCounts: Record<string, { students: number; teachers: number; sms_balance: number; balance: number }> = {};
      const parentMap: Record<string, string> = {};

      (data || []).forEach(inst => {
        directCounts[inst.id] = {
          students: inst.student_count?.[0]?.count || 0,
          teachers: inst.teacher_count?.[0]?.count || 0,
          sms_balance: Number(inst.sms_balance || 0),
          balance: Number(inst.balance || 0)
        };
        const config = typeof inst.config_json === 'string' ? (() => { try { return JSON.parse(inst.config_json); } catch(e) { return {}; } })() : (inst.config_json || {});
        if (config?.parent_institution_id) {
          parentMap[inst.id] = config.parent_institution_id;
        }
      });

      const aggregateCounts: Record<string, { students: number; teachers: number; sms_balance: number; balance: number }> = {};
      Object.keys(directCounts).forEach(id => {
        aggregateCounts[id] = { ...directCounts[id] };
      });

      Object.entries(parentMap).forEach(([childId, parentId]) => {
        if (aggregateCounts[parentId] && directCounts[childId]) {
          aggregateCounts[parentId].students += directCounts[childId].students;
          aggregateCounts[parentId].teachers += directCounts[childId].teachers;
          aggregateCounts[parentId].sms_balance += directCounts[childId].sms_balance;
          aggregateCounts[parentId].balance = Number((aggregateCounts[parentId].balance + directCounts[childId].balance).toFixed(2));
        }
      });

      const flattened = (data || []).slice(0, limit).map(inst => {
        const isBranch = !!parentMap[inst.id];
        const counts = isBranch ? (directCounts[inst.id] || { students: 0, teachers: 0, sms_balance: 0, balance: 0 }) : (aggregateCounts[inst.id] || { students: 0, teachers: 0, sms_balance: 0, balance: 0 });

        return {
          ...inst,
          sms_balance: counts.sms_balance,
          balance: counts.balance,
          student_count: counts.students,
          teacher_count: counts.teachers
        };
      });
      
      return res.status(200).json({ institutions: flattened });
    }

    if (action === 'get_pending_transactions') {
      const { data, error } = await supabase.from('transactions')
        .select('*, institutions(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return res.status(200).json({ transactions: data || [] });
    }

    if (action === 'get_transaction_history') {
      const { modules, days = 30 } = body;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));
      startDate.setHours(0, 0, 0, 0);

      let query = supabase.from('transactions')
        .select('*, institutions(*)')
        .neq('status', 'pending')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10000);

      if (modules && Array.isArray(modules) && modules.length > 0) {
        query = query.in('module', modules);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ transactions: data || [] });
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
      const { id, action: _action, ...updateFields } = body;
      if (!id) return res.status(400).json({ error: 'Institution ID is required' });

      if (updateFields.reve_non_masking_id !== undefined && !updateFields.reve_caller_id) {
        updateFields.reve_caller_id = updateFields.reve_non_masking_id;
      }

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
      const { id, action: _ignoreAction, ...updates } = body;
      if (updates.reve_non_masking_id !== undefined && !updates.reve_caller_id) {
        updates.reve_caller_id = updates.reve_non_masking_id;
      }
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
      
      // Fetch current balance and rates
      const { data: inst, error: fetchError } = await supabase
        .from('institutions')
        .select('balance, sms_balance, sms_rate, voice_rate, reve_client_id, sms_type')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      let creditAmount = Number(amount);
      
      if (type === 'sms') {
        // Calculate SMS count based on rate
        const { data: settings } = await supabase.from('system_settings').select('sms_rate, sms_provider_config').eq('id', '00000000-0000-0000-0000-000000000001').single();
        const providerConfig = (settings?.sms_provider_config as any) || {};
        const defaultType = providerConfig.default_type || 'non_masking';
        
        const isMaskingAccount = !!inst.reve_client_id;
        const instSmsType = isMaskingAccount ? 'masking' : (inst.sms_type || defaultType);
        
        let smsRate = 0;
        if (instSmsType === 'masking' && providerConfig.masking_rate) {
          smsRate = Number(providerConfig.masking_rate);
        } else if (instSmsType === 'non_masking' && providerConfig.non_masking_rate) {
          smsRate = Number(providerConfig.non_masking_rate);
        }

        if (!smsRate || smsRate <= 0) {
          smsRate = Number(inst.sms_rate);
          if (!smsRate || smsRate <= 0) {
            smsRate = Number(settings?.sms_rate || 0.55);
          }
        }
        creditAmount = Math.ceil(Number(amount) / smsRate);
      }

      const currentBalance = type === 'voice' ? (inst.balance || 0) : (inst.sms_balance || 0);
      const newBalance = currentBalance + creditAmount;
      
      const updateData = type === 'voice' ? { balance: newBalance } : { sms_balance: newBalance };
      
      const { error: updateError } = await supabase
        .from('institutions')
        .update(updateData)
        .eq('id', id);
      
      if (updateError) throw updateError;

      // Log transaction with running balance metadata
      await supabase.from('transactions').insert({
        transaction_id: `ADMIN_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        institution_id: id,
        amount: Number(amount),
        sms_count: type === 'sms' ? creditAmount : null,
        sender_phone: 'Admin',
        description: `Admin Quick ${type.toUpperCase()} Credit`,
        module: type,
        status: 'approved',
        metadata: {
          payment_method: 'Admin Transfer',
          balance_before: currentBalance,
          balance_after: newBalance,
          credit_amount: creditAmount
        }
      });

      return res.status(200).json({ success: true, balance_before: currentBalance, balance_after: newBalance });
    }

    if (action === 'approve_transaction') {
      const { id, status, amount, institution_id, module, metadata, sms_count } = body;
      
      // Update transaction status
      const updatePayload: any = { status };
      if (amount !== undefined) updatePayload.amount = amount;
      if (sms_count !== undefined) updatePayload.sms_count = sms_count;
      
      // If module/inst_id is missing, fetch them
      let targetModule = module;
      let targetInstId = institution_id;
      let targetAmount = amount;
      let targetSmsCount = sms_count;

      if (!targetModule || !targetInstId || targetAmount === undefined) {
        const { data: tr } = await supabase.from('transactions').select('*').eq('id', id).single();
        if (tr) {
          targetModule = targetModule || tr.module;
          targetInstId = targetInstId || tr.institution_id;
          targetAmount = targetAmount === undefined ? tr.amount : targetAmount;
          targetSmsCount = targetSmsCount === undefined ? tr.sms_count : targetSmsCount;
        }
      }

      const { error: trError } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', id);
      
      if (trError) throw trError;

      if (status === 'approved') {
        if (targetModule === 'voice' || targetModule === 'payment') {
          const { data: instData, error: instError } = await supabase.from('institutions').select('balance').eq('id', targetInstId).single();
          if (instError) throw instError;
          const currentBal = Number(instData.balance || 0);
          const newBalance = currentBal + Number(targetAmount);
          const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', targetInstId);
          if (balanceError) throw balanceError;

          // Record balance_before & balance_after in transaction metadata
          await supabase.from('transactions').update({
            metadata: {
              ...(metadata || {}),
              balance_before: currentBal,
              balance_after: newBalance
            }
          }).eq('id', id);
        } else if (targetModule === 'sms') {
          const { data: instData, error: instError } = await supabase.from('institutions').select('sms_balance, sms_rate, sms_type, reve_client_id').eq('id', targetInstId).single();
          if (instError) throw instError;
          
          // Calculate SMS count if missing
          let creditAmount = Number(targetSmsCount);
          if (isNaN(creditAmount) || creditAmount <= 0) {
            const { data: settings } = await supabase.from('system_settings').select('sms_rate, sms_provider_config').eq('id', '00000000-0000-0000-0000-000000000001').single();
            const providerConfig = (settings?.sms_provider_config as any) || {};
            const defaultType = providerConfig.default_type || 'non_masking';
            
            const isMaskingAccount = !!instData.reve_client_id;
            const instSmsType = isMaskingAccount ? 'masking' : (instData.sms_type || defaultType);
            
            let smsRate = 0;
            if (instSmsType === 'masking' && providerConfig.masking_rate) {
              smsRate = Number(providerConfig.masking_rate);
            } else if (instSmsType === 'non_masking' && providerConfig.non_masking_rate) {
              smsRate = Number(providerConfig.non_masking_rate);
            }

            if (!smsRate || smsRate <= 0) {
              smsRate = Number(instData.sms_rate);
              if (!smsRate || smsRate <= 0) {
                smsRate = Number(settings?.sms_rate || 0.55);
              }
            }
            creditAmount = Math.ceil(Number(targetAmount || 0) / smsRate);
          }

          const currentSmsBal = Number(instData.sms_balance || 0);
          const newBalance = currentSmsBal + creditAmount;
          
          const { error: balanceError } = await supabase.from('institutions').update({ sms_balance: newBalance }).eq('id', targetInstId);
          if (balanceError) throw balanceError;

          // Record balance_before & balance_after in transaction metadata
          await supabase.from('transactions').update({
            metadata: {
              ...(metadata || {}),
              sms_balance_before: currentSmsBal,
              sms_balance_after: newBalance
            }
          }).eq('id', id);

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
                remaining_sms: (stockData.remaining_sms || 0) - creditAmount,
                last_updated: new Date().toISOString()
              })
              .eq('id', stockData.id);
          }
        } else if (targetModule === 'subscription') {
          const { data: instData, error: instFetchError } = await supabase
            .from('institutions')
            .select('config_json, subscription_end')
            .eq('id', targetInstId)
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

    if (action === 'get_payment_history') {
      const { institution_id, module: filterModule } = body;
      if (!institution_id) return res.status(400).json({ error: 'Institution ID is required' });

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('institution_id', institution_id)
        .order('created_at', { ascending: false });

      if (filterModule && filterModule !== 'all') {
        query = query.eq('module', filterModule);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching payment history:', error);
        throw error;
      }
      return res.status(200).json({ history: data || [] });
    }

    if (action === 'get_historical_balance') {
      const { institution_id, target_date } = body;
      if (!institution_id) return res.status(400).json({ error: 'Institution ID is required' });

      const { data: inst, error: instErr } = await supabase
        .from('institutions')
        .select('id, name, balance, sms_balance')
        .eq('id', institution_id)
        .single();

      if (instErr || !inst) return res.status(404).json({ error: 'Institution not found' });

      let targetIso = new Date().toISOString();
      if (target_date) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
          // If pure YYYY-MM-DD date provided, default to end of that day (23:59:59.999)
          const [y, m, d] = target_date.split('-').map(Number);
          targetIso = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        } else {
          targetIso = new Date(target_date).toISOString();
        }
      }

      // Fetch all approved transactions that occurred strictly after targetIso
      const { data: laterTxs, error: txErr } = await supabase
        .from('transactions')
        .select('amount, type, status, module, sms_count, created_at, description, transaction_id')
        .eq('institution_id', institution_id)
        .eq('status', 'approved')
        .gt('created_at', targetIso);

      if (txErr) throw txErr;

      let voiceDelta = 0;
      let smsDelta = 0;

      for (const t of laterTxs || []) {
        const amt = Number(t.amount || 0);
        const smsC = Number(t.sms_count || 0);

        if (t.module === 'voice' || t.module === 'payment' || (!t.module && amt > 0)) {
          if (t.type === 'credit') voiceDelta += amt;
          else if (t.type === 'debit') voiceDelta -= amt;
        }

        if (t.module === 'sms') {
          if (t.type === 'credit') smsDelta += smsC;
          else if (t.type === 'debit') smsDelta -= smsC;
        }
      }

      const historicalVoice = Math.max(0, Math.round((Number(inst.balance || 0) - voiceDelta) * 100) / 100);
      const historicalSms = Math.max(0, Math.round((Number(inst.sms_balance || 0) - smsDelta)));

      return res.status(200).json({
        success: true,
        institution_id,
        institution_name: inst.name,
        target_date: targetIso,
        current_voice_balance: Number(inst.balance || 0),
        current_sms_balance: Number(inst.sms_balance || 0),
        historical_voice_balance: historicalVoice,
        historical_sms_balance: historicalSms,
        transactions_since_target: (laterTxs || []).length,
      });
    }

    if (action === 'delete_payment_history') {
      const { transaction_id } = body;
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction_id);
        
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'approve_voice') {
      const targetId = body.id || body.voice_id;
      if (!targetId) return res.status(400).json({ error: 'Voice ID is required' });

      const { data, error } = await supabase
        .from('voice_templates')
        .update({
          admin_status: 'approved',
          provider_status: 'approved',
          status: 'approved'
        })
        .eq('id', targetId)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (action === 'reject_voice') {
      const targetId = body.id || body.voice_id;
      if (!targetId) return res.status(400).json({ error: 'Voice ID is required' });

      const { data, error } = await supabase
        .from('voice_templates')
        .update({
          admin_status: 'rejected',
          provider_status: 'rejected',
          status: 'rejected'
        })
        .eq('id', targetId)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (action === 'update_voice_title') {
      const targetId = body.id || body.voice_id;
      const title = body.title ? body.title.toString().trim() : '';
      if (!targetId || !title) return res.status(400).json({ error: 'Voice ID and title are required' });

      const { data, error } = await supabase
        .from('voice_templates')
        .update({
          title: title
        })
        .eq('id', targetId)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (action === 'get_pending_voices') {
      const [voicesRes, instsRes] = await Promise.all([
        supabase
          .from('voice_templates')
          .select('*')
          .or('admin_status.eq.pending,provider_status.eq.pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('institutions')
          .select('id, name, phone')
      ]);

      if (voicesRes.error) throw voicesRes.error;
      const rawVoices = voicesRes.data || [];

      // Check if any voice is missing a playable file_url
      const missingVoices = rawVoices.filter((v: any) => !v.file_url || !v.file_url.startsWith('http'));
      if (missingVoices.length > 0 && process.env.AWAJ_API_TOKEN) {
        try {
          const awajRes = await fetch('https://api.awajdigital.com/api/voices', {
            headers: {
              'Authorization': `Bearer ${process.env.AWAJ_API_TOKEN.trim()}`,
              'Accept': 'application/json'
            }
          });
          if (awajRes.ok) {
            const awajData = await awajRes.json();
            const voiceList = Array.isArray(awajData) ? awajData : (awajData.voices || awajData.data || []);
            for (const v of rawVoices) {
              if (!v.file_url || !v.file_url.startsWith('http')) {
                const match = voiceList.find((av: any) => 
                  (v.provider_voice_id && String(av.id) === String(v.provider_voice_id)) ||
                  (v.provider_voice_name && av.name && av.name.toLowerCase() === v.provider_voice_name.toLowerCase()) ||
                  (v.title && av.name && (av.name.toLowerCase().includes(v.title.toLowerCase()) || v.title.toLowerCase().includes(av.name.toLowerCase())))
                );
                if (match) {
                  let foundUrl = match.previewUrl || match.file_url || match.preview_url || match.url || '';
                  if (foundUrl && !foundUrl.startsWith('http') && !foundUrl.startsWith('data:')) {
                    const cleanPath = foundUrl.startsWith('/') ? foundUrl : `/${foundUrl}`;
                    foundUrl = `https://api.awajdigital.com${cleanPath}`;
                  }
                  if (foundUrl) {
                    v.file_url = foundUrl;
                    // Persist to database so it stays permanently available
                    supabase.from('voice_templates').update({ file_url: foundUrl }).eq('id', v.id).then();
                  }
                } else if (v.file_url && (v.file_url.startsWith('/') || v.file_url.startsWith('voices/') || v.file_url.startsWith('uploads/'))) {
                  const cleanPath = v.file_url.startsWith('/') ? v.file_url : `/${v.file_url}`;
                  v.file_url = `https://api.awajdigital.com${cleanPath}`;
                }
              }
            }
          }
        } catch (awajErr) {
          console.warn('Could not auto-enrich pending voices from Awaj:', awajErr);
        }
      }

      return res.status(200).json({
        success: true,
        voices: rawVoices,
        institutions: instsRes.data || []
      });
    }

    if (action === 'payment_update') {
      const { id, amount, description, payment_method, metadata, updated_config } = body;
      
      // 1. Insert Transaction
      const { error: trError } = await supabase.from('transactions').insert({
        transaction_id: `ADMIN_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        institution_id: id,
        amount: Number(amount),
        sender_phone: 'Admin',
        description: description || 'Payment received',
        status: 'approved',
        module: 'subscription',
        metadata: {
          ...(typeof metadata === 'object' ? metadata : {}),
          payment_method: payment_method || 'Admin Direct'
        }
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

    if (action === 'get_user_stats') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'User ID is required' });

      try {
        const [stdRes, clsRes] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', id),
          supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', id)
        ]);

        return res.status(200).json({
          students: stdRes.count || 0,
          classes: clsRes.count || 0
        });
      } catch (statsErr: any) {
        console.error('Error fetching stats for user:', id, statsErr);
        return res.status(200).json({ students: 0, classes: 0 });
      }
    }

    if (action === 'assign_voice') {
      const { institution_id, voice_id, voice_name, preview_url, file_url, provider_status } = body;
      
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

      let finalFileUrl = (file_url || preview_url || '').trim();

      // Fallback: If URL was missing, fetch latest URL from Awaj Digital API directly
      if (!finalFileUrl && voice_id) {
        try {
          const token = (process.env.AWAJ_API_TOKEN || '').trim();
          if (token) {
            const awajRes = await fetch('https://api.awajdigital.com/api/voices', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            if (awajRes.ok) {
              const awajData = await awajRes.json();
              const voiceList = Array.isArray(awajData) ? awajData : (awajData.voices || awajData.data || []);
              const matched = voiceList.find((v: any) => v.id?.toString() === voice_id.toString() || v.name?.toLowerCase() === (voice_name || '').toLowerCase());
              if (matched) {
                finalFileUrl = (matched.previewUrl || matched.preview_url || matched.file_url || matched.url || '').trim();
              }
            }
          }
        } catch (e: any) {
          console.warn('Fallback voice lookup in assign_voice failed:', e.message);
        }
      }

      const { data, error } = await supabase.from('voice_templates').insert({
        institution_id: insertInstId,
        title: voice_name,
        file_url: finalFileUrl,
        admin_status: 'approved',
        provider_status: provider_status || 'approved',
        provider_voice_id: voice_id ? voice_id.toString() : null,
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
      if (voice_id) {
        const vIdStr = voice_id.toString();
        const { error } = await supabase
          .from('voice_templates')
          .delete()
          .or(`provider_voice_id.eq.${vIdStr},id.eq.${vIdStr}`);
        if (error) console.warn('Supabase delete voice_templates error:', error);
      }
      return res.status(200).json({ success: true });
    }


    if (action === 'get_staff') {
      const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').maybeSingle();
      const sysId = sysInst?.id;

      let profilesQuery = supabase.from('profiles').select('*').in('role', ['manager', 'super_admin']);
      if (sysId) {
        profilesQuery = profilesQuery.or(`institution_id.eq.${sysId},role.eq.manager,role.eq.super_admin`);
      }
      const { data: profileList, error: pError } = await profilesQuery;
      if (pError) throw pError;

      // Enrich with emails from Supabase Auth admin
      let userMap = new Map<string, string>();
      try {
        const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (authUsers?.users) {
          authUsers.users.forEach(u => {
            if (u.id && u.email) userMap.set(u.id, u.email);
          });
        }
      } catch (authListErr) {
        console.warn('Could not list auth users in get_staff:', authListErr);
      }

      const enrichedStaff = (profileList || []).map(p => ({
        ...p,
        email: userMap.get(p.id) || p.email || ''
      }));

      return res.status(200).json({ success: true, staff: enrichedStaff });
    }

    if (action === 'create_staff') {
      const { name, email, password, role, permissions } = body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'সকল ঘর পূরণ করুন (Missing required fields)' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      if (trimmedPassword.length < 6) {
        return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)' });
      }

      let userId: string = '';

      // 1. Create auth user or update password if email already registered
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: trimmedEmail,
        password: trimmedPassword,
        email_confirm: true,
        user_metadata: { name: name.trim() }
      });

      if (authError) {
        const errMsg = authError.message?.toLowerCase() || '';
        const isAlreadyRegistered = errMsg.includes('already') || 
                                    errMsg.includes('exists') || 
                                    errMsg.includes('registered') ||
                                    (authError as any).status === 422;

        if (isAlreadyRegistered) {
          // Find existing user by email
          const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const existingUser = userList?.users?.find(u => u.email?.trim().toLowerCase() === trimmedEmail);
          
          if (existingUser) {
            userId = existingUser.id;
            const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
              password: trimmedPassword,
              email_confirm: true,
              user_metadata: { name: name.trim() }
            });
            if (updateErr) throw updateErr;
          } else {
            throw authError;
          }
        } else {
          throw authError;
        }
      } else {
        userId = authData.user.id;
      }

      // Ensure user email is confirmed
      try {
        await supabase.auth.admin.updateUserById(userId, {
          email_confirm: true
        });
      } catch (e) {
        console.warn('Could not confirm email for new staff:', e);
      }

      // 2. Find system institution ID
      const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').maybeSingle();
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

      // 3. Create or update profile with assigned permissions
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        institution_id: sysId,
        full_name: name.trim(),
        role: role, // 'manager' or 'super_admin'
        permissions: permissions || {},
        is_active: true
      });

      if (profileError) throw profileError;

      return res.status(200).json({ success: true, user_id: userId, email: trimmedEmail });
    }

    if (action === 'update_staff') {
      const { id, name, role, permissions, is_active, password } = body;

      if (!id) {
        return res.status(400).json({ error: 'Staff ID is required' });
      }

      // 1. If password is provided, update password in Auth
      if (password && typeof password === 'string' && password.trim().length > 0) {
        const trimmedPassword = password.trim();
        if (trimmedPassword.length < 6) {
          return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)' });
        }

        const { error: passError } = await supabase.auth.admin.updateUserById(id, {
          password: trimmedPassword,
          email_confirm: true
        });

        if (passError) {
          console.error('Error updating staff password in Auth:', passError);
          throw new Error(`পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে: ${passError.message}`);
        }
      }

      // 2. Update user_metadata in Auth if name provided
      if (name && typeof name === 'string' && name.trim()) {
        try {
          await supabase.auth.admin.updateUserById(id, {
            user_metadata: { name: name.trim() }
          });
        } catch (e) {
          console.warn('Could not update Auth user_metadata:', e);
        }
      }

      // 3. Update profile record
      const updateData: any = {};
      if (name !== undefined) updateData.full_name = name.trim();
      if (role !== undefined) updateData.role = role;
      if (permissions !== undefined) updateData.permissions = permissions;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id);

      if (profileError) throw profileError;

      return res.status(200).json({ success: true, message: 'ম্যানেজার তথ্য ও পাসওয়ার্ড সফলভাবে আপডেট হয়েছে।' });
    }

    if (action === 'delete_staff') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Staff ID is required' });

      // Delete from Auth
      try {
        await supabase.auth.admin.deleteUser(id);
      } catch (authDelErr) {
        console.warn('Could not delete user from Auth:', authDelErr);
      }

      // Delete from profiles
      const { error: profDelErr } = await supabase.from('profiles').delete().eq('id', id);
      if (profDelErr) throw profDelErr;

      return res.status(200).json({ success: true, message: 'স্টাফ মেম্বার সফলভাবে ডিলিট করা হয়েছে।' });
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
        backup_restore: false,
        question_bank: false
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
