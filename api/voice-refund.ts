import { getSupabaseAdmin } from '../lib/supabase-admin.js';
// fetch is now global in Node 18+

const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';

const getAwajHeaders = () => {
  const token = process.env.AWAJ_API_TOKEN;
  if (!token) {
    throw new Error('AWAJ_API_TOKEN is not set.');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { broadcast_id } = req.body;
    if (!broadcast_id) {
      return res.status(400).json({ error: 'Broadcast ID is required' });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.institution_id) {
      console.error('Profile/Institution fetch error:', profileErr);
      return res.status(401).json({ error: 'Unauthorized: Could not determine institution' });
    }

    const institutionId = profile.institution_id;

    // 1. Fetch broadcast details
    const { data: broadcast, error: broadcastErr } = await supabase
      .from('voice_broadcasts')
      .select('*')
      .eq('id', broadcast_id)
      .eq('institution_id', institutionId)
      .single();

    if (broadcastErr || !broadcast) {
      console.error('Broadcast fetch error:', broadcastErr);
      return res.status(404).json({ error: 'Broadcast not found or access denied' });
    }

    // Fetch institution details separately for better reliability
    const { data: institution, error: instErr } = await supabase
      .from('institutions')
      .select('balance, voice_rate')
      .eq('id', institutionId)
      .single();
    
    if (instErr || !institution) {
      console.error('Institution fetch error:', instErr);
      return res.status(404).json({ error: 'Institution not found' });
    }

    if (!broadcast.provider_campaign_id) {
      return res.status(400).json({ error: 'No provider campaign ID found for this broadcast' });
    }

    // 2. Check if already refunded
    const refundTxId = `REFUND_${broadcast.id}`;
    const { data: existingRefund } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_id', refundTxId)
      .maybeSingle();

    if (existingRefund) {
      return res.status(200).json({ success: true, already_refunded: true, message: 'Refund already processed for this broadcast' });
    }

    // 3. Fetch logs from Awaj API
    const headers = getAwajHeaders();
    let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${broadcast.provider_campaign_id}/result`, { headers: headers as any });
    if (response.status === 404) {
      response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${broadcast.provider_campaign_id}`, { headers: headers as any });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Awaj API Error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch from Awaj API: ${response.statusText}`);
    }

    const resultData = await response.json() as any;
    console.log(`Awaj API Response for ${broadcast.provider_campaign_id}:`, JSON.stringify(resultData));
    
    // Extract call logs array
    const logs = Array.isArray(resultData) ? resultData : 
      (resultData.data && Array.isArray(resultData.data) ? resultData.data : 
      (resultData.broadcast?.logs ? resultData.broadcast.logs : 
      (resultData.broadcast?.calls ? resultData.broadcast.calls : 
      (resultData.calls ? resultData.calls : 
      (resultData.results ? resultData.results : [])))));

    if (!logs || logs.length === 0) {
      console.log('No logs found for broadcast resultData:', JSON.stringify(resultData));
      return res.status(400).json({ error: 'No call logs found yet. Please wait until broadcast is fully completed.' });
    }

    // 4. Calculate failures
    const failedLogs = logs.filter((log: any) => {
      const status = (log.status || log.state || log.call_status || '').toLowerCase();
      // Expanded status list based on Awaj possibilities
      return ['failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 'unanswered', 'timeout', 'no-answer', 'abandoned'].includes(status);
    });

    console.log(`Broadcast ${broadcast.id}: Total Logs: ${logs.length}, Failed Logs: ${failedLogs.length}`);

    if (failedLogs.length === 0) {
      return res.status(200).json({ success: true, message: 'No unreceived calls to refund.', refund_amount: 0 });
    }

    // 5. Calculate refund amount
    const voiceRate = institution.voice_rate || 0.50;
    const refundAmount = Number((failedLogs.length * voiceRate).toFixed(2));

    console.log(`Calculated refund: ${failedLogs.length} calls * ${voiceRate} = ${refundAmount} for institution ${institutionId}`);

    // 6. Update balance
    // Prefer RPC as it is atomic
    const { error: addBalanceErr } = await supabase.rpc('add_balance', {
      p_institution_id: institutionId,
      p_amount: refundAmount
    });

    if (addBalanceErr) {
       console.log('RPC add_balance failed:', JSON.stringify(addBalanceErr));
       const currentBalance = Number(institution.balance || 0);
       const newBalance = Number((currentBalance + refundAmount).toFixed(2));
       
       console.log(`Falling back to manual update: Current: ${currentBalance}, Refund: ${refundAmount}, New: ${newBalance}`);

       const { error: manualUpdateErr } = await supabase
         .from('institutions')
         .update({ balance: newBalance })
         .eq('id', institutionId);
         
       if (manualUpdateErr) {
         console.error('Manual balance update failed:', JSON.stringify(manualUpdateErr));
         throw manualUpdateErr;
       }
    }

    // 7. Insert Transaction Record
    const txData: any = {
      institution_id: institutionId,
      amount: refundAmount,
      transaction_id: refundTxId,
      sender_phone: 'SYSTEM',
      description: `Refund for ${failedLogs.length} unreceived calls (Voice Broadcast)`,
      type: 'credit',
      status: 'approved',
      module: 'voice'
    };
    
    // Ensure sms_count is a solid integer to avoid type mismatch
    txData.sms_count = 0;

    console.log('Attempting transaction insert with data:', JSON.stringify(txData));

    const { error: txError } = await supabase.from('transactions').insert(txData);

    if (txError) {
      console.error('CRITICAL: Transaction insert error:', JSON.stringify(txError));
      // Log specific fields to check for issues
      console.error(`Field types check: amount=${typeof txData.amount}, module=${typeof txData.module}, institution_id=${typeof txData.institution_id}`);
      throw txError;
    }

    return res.status(200).json({ 
      success: true, 
      refunded_calls: failedLogs.length,
      refund_amount: refundAmount,
      message: `Successfully refunded ${refundAmount} ৳` 
    });

  } catch (error: any) {
    console.error('Auto Refund Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
