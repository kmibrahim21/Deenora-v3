
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
  const urlPath = url.pathname;
  const parts = urlPath.split('/').filter(Boolean);
  
  // Robust action detection
  let action = '';
  if (parts[1] === 'voices' || parts[1] === 'voice') {
    action = parts[2] === 'upload' ? 'upload' : 'voices';
  } else if (parts[1] === 'awaj') {
    action = (parts[2] || 'voices').toLowerCase().trim();
    if (parts[3] === 'upload') {
      action = 'upload';
    }
  } else if (parts[1] === 'voice-refund') {
    action = 'voice-refund';
  } else {
    action = (parts[1] || 'voices').toLowerCase().trim();
  }

  // Override with query or body if explicitly provided
  const explicitAction = (req.query.action as string || req.body?.action as string || '').toLowerCase().trim();
  if (explicitAction) {
    action = explicitAction;
  }

  const subAction = parts[3] || parts[2] || (req.query.id as string);
  console.log(`Awaj API: url=${req.url}, parts=${JSON.stringify(parts)}, action="${action}", subAction="${subAction}"`);

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
    const token = (process.env.AWAJ_API_TOKEN || '').trim();

    // VOICE UPLOAD & MANAGEMENT
    if (action === 'upload' || (action === 'voices' && req.method === 'POST')) {
      const body = req.body || {};
      const voiceName = (body.name || body.voice_name || body.title || '').trim();
      
      if (!voiceName) {
        return res.status(400).json({ message: 'Voice name is required (1-255 characters)' });
      }
      if (voiceName.length > 255) {
        return res.status(400).json({ message: 'Voice name exceeds 255 characters limit' });
      }

      // Extract uploaded audio file
      let fileBuffer: Buffer | null = null;
      let filename = 'voice.mp3';
      let contentType = 'audio/mpeg';

      // 1. From multer req.file or req.files
      const multerReq = req as any;
      const uploadedFile = multerReq.file || 
        (Array.isArray(multerReq.files) ? multerReq.files[0] : null) || 
        (multerReq.files?.['audio']?.[0] || multerReq.files?.['file']?.[0]);

      if (uploadedFile && uploadedFile.buffer) {
        fileBuffer = uploadedFile.buffer;
        filename = uploadedFile.originalname || 'voice.mp3';
        contentType = uploadedFile.mimetype || 'audio/mpeg';
      } 
      // 2. From base64 string in body
      else if (body.audio_base64 || body.audioBase64 || (typeof body.audio === 'string' && body.audio.startsWith('data:'))) {
        const base64Str = body.audio_base64 || body.audioBase64 || body.audio;
        const matches = base64Str.match(/^data:([A-Za-z-+\/0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          fileBuffer = Buffer.from(matches[2], 'base64');
        } else {
          fileBuffer = Buffer.from(base64Str.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
        }
        filename = body.filename || body.audio_filename || `voice.${contentType.split('/')[1] || 'mp3'}`;
      }
      // 3. From downloadable file_url
      else if (body.file_url) {
        const fileRes = await fetch(body.file_url);
        if (!fileRes.ok) throw new Error(`Failed to download file from url: ${fileRes.statusText}`);
        const arrayBuf = await fileRes.arrayBuffer();
        fileBuffer = Buffer.from(new Uint8Array(arrayBuf));
        contentType = fileRes.headers.get('content-type') || 'audio/mpeg';
        const ext = body.file_url.split('.').pop()?.split('?')[0] || 'mp3';
        filename = `voice.${ext}`;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ message: 'Audio file is required. Supported formats: mp3, wav, ogg, m4a, aac, webm, flac' });
      }

      // Check max size (10MB)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (fileBuffer.length > MAX_SIZE) {
        return res.status(413).json({ message: 'File size too large. Maximum allowed size is 10MB' });
      }

      // Check allowed extensions
      const allowedExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'flac'];
      const fileExt = (filename.split('.').pop() || '').toLowerCase();
      if (fileExt && !allowedExts.includes(fileExt)) {
        return res.status(415).json({ 
          message: `Invalid file extension. Allowed extensions: ${allowedExts.join(', ')}` 
        });
      }

      // Create multipart FormData for Awaj Digital
      const formData = new FormData();
      formData.append('name', voiceName);
      formData.append('audio', fileBuffer, {
        filename: filename,
        contentType: contentType
      });

      console.log(`Uploading voice to Awaj Digital: name="${voiceName}", filename="${filename}", size=${fileBuffer.length} bytes`);

      const response = await fetch(`${AWAJ_BASE_URL}/voices/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          ...formData.getHeaders()
        },
        body: formData as any
      });

      const responseData = await response.json().catch(() => ({}));
      console.log(`Awaj Digital Upload Response Status: ${response.status}`, responseData);

      if (!response.ok) {
        return res.status(response.status).json(responseData);
      }

      return res.status(201).json(responseData);
    }

    // VOICES LIST & DELETE
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
      if (req.method === 'DELETE') {
        const voiceIdToDelete = subAction || (req.query.id as string) || parts[parts.length - 1];
        if (!voiceIdToDelete || voiceIdToDelete === 'voices') {
          return res.status(400).json({ error: 'Voice ID is required for deletion' });
        }
        const response = await fetch(`${AWAJ_BASE_URL}/voices/${voiceIdToDelete}`, { 
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

        const broadcastId = req.body.broadcast_id || req.body.broadcastId;
        const campaignId = req.body.campaign_id || req.body.campaignId;
        const providedInstitutionId = req.body.institution_id || req.body.institutionId;

        if (!broadcastId) {
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
          .eq('id', broadcastId)
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

        const targetCampaignId = campaignId || broadcast.provider_campaign_id;
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
        
        const extractLogs = (details: any) => {
          if (!details) return [];
          if (Array.isArray(details)) return details;
          if (details.calls && Array.isArray(details.calls)) return details.calls;
          if (details.logs && Array.isArray(details.logs)) return details.logs;
          if (details.recipients && Array.isArray(details.recipients)) return details.recipients;
          if (details.data && Array.isArray(details.data)) return details.data;
          if (details.results && Array.isArray(details.results)) return details.results;
          if (details.details && Array.isArray(details.details)) return details.details;
          if (details.broadcast?.calls && Array.isArray(details.broadcast.calls)) return details.broadcast.calls;
          if (details.broadcast?.logs && Array.isArray(details.broadcast.logs)) return details.broadcast.logs;
          
          for (const key in details) {
            if (Array.isArray(details[key]) && details[key].length > 0 && typeof details[key][0] === 'object') {
              const firstItem = details[key][0];
              if (firstItem.phone || firstItem.number || firstItem.to || firstItem.msisdn || firstItem.recipient || firstItem.mobile || firstItem.destination) {
                return details[key];
              }
            }
          }
          return [];
        };

        const logs = extractLogs(resultData);

        if (!logs || logs.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No call logs found yet. Please wait until broadcast is fully completed.',
            refund_amount: 0
          });
        }

        const failedLogs = logs.filter((log: any) => {
          const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
          const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up', 'connected', 'complete', 'finished', 'finished_success', 'picked up'];
          if (successStatuses.includes(status)) return false;
          
          const failureStatuses = [
            'failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 
            'unanswered', 'timeout', 'no-answer', 'abandoned', 'not_answered', 'notanswered', 
            'notpicked', 'not_picked', 'missed', 'blocked', 'unavailable', 'not answered', 'not picked',
            'no-picked', 'no_picked', 'noanswer', 'not-picked', 'reject', 'declined', 'failed-retry', 'failed_retry',
            'no picked', 'no answered', 'no answer', 'not pick', 'not-pickedup', 'not_pickedup'
          ];
          if (failureStatuses.includes(status) || status.includes('not picked') || status.includes('not answered') || status.includes('no answer')) return true;
          
          const duration = Number(log.duration || 0);
          if (duration === 0 && !['pending', 'sending', 'processing', 'queued'].includes(status)) return true;
          return false;
        });

        console.log(`Processing refund for campaign ${targetCampaignId}. Logs: ${logs.length}, Failures: ${failedLogs.length}`);

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
        
        console.log(`Campaign ${targetCampaignId}: Total: ${campaignTotalSent}, Logs: ${logs.length}, Dropped: ${droppedCalls}, Failures: ${failedLogs.length}, Final Refund: ${totalFailuresToRefund}`);
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

    console.log(`Awaj API: Action not found or not matched: "${action}" (Path: ${req.url})`);
    return res.status(404).json({ error: `Action not found: ${action}` });
  } catch (error: any) {
    console.error(`Awaj API error (${action}):`, error);
    res.status(500).json({ error: error.message });
  }
}
