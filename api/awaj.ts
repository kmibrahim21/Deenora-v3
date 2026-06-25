
import type { VercelRequest, VercelResponse } from '@vercel/node';
// native fetch used
import FormData from 'form-data';
import { Buffer } from 'node:buffer';

const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';

const getAwajHeaders = () => {
  const token = (process.env.AWAJ_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('AWAJ_API_TOKEN is not set. Please add it to your environment variables in settings.');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const parts = pathname.split('/').filter(Boolean);
  
  // More robust action detection
  let action = parts[2]; // e.g. 'voices', 'broadcast', 'senders', etc.
  if (parts[1] === 'awaj' && !action) {
    action = (req.query.action as string) || 'voices';
  }
  const subAction = parts[3] || (req.query.id as string);

  // Ensure body is parsed if it's a string
  if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      console.warn('Failed to parse req.body as JSON in awaj API handler:', e);
    }
  }

  try {
    const headers = getAwajHeaders();

    // VOICES
    if (action === 'voices') {
      if (req.method === 'GET') {
        const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: headers as any });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
        }
        const data = await response.json();
        return res.status(200).json(data);
      }
      if (req.method === 'POST') {
        const body = req.body || {};
        const { name, file_url } = body;
        let bodyStr: any = JSON.stringify(body);
        let requestHeaders: any = { ...headers };
        if (file_url) {
          const fileRes = await fetch(file_url);
          if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.statusText}`);
          const fileBuffer = await fileRes.arrayBuffer();
          const contentType = fileRes.headers.get('content-type') || 'audio/mpeg';
          const extension = file_url.split('.').pop()?.split('?')[0] || 'mp3';
          const filename = `voice.${extension}`;
          const formData = new FormData();
          formData.append('name', name || 'Voice Upload');
          formData.append('audio', Buffer.from(new Uint8Array(fileBuffer)), { filename, contentType });
          formData.append('file', Buffer.from(new Uint8Array(fileBuffer)), { filename, contentType });
          bodyStr = formData;
          requestHeaders = { 
            'Authorization': headers.Authorization, 
            'Accept': 'application/json', 
            ...formData.getHeaders() 
          };
        }
        const response = await fetch(`${AWAJ_BASE_URL}/voices/upload`, { 
          method: 'POST', 
          headers: requestHeaders, 
          body: bodyStr 
        });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE' && subAction) {
        const response = await fetch(`${AWAJ_BASE_URL}/voices/${subAction}`, { 
          method: 'DELETE', 
          headers: headers as any 
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
        }
        let data = {};
        try { data = await response.json(); } catch (e) {}
        return res.status(200).json({ success: true, ...data });
      }
    }

    // BROADCAST
    if (action === 'broadcast' || action === 'broadcasts') {
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, { 
          method: 'POST', 
          headers: headers, 
          body: JSON.stringify(req.body) 
        });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'GET') {
        if (subAction) {
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}/result`, { headers: headers });
          if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}`, { headers: headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
          }
          const data = await response.json();
          return res.status(200).json(data);
        } else {
          const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, { headers: headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
          }
          const data = await response.json();
          return res.status(200).json(data);
        }
      }
    }

    // BROADCAST-RESULT (legacy or direct)
    if (action === 'broadcast-result') {
      const id = req.query.id || subAction;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}/result`, { headers: headers });
      if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}`, { headers: headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
      }
      const data = await response.json();
      return res.status(200).json(data);
    }

    // SENDERS
    if (action === 'senders') {
      const response = await fetch(`${AWAJ_BASE_URL}/senders`, { headers: headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
      }
      const data = await response.json();
      return res.status(200).json(data);
    }

    // SURVEYS
    if (action === 'surveys') {
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/surveys`, { 
          method: 'POST', 
          headers: headers, 
          body: JSON.stringify(req.body) 
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
        }
        const data = await response.json();
        return res.status(200).json(data);
      }
    }

    // VOICE-REFUND (Consolidated from /api/voice-refund.ts)
    if (action === 'voice-refund' || action === 'refund') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      try {
        const { getSupabaseAdmin } = await import('../lib/supabase-admin.js');
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

        // Add Jitter
        const jitterMs = Math.floor(Math.random() * 2000) + 500;
        await new Promise(r => setTimeout(r, jitterMs));

        // Check if already refunded
        const refundTxId = `REFUND_CAMP_${targetCampaignId}`;
        const { data: existingRefund } = await supabase
          .from('transactions')
          .select('id')
          .eq('transaction_id', refundTxId)
          .maybeSingle();

        if (existingRefund) {
          return res.status(200).json({ success: true, already_refunded: true, message: 'Refund already processed for this campaign' });
        }

        // Generate deterministic UUID
        const crypto = await import('crypto');
        const hash = crypto.createHash('md5').update(refundTxId).digest('hex');
        const deterministicId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;

        // Fetch logs from Awaj API
        let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${targetCampaignId}/result`, { headers: headers as any });
        if (response.status === 404) {
          response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${targetCampaignId}`, { headers: headers as any });
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch from Awaj API: ${response.statusText}`);
        }

        const resultData = await response.json() as any;
        
        const logs = Array.isArray(resultData) ? resultData : 
          (resultData.results && Array.isArray(resultData.results) ? resultData.results :
          (resultData.data && Array.isArray(resultData.data) ? resultData.data : 
          (resultData.broadcast?.logs ? resultData.broadcast.logs : 
          (resultData.broadcast?.calls ? resultData.broadcast.calls : 
          (resultData.calls ? resultData.calls : [])))));

        if (!logs || logs.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No call logs found yet. Please wait until broadcast is fully completed.',
            refund_amount: 0
          });
        }

        const failedLogs = logs.filter((log: any) => {
          const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
          const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up'];
          if (successStatuses.includes(status)) return false;
          const failureStatuses = ['failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 'unanswered', 'timeout', 'no-answer', 'abandoned', 'not_answered', 'notanswered', 'notpicked', 'not_picked', 'missed', 'blocked', 'unavailable'];
          if (failureStatuses.includes(status)) return true;
          const duration = Number(log.duration || 0);
          if (duration === 0 && !['pending', 'sending', 'processing', 'queued'].includes(status)) return true;
          return false;
        });

        const totalSentOriginal = Number(broadcast.total_numbers || 1);
        const isRetry = targetCampaignId !== broadcast.provider_campaign_id;
        const apiTotal = Number(resultData.total || resultData.broadcast?.total || resultData.broadcast?.total_numbers || resultData.broadcast?.recipient_count || resultData.data?.total || resultData.stats?.total || 0);

        let campaignTotalSent = 0;
        if (apiTotal > logs.length) campaignTotalSent = apiTotal;
        else if (!isRetry) campaignTotalSent = Math.max(logs.length, totalSentOriginal);
        else campaignTotalSent = logs.length;

        if (!isRetry && campaignTotalSent > totalSentOriginal) campaignTotalSent = totalSentOriginal;

        let droppedCalls = Math.max(0, campaignTotalSent - logs.length);
        let totalFailuresToRefund = Math.min(failedLogs.length + droppedCalls, campaignTotalSent);
        if (!isRetry && totalFailuresToRefund > totalSentOriginal) totalFailuresToRefund = totalSentOriginal;

        if (totalFailuresToRefund === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No unreceived calls detected.', 
            refund_amount: 0
          });
        }

        const voiceRate = institution.voice_rate || 0.50;
        const refundAmount = Number((totalFailuresToRefund * voiceRate).toFixed(2));

        const txData: any = {
          id: deterministicId,
          institution_id: institutionId,
          amount: refundAmount,
          transaction_id: refundTxId,
          sender_phone: 'SYSTEM',
          description: `Refund for ${totalFailuresToRefund} unreceived calls (Voice Broadcast)`,
          type: 'credit',
          status: 'approved',
          module: 'voice',
          sms_count: 0
        };

        const { error: txError } = await supabase.from('transactions').insert(txData);

        if (txError) {
          if (txError.message?.toLowerCase().includes('duplicate') || txError.code === '23505') {
            return res.status(200).json({ success: true, already_refunded: true, message: 'Refund already processed for this campaign' });
          }
          throw txError;
        }

        const { error: addBalanceErr } = await supabase.rpc('add_balance', {
          p_institution_id: institutionId,
          p_amount: refundAmount
        });

        if (addBalanceErr) {
           const currentBalance = Number(institution.balance || 0);
           const newBalance = Number((currentBalance + refundAmount).toFixed(2));
           await supabase.from('institutions').update({ balance: newBalance }).eq('id', institutionId);
        }

        return res.status(200).json({ 
          success: true, 
          refunded_calls: totalFailuresToRefund,
          refund_amount: refundAmount,
          message: `Successfully refunded ${refundAmount} ৳` 
        });
      } catch (error: any) {
        console.error('Voice Refund Error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // WEBHOOK
    if (action === 'webhook') {
      if (req.method === 'POST') {
        console.log('Received webhook:', req.body);
        return res.status(200).json({ received: true });
      }
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error: any) {
    console.error(`Awaj API error (${action}):`, error);
    res.status(500).json({ error: error.message });
  }
}
