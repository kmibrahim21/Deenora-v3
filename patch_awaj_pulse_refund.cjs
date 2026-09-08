const fs = require('fs');
let code = fs.readFileSync('api/awaj.ts', 'utf8');

const oldRefundLogic = `        const failedLogs = logs.filter((log: any) => {
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
          
          const duration = Number(log.duration || log.billsec || 0);
          if (duration === 0 && !['pending', 'sending', 'processing', 'queued'].includes(status)) return true;
          return false;
        });

        console.log(\`Processing refund for campaign \${targetCampaignId}. Logs: \${logs.length}, Failures: \${failedLogs.length}\`);

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
        
        console.log(\`Campaign \${targetCampaignId}: Total: \${campaignTotalSent}, Logs: \${logs.length}, Dropped: \${droppedCalls}, Failures: \${failedLogs.length}, Final Refund: \${totalFailuresToRefund}\`);

        if (!isRetry && totalFailuresToRefund > totalSentOriginal) totalFailuresToRefund = totalSentOriginal;

        if (totalFailuresToRefund === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No unreceived calls detected.', 
            refund_amount: 0 
          });
        }

        const { data: sysSettings } = await supabase
          .from('system_settings')
          .select('voice_rate')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        
        const voiceRate = institution.voice_rate || sysSettings?.voice_rate || 0.45;
        const refundAmount = Number((totalFailuresToRefund * voiceRate).toFixed(2));`;

const newRefundLogic = `        const { data: sysSettings } = await supabase
          .from('system_settings')
          .select('voice_rate')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();

        const voiceRate = Number(institution.voice_rate || sysSettings?.voice_rate || 0.45);
        const totalSentOriginal = Number(broadcast.total_numbers || 1);
        const estimatedCostOriginal = Number(broadcast.estimated_cost || (totalSentOriginal * voiceRate));

        // Calculate how many 30-sec pulses were charged per call upfront (e.g. 1 pulse for <=30s, 2 pulses for >30s)
        const chargedPulsesPerCall = Math.max(1, Math.round(estimatedCostOriginal / (totalSentOriginal * voiceRate)));

        const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up', 'connected', 'complete', 'finished', 'finished_success', 'picked up'];
        const failureStatuses = [
          'failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 
          'unanswered', 'timeout', 'no-answer', 'abandoned', 'not_answered', 'notanswered', 
          'notpicked', 'not_picked', 'missed', 'blocked', 'unavailable', 'not answered', 'not picked',
          'no-picked', 'no_picked', 'noanswer', 'not-picked', 'reject', 'declined', 'failed-retry', 'failed_retry',
          'no picked', 'no answered', 'no answer', 'not pick', 'not-pickedup', 'not_pickedup'
        ];

        let totalRefundPulses = 0;

        logs.forEach((log: any) => {
          const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
          const duration = Number(log.duration || log.billsec || log.duration_sec || log.talking_time || log.seconds || 0);

          const isFailedStatus = failureStatuses.includes(status) || status.includes('not picked') || status.includes('not answered') || status.includes('no answer');
          const isSuccessStatus = successStatuses.includes(status);

          if (isFailedStatus || (duration === 0 && !['pending', 'sending', 'processing', 'queued'].includes(status))) {
            // Unanswered or failed call => 0 pulses used => refund all charged pulses
            totalRefundPulses += chargedPulsesPerCall;
          } else if (isSuccessStatus || duration > 0) {
            // Call was picked up! Calculate pulses used based on 30-sec pulse
            let pulsesUsed = 1;
            if (duration > 0) {
              pulsesUsed = Math.ceil(duration / 30);
            }
            if (pulsesUsed > chargedPulsesPerCall) {
              pulsesUsed = chargedPulsesPerCall;
            }
            const refundPulsesForThisCall = Math.max(0, chargedPulsesPerCall - pulsesUsed);
            totalRefundPulses += refundPulsesForThisCall;
          }
        });

        const apiTotal = Number(resultData.total || resultData.broadcast?.total || resultData.broadcast?.total_numbers || resultData.broadcast?.recipient_count || resultData.data?.total || resultData.stats?.total || 0);
        const isRetry = targetCampaignId !== broadcast.provider_campaign_id;
        let campaignTotalSent = 0;
        if (apiTotal > logs.length) campaignTotalSent = apiTotal;
        else if (!isRetry) campaignTotalSent = Math.max(logs.length, totalSentOriginal);
        else campaignTotalSent = logs.length;
        if (!isRetry && campaignTotalSent > totalSentOriginal) campaignTotalSent = totalSentOriginal;

        const droppedCalls = Math.max(0, campaignTotalSent - logs.length);
        totalRefundPulses += (droppedCalls * chargedPulsesPerCall);

        const maxPossibleRefundPulses = campaignTotalSent * chargedPulsesPerCall;
        if (totalRefundPulses > maxPossibleRefundPulses) {
          totalRefundPulses = maxPossibleRefundPulses;
        }

        console.log(\`Campaign \${targetCampaignId}: Total sent: \${campaignTotalSent}, Logs: \${logs.length}, Charged pulses/call: \${chargedPulsesPerCall}, Total refund pulses: \${totalRefundPulses}\`);

        if (totalRefundPulses <= 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No unreceived calls or pulse refunds detected.', 
            refund_amount: 0 
          });
        }

        const refundAmount = Number((totalRefundPulses * voiceRate).toFixed(2));`;

if (code.includes('const failedLogs = logs.filter')) {
  code = code.replace(oldRefundLogic, newRefundLogic);
  fs.writeFileSync('api/awaj.ts', code);
  console.log('Successfully patched api/awaj.ts for 30s pulse refund');
} else {
  console.error('Could not find oldRefundLogic in api/awaj.ts');
}
