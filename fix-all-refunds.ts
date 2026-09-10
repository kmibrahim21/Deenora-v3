import { getSupabaseAdmin } from './lib/supabase-admin.js';
import dotenv from 'dotenv';
import https from 'node:https';
import http from 'node:http';
import { Buffer } from 'node:buffer';
dotenv.config();

const supabase = getSupabaseAdmin();
const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';

async function fetchWavDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, (res) => {
        const chunks: Buffer[] = [];
        let totalLength = 0;
        let resolved = false;
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          totalLength += chunk.length;
          if (totalLength >= 4096) {
            res.destroy();
          }
        });

        const finish = () => {
          if (resolved) return;
          resolved = true;
          try {
            const buffer = Buffer.concat(chunks);
            if (buffer.length < 44) {
              resolve(0);
              return;
            }
            const byteRate = buffer.readUInt32LE(28);
            let dataOffset = 12;
            while (dataOffset < buffer.length - 8) {
              const subchunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
              const subchunkSize = buffer.readUInt32LE(dataOffset + 4);
              if (subchunkId === 'data') {
                const durationSec = subchunkSize / byteRate;
                resolve(durationSec);
                return;
              }
              dataOffset += 8 + subchunkSize;
            }
            const estDuration = buffer.length / byteRate;
            resolve(estDuration);
          } catch (e) {
            resolve(0);
          }
        };
        
        res.on('end', finish);
        res.on('close', finish);
        res.on('error', () => {
          if (!resolved) {
            resolved = true;
            resolve(0);
          }
        });
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve(0);
      });

      req.on('error', () => resolve(0));
    } catch (err) {
      resolve(0);
    }
  });
}

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

async function fixAllRefunds() {
  console.log('=== STARTING VOICE REFUND AUDIT & FIX PROCESS ===');
  
  // 1. Fetch all voice broadcasts with non-null provider_campaign_id
  const { data: broadcasts, error: bErr } = await supabase
    .from('voice_broadcasts')
    .select('*')
    .not('provider_campaign_id', 'is', null)
    .order('created_at', { ascending: false });

  if (bErr || !broadcasts) {
    console.error('Error fetching broadcasts:', bErr);
    return;
  }

  console.log(`Found ${broadcasts.length} broadcasts total to check.`);
  console.log('Sample broadcasts:', broadcasts.slice(0, 5).map(b => ({ id: b.id, provider_campaign_id: b.provider_campaign_id })));

  const token = (process.env.AWAJ_API_TOKEN || '').trim();
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up', 'connected', 'complete', 'finished', 'finished_success', 'picked up'];
  const failureStatuses = [
    'failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 
    'unanswered', 'timeout', 'no-answer', 'abandoned', 'not_answered', 'notanswered', 
    'notpicked', 'not_picked', 'missed', 'blocked', 'unavailable', 'not answered', 'not picked',
    'no-picked', 'no_picked', 'noanswer', 'not-picked', 'reject', 'declined', 'failed-retry', 'failed_retry',
    'no picked', 'no answered', 'no answer', 'not pick', 'not-pickedup', 'not_pickedup'
  ];

  // In-memory caches to prevent thousands of duplicate database calls
  const templateCache = new Map<string, number>();
  const institutionCache = new Map<string, { name: string, balance: number, voice_rate: number } | null>();
  let cachedSysSettings: { voice_rate: number } | null = null;

  let currentCount = 0;

  for (const broadcast of broadcasts) {
    currentCount++;
    try {
      const mainCampaignId = broadcast.provider_campaign_id;
      if (!mainCampaignId) {
        continue;
      }

      const institutionId = broadcast.institution_id;
      const prevRefund = Number(broadcast.refunded_amount || 0);

      // Only print general progress every 50 items to keep output short, unless we find an adjustment
      const isPeriodicProgress = (currentCount % 50 === 0 || currentCount === 1 || currentCount === broadcasts.length);
      if (isPeriodicProgress) {
        console.log(`[Progress: ${currentCount}/${broadcasts.length}] Auditing broadcast ${broadcast.id}...`);
      }

      // 1. Get voice template duration (with cache check)
      let templateDuration = 0;
      if (broadcast.voice_template_id) {
        if (templateCache.has(broadcast.voice_template_id)) {
          templateDuration = templateCache.get(broadcast.voice_template_id) || 0;
        } else {
          const { data: vTemp } = await supabase
            .from('voice_templates')
            .select('duration, file_url')
            .eq('id', broadcast.voice_template_id)
            .maybeSingle();
          
          if (vTemp?.duration) {
            templateDuration = Number(vTemp.duration) || 0;
          } else if (vTemp?.file_url) {
            try {
              const durationSec = await fetchWavDuration(vTemp.file_url);
              if (durationSec > 0) {
                templateDuration = Math.ceil(durationSec);
                await supabase
                  .from('voice_templates')
                  .update({ duration: templateDuration })
                  .eq('id', broadcast.voice_template_id);
              }
            } catch (e) {
              console.error(`  Error fetching WAV duration for template ${broadcast.voice_template_id}:`, e);
            }
          }
          templateCache.set(broadcast.voice_template_id, templateDuration);
        }
      }

      // 2. Get institution rate (with cache check)
      let institution = null;
      if (institutionId) {
        if (institutionCache.has(institutionId)) {
          institution = institutionCache.get(institutionId);
        } else {
          const { data: inst } = await supabase
            .from('institutions')
            .select('name, balance, voice_rate')
            .eq('id', institutionId)
            .single();
          institution = inst;
          institutionCache.set(institutionId, inst);
        }
      }

      // 3. Get system settings (with cache check)
      if (!cachedSysSettings) {
        const { data: sysSettings } = await supabase
          .from('system_settings')
          .select('voice_rate')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        cachedSysSettings = sysSettings;
      }

      const voiceRate = Number(institution?.voice_rate || cachedSysSettings?.voice_rate || 0.45);
      const totalSentOriginal = Math.max(1, Number(broadcast.total_numbers || 1));
      const estimatedCostOriginal = Number(broadcast.estimated_cost || (totalSentOriginal * voiceRate));

      // Calculate pulse rules
      const maxPulsesForThisAudio = (templateDuration > 0 && templateDuration > 30) ? Math.min(2, Math.ceil(templateDuration / 30)) : 1;
      const chargedPulsesPerCall = maxPulsesForThisAudio;
      const costPerPulse = voiceRate;

      const allCampaignIds = [mainCampaignId, ...(broadcast.retries || [])].filter(id => !!id);

      let totalOverallRefundPulses = 0;
      let anyLogsFound = false;

      for (const campId of allCampaignIds) {
        try {
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${campId}/result`, { headers: headers as any });
          if (response.status === 404) {
            response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${campId}`, { headers: headers as any });
          }

          if (!response.ok) {
            console.warn(`  Campaign ${campId} logs fetch failed: ${response.statusText}`);
            continue;
          }

          const resultData = await response.json() as any;
          const campaignLogs = extractLogs(resultData);

          if (!campaignLogs || campaignLogs.length === 0) {
            continue;
          }

          anyLogsFound = true;
          let campaignRefundPulses = 0;

          campaignLogs.forEach((log: any) => {
            const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
            const rawDuration = log.duration ?? log.billsec ?? log.duration_sec ?? log.talking_time ?? log.seconds ?? log.duration_seconds ?? log.call_duration ?? log.answer_duration ?? 0;
            const duration = Number(rawDuration) || 0;

            const isFailedStatus = failureStatuses.includes(status) || status.includes('not picked') || status.includes('not answered') || status.includes('no answer');
            const isSuccessStatus = successStatuses.includes(status);

            if (isSuccessStatus || duration > 0) {
              let pulsesUsed = 1;
              if (duration > 0 && templateDuration > 30) {
                pulsesUsed = Math.min(2, Math.ceil(duration / 30));
              }
              if (pulsesUsed > maxPulsesForThisAudio) pulsesUsed = maxPulsesForThisAudio;
              if (pulsesUsed > chargedPulsesPerCall) pulsesUsed = chargedPulsesPerCall;

              const refundPulsesForThisCall = Math.max(0, chargedPulsesPerCall - pulsesUsed);
              campaignRefundPulses += refundPulsesForThisCall;
            } else if (isFailedStatus) {
              campaignRefundPulses += chargedPulsesPerCall;
            } else if (!['pending', 'sending', 'processing', 'queued'].includes(status)) {
              campaignRefundPulses += chargedPulsesPerCall;
            }
          });

          // Add dropped calls if campaign finished
          const isOriginal = String(campId) === String(mainCampaignId);
          const apiTotal = Number(resultData.total || resultData.broadcast?.total || resultData.broadcast?.total_numbers || resultData.broadcast?.recipient_count || resultData.data?.total || resultData.stats?.total || 0);

          let campaignTotalSent = 0;
          if (apiTotal > campaignLogs.length) {
            campaignTotalSent = apiTotal;
          } else if (isOriginal) {
            campaignTotalSent = Math.max(campaignLogs.length, totalSentOriginal);
          } else {
            campaignTotalSent = campaignLogs.length;
          }

          if (isOriginal && campaignTotalSent > totalSentOriginal) {
            campaignTotalSent = totalSentOriginal;
          }

          const isFinished = ['completed', 'done', 'success', 'complete', 'finished', 'failed', 'error', 'cancelled'].includes(String(broadcast.status || '').toLowerCase());
          if (isFinished) {
            const droppedCalls = Math.max(0, campaignTotalSent - campaignLogs.length);
            campaignRefundPulses += (droppedCalls * chargedPulsesPerCall);
          }

          const maxPossibleRefundPulses = campaignTotalSent * chargedPulsesPerCall;
          if (campaignRefundPulses > maxPossibleRefundPulses) {
            campaignRefundPulses = maxPossibleRefundPulses;
          }

          totalOverallRefundPulses += campaignRefundPulses;

        } catch (campErr) {
          console.error(`  Error fetching/calculating for campaign ${campId}:`, campErr);
        }
      }

      if (!anyLogsFound) {
        continue;
      }

      const calculatedRefund = Number((totalOverallRefundPulses * costPerPulse).toFixed(2));

      // Case 1: Additional refund needed
      if (calculatedRefund > (prevRefund + 0.01)) {
        const additionalRefund = Number((calculatedRefund - prevRefund).toFixed(2));
        console.log(`\n[ADJUSTMENT NEEDED for broadcast ${broadcast.id}]`);
        console.log(`  Institution: "${institution?.name || 'N/A'}" | Campaigns: ${allCampaignIds.join(', ')}`);
        console.log(`  Audio length: ${templateDuration}s, Pulse Cap: ${chargedPulsesPerCall}, Rate: ${costPerPulse} BDT`);
        console.log(`  Summary: Previous Refund: ${prevRefund} BDT, Correct Calculated Refund: ${calculatedRefund} BDT`);
        console.log(`  ==> ADJUSTMENT: Crediting ${additionalRefund} BDT to institution ${institution?.name || institutionId}...`);

        const currentBalance = Number(institution?.balance || 0);
        const newBalance = Number((currentBalance + additionalRefund).toFixed(2));

        // Update wallet balance
        const { error: balErr } = await supabase
          .from('institutions')
          .update({ balance: newBalance })
          .eq('id', institutionId);

        if (balErr) {
          console.error(`  Failed to update balance for ${institutionId}:`, balErr);
          continue;
        }

        // Add transaction record
        await supabase.from('transactions').insert({
          institution_id: institutionId,
          amount: additionalRefund,
          transaction_id: `ADD_REFUND_${mainCampaignId}_${Date.now()}`,
          sender_phone: 'SYSTEM',
          description: `Voice refund adjustment: Credited ${additionalRefund} ৳ additional refund`,
          type: 'credit',
          status: 'approved',
          module: 'voice'
        });

        // Update broadcast history
        await supabase
          .from('voice_broadcasts')
          .update({
            refunded_amount: calculatedRefund,
            is_refunded: calculatedRefund >= (estimatedCostOriginal - 0.01)
          })
          .eq('id', broadcast.id);

        console.log(`  ==> Adjustment completed successfully.`);
      }
      // Case 2: Excess refund corrected (auto-correction)
      else if (prevRefund > (calculatedRefund + 0.01)) {
        const excessRefund = Number((prevRefund - calculatedRefund).toFixed(2));
        console.log(`\n[ADJUSTMENT NEEDED (EXCESS) for broadcast ${broadcast.id}]`);
        console.log(`  Institution: "${institution?.name || 'N/A'}" | Campaigns: ${allCampaignIds.join(', ')}`);
        console.log(`  Audio length: ${templateDuration}s, Pulse Cap: ${chargedPulsesPerCall}, Rate: ${costPerPulse} BDT`);
        console.log(`  Summary: Previous Refund: ${prevRefund} BDT, Correct Calculated Refund: ${calculatedRefund} BDT`);
        console.log(`  ==> AUTO-CORRECTION: Deducting ${excessRefund} BDT excess refund from institution ${institution?.name || institutionId}...`);

        const currentBalance = Number(institution?.balance || 0);
        const newBalance = Math.max(0, Number((currentBalance - excessRefund).toFixed(2)));

        // Update wallet balance
        const { error: balErr } = await supabase
          .from('institutions')
          .update({ balance: newBalance })
          .eq('id', institutionId);

        if (balErr) {
          console.error(`  Failed to deduct balance for ${institutionId}:`, balErr);
          continue;
        }

        // Add transaction record
        await supabase.from('transactions').insert({
          institution_id: institutionId,
          amount: excessRefund,
          transaction_id: `CORRECT_VOICE_${broadcast.id.slice(0, 8)}_${Date.now()}`,
          sender_phone: 'SYSTEM',
          description: `Voice refund auto-correction: Deducted ${excessRefund} ৳ excess refund`,
          type: 'debit',
          status: 'approved',
          module: 'voice'
        });

        // Update broadcast history
        await supabase
          .from('voice_broadcasts')
          .update({
            refunded_amount: calculatedRefund,
            is_refunded: calculatedRefund >= (estimatedCostOriginal - 0.01)
          })
          .eq('id', broadcast.id);

        console.log(`  ==> Correction completed successfully.`);
      }
    } catch (loopErr: any) {
      console.error(`  Error processing broadcast ${broadcast?.id || 'unknown'}:`, loopErr.message || loopErr);
    }
  }

  console.log('\n=== REFUND AUDIT & FIX PROCESS COMPLETED PERFECTLY ===');
}

fixAllRefunds();
