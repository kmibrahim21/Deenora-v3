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

function httpsGet(url: string, agent: https.Agent): Promise<{ ok: boolean; text: string }> {
  return new Promise((resolve) => {
    https.get(url, { agent }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
          text: data
        });
      });
    }).on('error', (err) => {
      resolve({
        ok: false,
        text: err.message || 'Network error'
      });
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
        reve_api_key: '1762419e515c6f28', 
        reve_secret_key: '326edcba', 
        reve_caller_id: 'DEENORA',
        reve_client_id: '',
        reve_non_masking_id: '',
        automas_api_key: '',
        automas_masking_sender_id: '',
        automas_non_masking_sender_id: '',
        sms_provider_config: {
          reve: { masking_enabled: true, non_masking_enabled: true },
          automas: { masking_enabled: false, non_masking_enabled: false },
          primary: { masking: 'reve', non_masking: 'reve' },
          masking_rate: 0.55,
          non_masking_rate: 0.35
        }
      };

      let sysSettings: any = { ...defaults };
      let instSettings: any = {};

      try {
        const supabase = getSupabaseAdmin();
        const { data: sysData } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .maybeSingle();
        if (sysData) {
          sysSettings = {
            ...sysSettings,
            ...sysData,
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
      } catch (dbErr) {
        console.warn('Could not fetch SMS settings from database, fallback to defaults:', dbErr);
      }

      // Provider configuration logic
      const config = sysSettings.sms_provider_config || defaults.sms_provider_config;

      // Ensure API keys actually exist before considering them active
      const hasReveKey = Boolean((instSettings.reve_api_key || sysSettings.reve_api_key) && (instSettings.reve_secret_key || sysSettings.reve_secret_key));
      const hasAutomasKey = Boolean(instSettings.automas_api_key || sysSettings.automas_api_key);
      
      const reveMaskingActive = Boolean(config.reve?.masking_enabled) && hasReveKey;
      const reveNonMaskingActive = Boolean(config.reve?.non_masking_enabled) && hasReveKey;
      const automasMaskingActive = Boolean(config.automas?.masking_enabled) && hasAutomasKey;
      const automasNonMaskingActive = Boolean(config.automas?.non_masking_enabled) && hasAutomasKey;

      const hasPersonalReveKey = Boolean(instSettings.reve_api_key?.trim() && instSettings.reve_secret_key?.trim());

      let finalType: 'masking' | 'non_masking';
      let selectedProvider: 'reve' | 'automas';

      if (hasPersonalReveKey) {
        // If they have personal REVE key set, they ALWAYS route to REVE Masking!
        finalType = 'masking';
        selectedProvider = 'reve';
      } else {
        // Determine finalType based on requested smsType or default_type config
        let type: 'masking' | 'non_masking' | 'unknown' = smsType === 'non_masking' ? 'non_masking' : (smsType === 'masking' ? 'masking' : 'unknown');
        
        if (type === 'unknown') {
          type = config.default_type || 'non_masking';
        }

        finalType = type as 'masking' | 'non_masking';

        // Check active providers for this type
        const reveActive = finalType === 'masking' ? reveMaskingActive : reveNonMaskingActive;
        const automasActive = finalType === 'masking' ? automasMaskingActive : automasNonMaskingActive;

        if (reveActive && automasActive) {
          const primary = config.primary?.[finalType];
          selectedProvider = primary === 'automas' ? 'automas' : 'reve';
        } else if (reveActive) {
          selectedProvider = 'reve';
        } else if (automasActive) {
          selectedProvider = 'automas';
        } else {
          // Fallback to alternate type if nothing is active for selected type
          const altType = finalType === 'masking' ? 'non_masking' : 'masking';
          const altReveActive = altType === 'masking' ? reveMaskingActive : reveNonMaskingActive;
          const altAutomasActive = altType === 'masking' ? automasMaskingActive : automasNonMaskingActive;

          if (altReveActive && altAutomasActive) {
            finalType = altType;
            const primary = config.primary?.[finalType];
            selectedProvider = primary === 'automas' ? 'automas' : 'reve';
          } else if (altReveActive) {
            finalType = altType;
            selectedProvider = 'reve';
          } else if (altAutomasActive) {
            finalType = altType;
            selectedProvider = 'automas';
          } else {
            // Absolute fallback to Automas or REVE
            selectedProvider = hasReveKey ? 'reve' : 'automas';
          }
        }
      }

      const results: SmsProviderResult[] = [];

      if (selectedProvider === 'reve') {
        const apiKey = (instSettings.reve_api_key || sysSettings.reve_api_key || '1762419e515c6f28').trim();
        const secretKey = (instSettings.reve_secret_key || sysSettings.reve_secret_key || '').trim();
        const senderId = (
          finalType === 'masking'
            ? (instSettings.reve_client_id || sysSettings.reve_client_id || sysSettings.reve_caller_id || '')
            : (instSettings.reve_non_masking_id || sysSettings.reve_non_masking_id || sysSettings.reve_caller_id || instSettings.reve_client_id || sysSettings.reve_client_id || '')
        ).trim();

        for (const item of messages) {
          let normPhone = item.recipient.replace(/\D/g, '');
          if (normPhone.startsWith('01') && normPhone.length === 11) {
            normPhone = `88${normPhone}`;
          } else if (normPhone.startsWith('1') && normPhone.length === 10) {
            normPhone = `880${normPhone}`;
          }
          const url = `https://smpp.revesms.com:7790/sendtext?apikey=${encodeURIComponent(apiKey)}&secretkey=${encodeURIComponent(secretKey)}&callerID=${encodeURIComponent(senderId)}&toUser=${encodeURIComponent(normPhone)}&messageContent=${encodeURIComponent(item.text)}&type=3`;

          try {
            const getResult = await httpsGet(url, agent);
            const resText = getResult.text.trim();

            const isNumericId = /^\d+$/.test(resText);
            const isSuccess = getResult.ok && (
              isNumericId || 
              resText.toLowerCase().includes('success') || 
              resText.startsWith('1001') ||
              resText.toUpperCase().includes('ACCEPTD') ||
              resText.toUpperCase().includes('ACCEPTED') ||
              resText.includes('"Status":"0"') ||
              resText.includes('"Status": "0"') ||
              resText.includes('"Status":0') ||
              resText.includes('Message_ID') ||
              resText.toLowerCase().includes('submitted')
            );

            // Extract message ID if JSON
            let msgId = resText;
            try {
              const j = JSON.parse(resText);
              if (j.Message_ID || j.message_id || j.MessageId) {
                msgId = String(j.Message_ID || j.message_id || j.MessageId);
              }
            } catch (pE) {
              // Plain text
            }

            results.push({
              success: isSuccess,
              provider: 'reve',
              recipient: item.recipient,
              providerMessageId: isSuccess ? msgId : undefined,
              errorCode: !isSuccess ? resText : undefined,
              errorMessage: !isSuccess ? `REVE Error: ${resText}` : undefined
            });
          } catch (err: any) {
            results.push({
              success: false,
              provider: 'reve',
              recipient: item.recipient,
              errorMessage: err.message || 'Network request failed'
            });
          }
        }
      } else if (selectedProvider === 'automas') {
        const apiKey = (instSettings.automas_api_key || sysSettings.automas_api_key || '').trim();
        const rawSenderId = (
          finalType === 'non_masking'
            ? (instSettings.automas_non_masking_sender_id || sysSettings.automas_non_masking_sender_id || instSettings.automas_masking_sender_id || sysSettings.automas_masking_sender_id || '')
            : (instSettings.automas_masking_sender_id || sysSettings.automas_masking_sender_id || instSettings.automas_non_masking_sender_id || sysSettings.automas_non_masking_sender_id || '')
        ).trim();

        if (!apiKey || !rawSenderId) {
          const missingFields = [];
          if (!apiKey) missingFields.push('API Key');
          if (!rawSenderId) missingFields.push(`Sender ID for ${finalType === 'non_masking' ? 'Non-Masking' : 'Masking'}`);
          
          return res.status(400).json({
            success: false,
            error: `Automas SMS configuration incomplete: Missing ${missingFields.join(' & ')}. Please configure in Super Admin → SMS Settings.`
          });
        }

        // Clean senderId (remove dashes, spaces e.g. "09617-640326" -> "09617640326")
        const cleanSenderId = rawSenderId.replace(/[\s-]/g, '');
        const senderCandidates: string[] = [];
        if (cleanSenderId) {
          senderCandidates.push(cleanSenderId);
          if (cleanSenderId.startsWith('0') && cleanSenderId.length === 11) {
            senderCandidates.push(`88${cleanSenderId}`);
          } else if (cleanSenderId.startsWith('880') && cleanSenderId.length === 13) {
            senderCandidates.push(cleanSenderId.slice(2));
          }
        }
        if (!senderCandidates.includes(rawSenderId)) {
          senderCandidates.push(rawSenderId);
        }

        const AUTOMAS_ERROR_MAP: Record<number | string, string> = {
          0: 'Success',
          101: 'বার্তা অনেক লম্বা (Invalid Message Length)',
          102: 'Sender ID অনুমোদিত নয় (Invalid / Unapproved Sender ID)',
          103: 'Automas Authentication পয়েন্টে ত্রুটি',
          104: 'ব্যবহারকারী অকার্যকর (Invalid User)',
          105: 'মোবাইল নম্বরটি সঠিক নয় (Invalid MSISDN)',
          106: 'Automas API Key সঠিক নয় (Incorrect API Key)',
          107: 'Automas অ্যাকাউন্ট সাময়িকভাবে স্থগিত',
          108: 'IP Address Not Allowed',
          109: 'API Access Not Allowed',
          110: 'গ্রাহকের সিমে DND সার্ভিস অন করা আছে (Do Not Disturb)',
          111: 'বার্তায় নিষিদ্ধ শব্দ (Spam Word) পাওয়া গেছে',
          1000: 'Automas গেটওয়েতে পর্যাপ্ত এসএমএস ব্যালেন্স নেই (Insufficient Balance)',
          2300: 'Destination Route Issue',
          2400: 'Destination Route Not Permitted',
          3300: 'Automas সিস্টেম ত্রুটি',
          2000: 'মোবাইল অপারেটর সার্ভিস আপাতত বন্ধ',
          3000: 'মোবাইল অপারেটর সার্ভিস আপাতত বন্ধ',
          4000: 'মোবাইল অপারেটর সার্ভিস আপাতত বন্ধ'
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
            } else if (parsedJson.error_message) {
              errorMsg = parsedJson.error_message;
            } else if (parsedJson.success_message) {
              isSuccess = true;
              msgId = String(Date.now());
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

        for (const item of messages) {
          let normPhone = item.recipient.replace(/\D/g, '');
          if (normPhone.length === 10 && normPhone.startsWith('1')) {
            normPhone = `0${normPhone}`;
          }

          const phone11 = normPhone.startsWith('880') && normPhone.length === 13 ? normPhone.slice(2) : normPhone;
          const phone13 = normPhone.startsWith('01') && normPhone.length === 11 ? `88${normPhone}` : normPhone;

          const isUnicode = /[^\x00-\x7F]/.test(item.text);

          let isSuccess = false;
          let msgId: string | undefined = undefined;
          let errorMsg: string | undefined = undefined;

          // Try each sender ID candidate until success
          for (const currentSenderId of senderCandidates) {
            if (isSuccess) break;

            const phoneCandidates = [phone11, phone13];

            for (const currentPhone of phoneCandidates) {
              if (isSuccess) break;

              // Attempt 1: Standard Single SMS JSON POST
              try {
                const payload: any = {
                  api_key: apiKey,
                  senderid: currentSenderId,
                  type: isUnicode ? 'unicode' : 'text',
                  scheduledDateTime: '',
                  msg: item.text,
                  contacts: currentPhone
                };

                if (isUnicode) {
                  payload.smsformat = 8;
                }

                const response = await fetch('https://api.automas.com.bd/smsapiv3', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });

                const resText = await response.text();
                let parsedJson: any = null;
                try { parsedJson = JSON.parse(resText); } catch (pE) {}

                const parsed = parseAutomasResponse(parsedJson, resText);
                if (parsed.isSuccess) {
                  isSuccess = true;
                  msgId = parsed.msgId;
                  errorMsg = undefined;
                  break;
                } else if (parsed.errorMsg) {
                  errorMsg = parsed.errorMsg;
                }
              } catch (postErr: any) {
                errorMsg = postErr.message;
              }

              // Attempt 2: Dynamic SMS JSON POST
              if (!isSuccess) {
                try {
                  const dynamicPayload = {
                    apikey: apiKey,
                    sender: currentSenderId,
                    messages: [
                      {
                        id: 1,
                        msisdn: currentPhone,
                        smstext: item.text
                      }
                    ]
                  };

                  const response = await fetch('https://api.automas.com.bd/smsapiv3', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dynamicPayload)
                  });

                  const resText = await response.text();
                  let parsedJson: any = null;
                  try { parsedJson = JSON.parse(resText); } catch (pE) {}

                  const parsed = parseAutomasResponse(parsedJson, resText);
                  if (parsed.isSuccess) {
                    isSuccess = true;
                    msgId = parsed.msgId;
                    errorMsg = undefined;
                    break;
                  } else if (parsed.errorMsg) {
                    errorMsg = parsed.errorMsg;
                  }
                } catch (dynErr: any) {
                  // Dynamic attempt error
                }
              }

              // Attempt 3: HTTP GET Fallback
              if (!isSuccess) {
                try {
                  const getUrl = `https://api.automas.com.bd/smsapiv3?apikey=${encodeURIComponent(apiKey)}&sender=${encodeURIComponent(currentSenderId)}&msisdn=${encodeURIComponent(currentPhone)}&smstext=${encodeURIComponent(item.text)}${isUnicode ? '&type=unicode&smsformat=8' : '&type=text'}`;
                  const getRes = await fetch(getUrl, { method: 'GET' });
                  const getResText = await getRes.text();
                  let getJson: any = null;
                  try { getJson = JSON.parse(getResText); } catch (e) {}

                  const parsed = parseAutomasResponse(getJson, getResText);
                  if (parsed.isSuccess) {
                    isSuccess = true;
                    msgId = parsed.msgId;
                    errorMsg = undefined;
                    break;
                  } else if (parsed.errorMsg) {
                    errorMsg = parsed.errorMsg;
                  }
                } catch (getErr) {
                  // Fallback fetch failed
                }
              }
            }
          }

          if (!isSuccess && !errorMsg) {
            errorMsg = 'Automas SMS sending failed';
          }

          results.push({
            success: isSuccess,
            provider: 'automas',
            recipient: item.recipient,
            providerMessageId: msgId,
            errorMessage: !isSuccess ? errorMsg : undefined
          });
        }
      }

      return res.status(200).json({
        success: true,
        provider: selectedProvider,
        smsType: finalType,
        results
      });
    }

    // 2. Legacy requests support (apiUrls / apiUrl)
    if (apiUrls && Array.isArray(apiUrls)) {
      const results = await Promise.allSettled(apiUrls.map(async (url) => {
        const response = await fetch(url, { method: 'GET' });
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

    const response = await fetch(apiUrl, { method: 'GET' });
    const text = await response.text();

    return res.status(200).json({ success: true, response: text });
  } catch (error: any) {
    console.error('SMS Proxy Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
