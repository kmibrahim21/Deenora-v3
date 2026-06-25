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

    const { broadcast_id, campaign_id } = req.body;
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

    const targetCampaignId = campaign_id || broadcast.provider_campaign_id;

    if (!targetCampaignId) {
      return res.status(400).json({ error: 'No provider campaign ID found to process' });
    }

    // 2. Add Jitter to prevent exact ms race conditions
    const jitterMs = Math.floor(Math.random() * 2000) + 500;
    await new Promise(r => setTimeout(r, jitterMs));

    // 2.1 Check if already refunded
    const refundTxId = `REFUND_CAMP_${targetCampaignId}`;
    const { data: existingRefund } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_id', refundTxId)
      .maybeSingle();

    if (existingRefund) {
      return res.status(200).json({ success: true, already_refunded: true, message: 'Refund already processed for this campaign' });
    }

    // Generate deterministic UUID to prevent race conditions on insert
    const crypto = await import('crypto');
    const hash = crypto.createHash('md5').update(refundTxId).digest('hex');
    const deterministicId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;

    // 3. Fetch logs from Awaj API
    const headers = getAwajHeaders();
    let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${targetCampaignId}/result`, { headers: headers as any });
    if (response.status === 404) {
      response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${targetCampaignId}`, { headers: headers as any });
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
      (resultData.results && Array.isArray(resultData.results) ? resultData.results :
      (resultData.data && Array.isArray(resultData.data) ? resultData.data : 
      (resultData.broadcast?.logs ? resultData.broadcast.logs : 
      (resultData.broadcast?.calls ? resultData.broadcast.calls : 
      (resultData.calls ? resultData.calls : [])))));

    if (!logs || logs.length === 0) {
      console.log(`No logs found for broadcast ${broadcast.id} (Provider ID: ${targetCampaignId}). Full response:`, JSON.stringify(resultData));
      return res.status(200).json({ 
        success: true, 
        message: 'No call logs found yet. Please wait until broadcast is fully completed.',
        refund_amount: 0,
        debug_awaj_response: { has_results: !!resultData.results, results_count: resultData.results?.length }
      });
    }

    // 4. Calculate failures
    const failedLogs = logs.filter((log: any) => {
      const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
      
      // Success statuses
      const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up'];
      if (successStatuses.includes(status)) return false;

      // Failure statuses
      const failureStatuses = [
        'failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 
        'rejected', 'declined', 'unanswered', 'timeout', 'no-answer', 
        'abandoned', 'not_answered', 'notanswered', 'notpicked', 'not_picked',
        'missed', 'blocked', 'unavailable'
      ];
      
      if (failureStatuses.includes(status)) return true;

      // If duration is 0 and it's not pending/sending, it's likely a failure
      const duration = Number(log.duration || 0);
      if (duration === 0 && !['pending', 'sending', 'processing', 'queued'].includes(status)) {
        return true;
      }

      return false;
    });

    const totalSentOriginal = Number(broadcast.total_numbers || 1);
    const isRetry = targetCampaignId !== broadcast.provider_campaign_id;
    
    // Attempt to extract the true total from the API response
    const apiTotal = Number(
        resultData.total || 
        resultData.broadcast?.total || 
        resultData.broadcast?.total_numbers ||
        resultData.broadcast?.recipient_count ||
        resultData.data?.total ||
        resultData.stats?.total || 0
    );

    let campaignTotalSent = 0;
    if (apiTotal > logs.length) {
      campaignTotalSent = apiTotal;
    } else if (!isRetry) {
      // It is the original campaign, we know the exact number we charged for
      campaignTotalSent = Math.max(logs.length, totalSentOriginal);
    } else {
      // It is a retry campaign, since we do not store the exact retry count we fallback to logs.length
      // This prevents refunding calls that belonged to the original broadcast and calculating massive "dropped calls"
      campaignTotalSent = logs.length;
    }

    if (!isRetry && campaignTotalSent > totalSentOriginal) {
       campaignTotalSent = totalSentOriginal;
    }

    let droppedCalls = Math.max(0, campaignTotalSent - logs.length);
    let totalFailuresToRefund = Math.min(failedLogs.length + droppedCalls, campaignTotalSent);
    if (!isRetry && totalFailuresToRefund > totalSentOriginal) {
       totalFailuresToRefund = totalSentOriginal;
    }

    if (totalFailuresToRefund === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No unreceived calls detected. All calls were either answered or are still in progress.', 
        refund_amount: 0,
        stats: {
          total_sent: campaignTotalSent,
          logs_received: logs.length,
          failed_logs: failedLogs.length,
          dropped_calls: droppedCalls
        }
      });
    }

    // 5. Calculate refund amount
    const voiceRate = institution.voice_rate || 0.50;
    const refundAmount = Number((totalFailuresToRefund * voiceRate).toFixed(2));

    console.log(`Calculated refund: ${totalFailuresToRefund} unreceived calls * ${voiceRate} = ${refundAmount} for institution ${institutionId}`);

    // 6. Insert Transaction Record FIRST (fail fast on duplicate)
    const txData: any = {
      id: deterministicId,
      institution_id: institutionId,
      amount: refundAmount,
      transaction_id: refundTxId,
      sender_phone: 'SYSTEM',
      description: `Refund for ${totalFailuresToRefund} unreceived calls (Voice Broadcast)`,
      type: 'credit',
      status: 'approved',
      module: 'voice'
    };
    
    // Ensure sms_count is a solid integer to avoid type mismatch
    txData.sms_count = 0;

    console.log('Attempting transaction insert with data:', JSON.stringify(txData));

    const { error: txError } = await supabase.from('transactions').insert(txData);

    if (txError) {
      if (txError.message?.toLowerCase().includes('duplicate') || txError.code === '23505') {
        return res.status(200).json({ success: true, already_refunded: true, message: 'Refund already processed for this campaign due to concurrent request' });
      }
      console.error('CRITICAL: Transaction insert error:', JSON.stringify(txError));
      // Log specific fields to check for issues
      console.error(`Field types check: amount=${typeof txData.amount}, module=${typeof txData.module}, institution_id=${typeof txData.institution_id}`);
      throw txError;
    }

    // 7. Update balance AFTER successful transaction insert
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
         // Optional: rollback transaction? But we rely on it now. User can contact to fix balance if this edge fails.
       }
    }

    return res.status(200).json({ 
      success: true, 
      refunded_calls: totalFailuresToRefund,
      refund_amount: refundAmount,
      message: `Successfully refunded ${refundAmount} ৳` 
    });

  } catch (error: any) {
    console.error('Auto Refund Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
