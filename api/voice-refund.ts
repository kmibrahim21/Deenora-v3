import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import fetch from 'node-fetch';

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

    // 1. Fetch broadcast details and institution details
    const { data: broadcast, error: broadcastErr } = await supabase
      .from('voice_broadcasts')
      .select('*, institutions(balance, voice_rate)')
      .eq('id', broadcast_id)
      .eq('institution_id', user.id)
      .single();

    if (broadcastErr || !broadcast) {
      return res.status(404).json({ error: 'Broadcast not found or access denied' });
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
      .single();

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
      throw new Error(`Failed to fetch from Awaj API: ${response.statusText}`);
    }

    const resultData = await response.json();
    
    // Extract call logs array
    const logs = Array.isArray(resultData) ? resultData : 
      (resultData.data && Array.isArray(resultData.data) ? resultData.data : 
      (resultData.broadcast?.logs ? resultData.broadcast.logs : []));

    if (!logs || logs.length === 0) {
      // If it's still sending, maybe no logs yet
      return res.status(400).json({ error: 'No call logs found yet. Please wait until broadcast is fully completed.' });
    }

    // 4. Calculate failures
    const failedLogs = logs.filter((log: any) => {
      const status = (log.status || log.state || log.call_status || '').toLowerCase();
      return ['failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined'].includes(status);
    });

    if (failedLogs.length === 0) {
      return res.status(200).json({ message: 'No unreceived calls to refund.', refund_amount: 0 });
    }

    // 5. Calculate refund amount
    const voiceRate = broadcast.institutions?.voice_rate || 0.50;
    const refundAmount = failedLogs.length * voiceRate;

    // 6. Add balance using RPC if it exists, otherwise manual update (RPC handles atomic increment)
    const { error: addBalanceErr } = await supabase.rpc('add_balance', {
      p_institution_id: user.id,
      p_amount: refundAmount
    });

    if (addBalanceErr) {
       // Graceful fallback if RPC doesn't exist
       const currentBalance = Number(broadcast.institutions?.balance || 0);
       const { error: manualUpdateErr } = await supabase
         .from('institutions')
         .update({ balance: currentBalance + refundAmount })
         .eq('id', user.id);
         
       if (manualUpdateErr) throw manualUpdateErr;
    }

    // 7. Insert Transaction Record
    const { error: txError } = await supabase.from('transactions').insert({
      institution_id: user.id,
      amount: refundAmount,
      transaction_id: refundTxId,
      sender_phone: 'SYSTEM',
      description: `Refund for ${failedLogs.length} unreceived calls (Broadcast)`,
      type: 'credit',
      status: 'approved',
      module: 'voice'
    });

    if (txError) throw txError;

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
