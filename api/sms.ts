import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export interface SmsProviderResult {
  success: boolean;
  provider: 'reve' | 'automas';
  recipient: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

// Simple in-memory cache to prevent double sending due to network retries
const requestCache = new Map<string, number>();

function httpsGet(url: string, agent: https.Agent, timeoutMs = 6000): Promise<{ ok: boolean; text: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    const req = https.get(url, { agent }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (!resolved) {
          resolved = true;
          resolve({
            ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
            text: data
          });
        }
      });
    });
    req.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve({
          ok: false,
          text: err.message || 'Network error'
        });
      }
    });
    req.setTimeout(timeoutMs, () => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        resolve({
          ok: false,
          text: 'Request timeout'
        });
      }
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, smsType = 'masking', institutionId, messages, apiUrl, apiUrls } = req.body;

    // Create a custom agent to ignore SSL certificate errors if any
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    // 1. Check if this is a Routed Dispatch Request
    if (action === 'send_routed_sms' || (Array.isArray(messages) && messages.length > 0)) {
      // Fetch global system settings & institution overrides from Supabase
      const defaults = { 
        reve_api_key: 'aa407e1c6629da8e', 
        reve_secret_key: '91051e7e', 
        reve_caller_id: '1234',
        reve_client_id: 'DEENORA',
        reve_non_masking_id: '',
        automas_api_key: '10f3d0e31061dd30138ef383b2bd49f1',
        automas_masking_sender_id: '',
        automas_non_masking_sender_id: '09617640326',
        sms_provider_config: {
          reve: { masking_enabled: true, non_masking_enabled: true },
          automas: { masking_enabled: false, non_masking_enabled: true },
          primary: { masking: 'reve', non_masking: 'reve' },
          masking_rate: 0.55,
          non_masking_rate: 0.35
        }
      };

      let sysSettings: any = { ...defaults };
      let instSettings: any = {};

      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { data: sysData } = await supabase
            .from('system_settings')
            .select('*')
            .eq('id', '00000000-0000-0000-0000-000000000001')
            .maybeSingle();
          if (sysData) {
            sysSettings = {
              ...sysSettings,
              ...sysData,
              reve_api_key: sysData.reve_api_key || sysSettings.reve_api_key,
              reve_secret_key: sysData.reve_secret_key || sysSettings.reve_secret_key,
              reve_non_masking_id: sysData.reve_non_masking_id || sysData.reve_caller_id || '',
              sms_provider_config: sysData.sms_provider_config || sysSettings.sms_provider_config
            };
          }

          if (institutionId) {
            const { data: instData } = await supabase
              .from('institutions')
              .select('reve_api_key, reve_secret_key, reve_client_id, reve_caller_id, reve_non_masking_id, automas_api_key, automas_masking_sender_id, automas_non_masking_sender_id')
              .eq('id', institutionId)
              .single();
            if (instData) {
              instSettings = {
                ...instData,
                reve_non_masking_id: instData.reve_non_masking_id || instData.reve_caller_id || ''
              };
            }
          }
        }
      } catch (dbErr) {
        console.warn('Could not fetch SMS settings from database, fallback to defaults:', dbErr);
      }

      // Provider configuration logic
      const config = sysSettings.sms_provider_config || defaults.sms_provider_config;

      // Ensure API keys actually exist before considering them active
      const hasReveKey = Boolean((instSettings.reve_api_key || sysSettings.reve_api_key) && (instSettings.reve_secret_key || sysSettings.reve_secret_key));
      const hasAutomasKey = Boolean(instSettings.automas_api_key || sysSettings.automas_api_key);

      const hasPersonalReveKey = Boolean(instSettings.reve_api_key?.trim() && instSettings.reve_secret_key?.trim());

      let finalType: 'masking' | 'non_masking' = smsType === 'non_masking' ? 'non_masking' : 'masking';
      let primaryProvider: 'reve' | 'automas' = 'reve';

      if (hasPersonalReveKey) {
        finalType = 'masking';
        primaryProvider = 'reve';
      } else {
        const configuredPrimary = config.primary?.[finalType] || config.primary?.masking || 'reve';
        if (configuredPrimary === 'automas' && hasAutomasKey) {
          primaryProvider = 'automas';
        } else if (hasReveKey) {
          primaryProvider = 'reve';
        } else if (hasAutomasKey) {
          primaryProvider = 'automas';
        }
      }

      // Setup REVE send function
      const reveApiKey = (instSettings.reve_api_key || sysSettings.reve_api_key || 'aa407e1c6629da8e').trim();
      const reveSecretKey = (instSettings.reve_secret_key || sysSettings.reve_secret_key || '91051e7e').trim();
      const reveSenderId = (
        finalType === 'masking'
          ? (instSettings.reve_client_id || sysSettings.reve_client_id || sysSettings.reve_caller_id || 'DEENORA')
          : (instSettings.reve_non_masking_id || sysSettings.reve_non_masking_id || sysSettings.reve_caller_id || instSettings.reve_client_id || sysSettings.reve_client_id || 'DEENORA')
      ).trim() || 'DEENORA';

      const sendSingleReve = async (item: { phone?: string; recipient?: string; mobile?: string; text: string }): Promise<SmsProviderResult> => {
        const rawPhone = item.phone || item.recipient || item.mobile || '';
        let normPhone = String(rawPhone).replace(/\D/g, '');
        if (normPhone.startsWith('01') && normPhone.length === 11) {
          normPhone = `88${normPhone}`;
        } else if (normPhone.startsWith('1') && normPhone.length === 10) {
          normPhone = `880${normPhone}`;
        }

        if (!normPhone) {
          return {
            success: false,
            provider: 'reve',
            recipient: rawPhone,
            errorMessage: 'Invalid or missing phone number'
          };
        }

        const url = `https://smpp.revesms.com:7790/sendtext?apikey=${encodeURIComponent(reveApiKey)}&secretkey=${encodeURIComponent(reveSecretKey)}&callerID=${encodeURIComponent(reveSenderId)}&toUser=${encodeURIComponent(normPhone)}&messageContent=${encodeURIComponent(item.text)}&type=3`;

        try {
          const getResult = await httpsGet(url, agent, 6000);
          const resText = getResult.text.trim();

          let isSuccess = false;
          let msgId: string | undefined = undefined;

          try {
            const j = JSON.parse(resText);
            if (j.Status === "0" || j.Status === 0 || j.status === "0" || j.status === 0) {
              isSuccess = true;
              msgId = String(j.Message_ID || j.message_id || j.MessageId || Date.now());
            } else if (j.Message_ID && String(j.Message_ID).trim() !== '' && j.Status !== "109" && j.Status !== "101" && !j.Text?.includes('Invalid')) {
              isSuccess = true;
              msgId = String(j.Message_ID);
            }
          } catch (pE) {
            const isNumericId = /^\d+$/.test(resText);
            isSuccess = getResult.ok && (
              isNumericId || 
              resText.toLowerCase().includes('success') || 
              resText.startsWith('1001') ||
              resText.toUpperCase().includes('ACCEPTD') ||
              resText.toUpperCase().includes('ACCEPTED') ||
              resText.toLowerCase().includes('submitted')
            );
            if (isSuccess) msgId = resText;
          }

          return {
            success: isSuccess,
            provider: 'reve',
            recipient: rawPhone,
            providerMessageId: isSuccess ? msgId : undefined,
            errorCode: !isSuccess ? resText : undefined,
            errorMessage: !isSuccess ? `REVE error: ${resText}` : undefined
          };
        } catch (err: any) {
          return {
            success: false,
            provider: 'reve',
            recipient: rawPhone,
            errorMessage: err.message || 'Network request failed'
          };
        }
      };

      // Setup Automas send function
      const automasApiKey = (instSettings.automas_api_key || sysSettings.automas_api_key || '').trim();
      const rawAutomasSenderId = (
        finalType === 'non_masking'
          ? (instSettings.automas_non_masking_sender_id || sysSettings.automas_non_masking_sender_id || instSettings.automas_masking_sender_id || sysSettings.automas_masking_sender_id || '')
          : (instSettings.automas_masking_sender_id || sysSettings.automas_masking_sender_id || instSettings.automas_non_masking_sender_id || sysSettings.automas_non_masking_sender_id || '')
      ).trim();

      const AUTOMAS_ERROR_MAP: Record<number | string, string> = {
        0: 'Success',
        101: 'বার্তা অনেক লম্বা (Invalid Message Length)',
        102: 'Sender ID অনুমোদিত নয় (Invalid / Unapproved Sender ID)',
        103: 'Automas Authentication পয়েন্টে ত্রুটি',
        104: 'ব্যবহারকারী অকার্যকর (Invalid User)',
        105: 'মোবাইল নম্বরটি সঠিক নয় (Invalid MSISDN)',
        106: 'Automas API Key সঠিক নয় (Incorrect API Key)',
        107: 'Automas অ্যাকাউন্ট সাময়িকভাবে স্থগিত',
        110: 'গ্রাহকের সিমে DND সার্ভিস অন করা আছে (Do Not Disturb)',
        111: 'বার্তায় নিষিদ্ধ শব্দ (Spam Word) পাওয়া গেছে',
        1000: 'Automas গেটওয়েতে পর্যাপ্ত এসএমএস ব্যালেন্স নেই (Insufficient Balance)'
      };

      const parseAutomasResponse = (parsedJson: any, resText: string) => {
        let isSuccess = false;
        let msgId: string | undefined = undefined;
        let errorMsg: string | undefined = undefined;

        if (parsedJson) {
          if (Array.isArray(parsedJson.response) && parsedJson.response.length > 0) {
            const first = parsedJson.response[0];
            const st = first.status !== undefined ? Number(first.status) : undefined;
            if (st === 0) {
              isSuccess = true;
              msgId = String(first.id || first.sid || first.cid || Date.now());
            } else if (st !== undefined) {
              errorMsg = AUTOMAS_ERROR_MAP[st] || `Automas Error Code ${st}`;
            }
          } else if (parsedJson.response !== undefined && (typeof parsedJson.response === 'number' || typeof parsedJson.response === 'string')) {
            const respVal = parsedJson.response;
            const numCode = Number(respVal);
            if (!isNaN(numCode)) {
              if (numCode === 0) {
                isSuccess = true;
                msgId = String(Date.now());
              } else {
                errorMsg = AUTOMAS_ERROR_MAP[numCode] || `Automas Error Code ${numCode}`;
              }
            } else if (String(respVal).toLowerCase().includes('success') || String(respVal).toLowerCase().includes('submitted')) {
              isSuccess = true;
              msgId = String(Date.now());
            } else {
              errorMsg = String(respVal);
            }
          } else if (parsedJson.status !== undefined) {
            const st = Number(parsedJson.status);
            if (st === 0 || parsedJson.status === 'SUCCESS' || parsedJson.status === 'success') {
              isSuccess = true;
              msgId = String(parsedJson.id || parsedJson.sid || Date.now());
            } else if (!isNaN(st)) {
              errorMsg = AUTOMAS_ERROR_MAP[st] || `Automas Error Code ${st}`;
            }
          } else if (parsedJson.response_code !== undefined) {
            const rc = Number(parsedJson.response_code);
            if (rc === 202 || rc === 200 || rc === 0) {
              isSuccess = true;
              msgId = String(parsedJson.message_id || parsedJson.messageId || Date.now());
            } else {
              errorMsg = AUTOMAS_ERROR_MAP[rc] || parsedJson.error_message || `Automas Error Code ${rc}`;
            }
          }
        }

        if (!isSuccess && !errorMsg && resText) {
          const numCode = Number(resText.trim());
          if (!isNaN(numCode)) {
            if (numCode === 0) {
              isSuccess = true;
              msgId = String(Date.now());
            } else {
              errorMsg = AUTOMAS_ERROR_MAP[numCode] || `Automas Error Code ${numCode}`;
            }
          } else if (resText.toLowerCase().includes('success') || resText.toLowerCase().includes('submitted')) {
            isSuccess = true;
            msgId = String(Date.now());
          } else {
            errorMsg = resText;
          }
        }

        return { isSuccess, msgId, errorMsg };
      };

      const sendSingleAutomas = async (item: { phone?: string; recipient?: string; mobile?: string; text: string }): Promise<SmsProviderResult> => {
        const rawPhone = item.phone || item.recipient || item.mobile || '';
        if (!automasApiKey || !rawAutomasSenderId) {
          return {
            success: false,
            provider: 'automas',
            recipient: rawPhone,
            errorMessage: 'Automas credentials not configured'
          };
        }

        let normPhone = String(rawPhone).replace(/\D/g, '');
        if (normPhone.length === 10 && normPhone.startsWith('1')) normPhone = `0${normPhone}`;
        const currentPhone = normPhone.startsWith('880') && normPhone.length === 13 ? normPhone.slice(2) : normPhone;
        const isUnicode = /[^\x00-\x7F]/.test(item.text);

        try {
          const payload: any = {
            api_key: automasApiKey,
            senderid: rawAutomasSenderId,
            type: isUnicode ? 'unicode' : 'text',
            scheduledDateTime: '',
            msg: item.text,
            contacts: currentPhone
          };
          if (isUnicode) payload.smsformat = 8;

          const response = await fetch('https://api.automas.com.bd/smsapiv3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(3000)
          });

          const resText = await response.text();
          let parsedJson: any = null;
          try { parsedJson = JSON.parse(resText); } catch (pE) {}

          const parsed = parseAutomasResponse(parsedJson, resText);
          return {
            success: parsed.isSuccess,
            provider: 'automas',
            recipient: rawPhone,
            providerMessageId: parsed.msgId,
            errorMessage: !parsed.isSuccess ? (parsed.errorMsg || 'Automas delivery failed') : undefined
          };
        } catch (err: any) {
          return {
            success: false,
            provider: 'automas',
            recipient: rawPhone,
            errorMessage: err.message || 'Automas request failed'
          };
        }
      };

      // Dispatcher with Auto-Fallback
      const sendSingleWithFallback = async (item: { phone?: string; recipient?: string; mobile?: string; text: string }): Promise<SmsProviderResult> => {
        if (primaryProvider === 'automas' && automasApiKey && rawAutomasSenderId) {
          const autoRes = await sendSingleAutomas(item);
          if (autoRes.success) return autoRes;
          // Fallback to REVE if Automas failed or timed out
          const reveRes = await sendSingleReve(item);
          return reveRes;
        } else {
          const reveRes = await sendSingleReve(item);
          if (reveRes.success) return reveRes;
          // Fallback to Automas if REVE failed
          if (automasApiKey && rawAutomasSenderId) {
            const autoRes = await sendSingleAutomas(item);
            if (autoRes.success) return autoRes;
          }
          return reveRes;
        }
      };

      const results: SmsProviderResult[] = [];
      const chunkSize = 10;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(sendSingleWithFallback));
        results.push(...chunkResults);
      }

      return res.status(200).json({
        success: true,
        provider: primaryProvider,
        smsType: finalType,
        results
      });
    }

    // 2. Legacy requests support (apiUrls / apiUrl)
    if (apiUrls && Array.isArray(apiUrls)) {
      const results = await Promise.allSettled(apiUrls.map(async (url) => {
        const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
        const text = await response.text();
        return { success: response.ok, response: text, url };
      }));
      
      const formattedResults = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, response: r.reason, url: '' });
      return res.status(200).json({ success: true, results: formattedResults });
    }

    if (!apiUrl) {
      return res.status(400).json({ error: 'apiUrl or messages required' });
    }

    const now = Date.now();
    const lastRequestTime = requestCache.get(apiUrl);
    
    if (lastRequestTime && (now - lastRequestTime) < 5000) {
      return res.status(200).json({ success: true, response: 'Duplicate request blocked by idempotency check' });
    }

    requestCache.set(apiUrl, now);
    
    for (const [key, timestamp] of requestCache.entries()) {
      if (now - timestamp > 10000) {
        requestCache.delete(key);
      }
    }

    const response = await fetch(apiUrl, { method: 'GET', signal: AbortSignal.timeout(8000) });
    const text = await response.text();

    return res.status(200).json({ success: true, response: text });
  } catch (error: any) {
    console.error('SMS Proxy Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
