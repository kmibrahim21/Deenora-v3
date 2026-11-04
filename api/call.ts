import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// In-memory token cache fallback if table is not yet migrated in Supabase
const memoryTokens: Record<string, { token: string; updatedAt: number }> = {};

// In-memory active call payload cache for killed-state notification taps
const activeCallPayloads: Record<string, { payload: any; updatedAt: number }> = {};

// In-memory active call signals buffer for reliable fallback signaling
const activeCallSignals: Record<string, Array<{ event: string; payload: any; timestamp: number }>> = {};

// OAuth2 cached token for Firebase V1 HTTP API
let cachedAccessToken: { token: string; expiresAt: number; projectId: string } | null = null;

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

// FIX 2026-10-13: normalize private key pasted into Vercel env vars.
// Handles: literal \n, double-escaped \\n, real newlines, surrounding quotes, \r.
function normalizePrivateKey(k: string): string {
  let key = (k || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '');
  return key;
}

function parseServiceAccount(): FirebaseServiceAccount | null {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      let trimmed = typeof raw === 'string' ? raw.trim() : '';
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        trimmed = trimmed.slice(1, -1).replace(/\\"/g, '"');
      }
      const parsed = trimmed.startsWith('{')
        ? JSON.parse(trimmed)
        : JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
      if (parsed.client_email && parsed.private_key && parsed.project_id) {
        return {
          project_id: parsed.project_id,
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    }
  } catch (e) {
    console.warn('[Call API] Error parsing FIREBASE_SERVICE_ACCOUNT:', e);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: normalizePrivateKey(privateKey),
    };
  }

  return null;
}

async function getFirebaseV1AccessToken(serviceAccount: FirebaseServiceAccount): Promise<string | null> {
  try {
    if (cachedAccessToken && cachedAccessToken.projectId === serviceAccount.project_id && Date.now() < cachedAccessToken.expiresAt - 60000) {
      return cachedAccessToken.token;
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp,
      iat,
    };

    const cleanPrivateKey = normalizePrivateKey(serviceAccount.private_key);
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(cleanPrivateKey, 'base64url');
    const jwt = `${signatureInput}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[Call API] OAuth token fetch error:', err);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      cachedAccessToken = {
        token: data.access_token,
        projectId: serviceAccount.project_id,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };
      return data.access_token;
    }
    return null;
  } catch (e) {
    console.error('[Call API] Error generating Firebase v1 token:', e);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';
  const serviceAccount = parseServiceAccount();

  if (serviceAccount) {
    const pk = serviceAccount.private_key;
    console.log('[Call API] private key shape:', {
      len: pk.length,
      hasBegin: pk.includes('BEGIN PRIVATE KEY'),
      hasEnd: pk.includes('END PRIVATE KEY'),
      newlines: (pk.match(/\n/g) || []).length,
    });
  }

  const action = req.query.action || req.body?.action;

  // Helper: Find target FCM tokens by callee_phone, student_id, or user_id
  async function findTargetFcmTokens(
    calleePhone?: string | null | undefined,
    studentId?: string | null | undefined,
    userId?: string | null | undefined
  ): Promise<string[]> {
    const rawPhone = calleePhone ? String(calleePhone).trim() : '';
    const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '').slice(-10) : '';
    const cleanUserId = userId ? String(userId).trim() : '';
    const foundTokens = new Set<string>();

    if (cleanPhone && memoryTokens[`phone_${cleanPhone}`]) {
      foundTokens.add(memoryTokens[`phone_${cleanPhone}`].token);
    }
    if (studentId && memoryTokens[`student_${studentId}`]) {
      foundTokens.add(memoryTokens[`student_${studentId}`].token);
    }
    if (cleanUserId && memoryTokens[`user_${cleanUserId}`]) {
      foundTokens.add(memoryTokens[`user_${cleanUserId}`].token);
    }

    if (SUPABASE_URL && SUPABASE_KEY && (cleanPhone || rawPhone || studentId || cleanUserId)) {
      try {
        const queries: string[] = [];
        if (cleanPhone) {
          queries.push(`${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token&phone=ilike.*${cleanPhone}*&order=updated_at.desc&limit=5`);
        }
        if (rawPhone && rawPhone !== cleanPhone) {
          queries.push(`${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token&phone=eq.${encodeURIComponent(rawPhone)}&order=updated_at.desc&limit=5`);
        }
        if (studentId) {
          queries.push(`${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token&student_id=eq.${encodeURIComponent(studentId)}&order=updated_at.desc&limit=5`);
        }
        if (cleanUserId) {
          queries.push(`${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token&user_id=eq.${encodeURIComponent(cleanUserId)}&order=updated_at.desc&limit=5`);
        }

        for (const qUrl of queries) {
          const tokenRes = await fetch(qUrl, {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          });
          if (tokenRes.ok) {
            const tokenList = await tokenRes.json();
            if (Array.isArray(tokenList)) {
              tokenList.forEach((t: any) => {
                if (t?.fcm_token) foundTokens.add(t.fcm_token);
              });
            }
          }
        }
      } catch (dbQErr) {
        console.warn('[Call API] Querying device_tokens notice:', dbQErr);
      }
    }

    return Array.from(foundTokens);
  }

  async function findTargetFcmToken(
    calleePhone?: string | null | undefined,
    studentId?: string | null | undefined,
    userId?: string | null | undefined
  ): Promise<string | null> {
    const tokens = await findTargetFcmTokens(calleePhone, studentId, userId);
    return tokens[0] || null;
  }

  async function resolveServiceAccount(institutionId?: string): Promise<FirebaseServiceAccount | null> {
    if (serviceAccount) return serviceAccount;
    if (institutionId && SUPABASE_URL && SUPABASE_KEY) {
      try {
        const instRes = await fetch(`${SUPABASE_URL}/rest/v1/institutions?select=config_json&id=eq.${institutionId}&limit=1`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        if (instRes.ok) {
          const instData = await instRes.json();
          const config = instData?.[0]?.config_json || {};
          if (config.firebase_service_account) {
            try {
              return typeof config.firebase_service_account === 'string'
                ? JSON.parse(config.firebase_service_account)
                : config.firebase_service_account;
            } catch {}
          }
        }
      } catch {}
    }
    return null;
  }

  // 1. REGISTER FCM DEVICE TOKEN
  if (req.method === 'POST' && action === 'register_token') {
    try {
      const { token, phone, user_id, student_id, institution_id } = req.body || {};
      if (!token) {
        return res.status(400).json({ success: false, message: 'FCM token is required' });
      }

      if (phone) {
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        memoryTokens[`phone_${cleanPhone}`] = { token, updatedAt: Date.now() };
      }
      if (student_id) {
        memoryTokens[`student_${student_id}`] = { token, updatedAt: Date.now() };
      }
      if (user_id) {
        memoryTokens[`user_${user_id}`] = { token, updatedAt: Date.now() };
      }

      let dbDebug: any = null;
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const { device_id, device_name } = req.body || {};

          if (device_id) {
            try {
              await fetch(
                `${SUPABASE_URL}/rest/v1/device_tokens?device_id=eq.${encodeURIComponent(device_id)}&fcm_token=neq.${encodeURIComponent(token)}`,
                {
                  method: 'DELETE',
                  headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                  },
                }
              );
            } catch (dedupeErr) {
              console.warn('[Call API] Deduping device_tokens notice:', dedupeErr);
            }
          }

          const upsertBody: any = {
            fcm_token: token,
            updated_at: new Date().toISOString(),
          };
          if (phone) upsertBody.phone = phone;
          if (user_id) upsertBody.user_id = user_id;
          if (student_id) upsertBody.student_id = student_id;
          if (institution_id) upsertBody.institution_id = institution_id;
          if (device_id) upsertBody.device_id = device_id;
          if (device_name) upsertBody.device_name = device_name;

          const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/device_tokens?on_conflict=fcm_token`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify(upsertBody),
          });
          const dbText = await dbRes.text().catch(() => '');
          console.log('[Call API] device_tokens upsert:', dbRes.status, dbText.slice(0, 300));
          dbDebug = { status: dbRes.status, ok: dbRes.ok, body: dbText.slice(0, 300) };

          if (phone) {
            const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
            fetch(`${SUPABASE_URL}/rest/v1/device_tokens?select=id,fcm_token&phone=ilike.*${cleanPhone}*&order=updated_at.desc`, {
              headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            }).then(r => r.json()).then(rows => {
              if (Array.isArray(rows) && rows.length > 5) {
                const idsToDelete = rows.slice(5).map((r: any) => r.id).filter(Boolean);
                if (idsToDelete.length > 0) {
                  fetch(`${SUPABASE_URL}/rest/v1/device_tokens?id=in.(${idsToDelete.join(',')})`, {
                    method: 'DELETE',
                    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
                  }).catch(() => {});
                }
              }
            }).catch(() => {});
          }
        } catch (dbErr: any) {
          console.warn('[Call API] device_tokens table save notice:', dbErr);
          dbDebug = { fetchError: String(dbErr?.message || dbErr) };
        }
      } else {
        dbDebug = { skipped: 'SUPABASE_URL or SUPABASE_KEY missing in Vercel env' };
      }

      return res.status(200).json({ success: true, message: 'FCM Token registered successfully', _dbDebug: dbDebug });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Helper: Check if the callee device has already acknowledged the call (ringing / answered / rejected / ended)
  async function hasCallBeenAcknowledged(targetCallId?: string | null): Promise<boolean> {
    const cleanId = String(targetCallId || '').trim();
    if (!cleanId) return false;

    const ackEvents = new Set([
      'call:ringing',
      'call:accept',
      'call:answer',
      'call:reject',
      'call:rejected',
      'call:end',
      'call:ended',
      'call:cancel',
      'call:busy',
    ]);

    const memList = activeCallSignals[cleanId] || [];
    if (memList.some((s) => ackEvents.has(String(s.event || '').trim()))) {
      return true;
    }

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const checkUrl = `${SUPABASE_URL}/rest/v1/call_signals?select=event&call_id=eq.${encodeURIComponent(cleanId)}&limit=20`;
        const res = await fetch(checkUrl, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.some((r: any) => ackEvents.has(String(r?.event || '').trim()))) {
            return true;
          }
        }
      } catch {}
    }

    return false;
  }

  // 2. INITIATE HIGH-PRIORITY CALL PUSH TO WAKE UP ANDROID FULLSCREEN INTENT
  if (req.method === 'POST' && (action === 'initiate_call_push' || req.body?.type === 'incoming_call')) {
    try {
      const payload = req.body?.payload || req.body || {};
      const {
        call_id,
        caller_name,
        student_name,
        student_id,
        institution_id,
        callee_phone,
      } = payload;

      const targetTokens = await findTargetFcmTokens(callee_phone, student_id);
      console.log('[Call API] initiate_call_push attempt:', JSON.stringify({
        devicesNotified: targetTokens.length,
        call_id: String(payload.call_id || ''),
      }));

      const effectiveServiceAccount = await resolveServiceAccount(institution_id);

      if (!effectiveServiceAccount) {
        return res.status(200).json({
          success: false,
          fcmSent: false,
          message: 'Firebase Service Account (HTTP v1) is not configured in environment variables or institution settings.',
        });
      }

      const callerLabel = String(caller_name || 'মাদরাসা এডমিন');
      const callerId = String(payload.caller_id || payload.caller?.id || payload.callerId || '');
      const fcmDataPayload: Record<string, string> = {
        type: 'incoming_call',
        call_id: String(call_id || ''),
        caller_name: callerLabel,
        caller_id: callerId,
        student_name: String(student_name || ''),
        student_id: String(student_id || ''),
        institution_id: String(institution_id || ''),
        callee_phone: String(callee_phone || ''),
        timestamp: String(Date.now()),
      };

      if (call_id) {
        activeCallPayloads[String(call_id)] = {
          payload: fcmDataPayload,
          updatedAt: Date.now(),
        };
      }

      if (!targetTokens.length) {
        return res.status(200).json({
          success: true,
          fcmSent: false,
          targetTokenFound: false,
          message: 'Device FCM token not registered for this phone yet. Open the app on Android once to register token.',
          payload: fcmDataPayload,
        });
      }

      const v1AccessToken = await getFirebaseV1AccessToken(effectiveServiceAccount);
      if (!v1AccessToken) {
        return res.status(500).json({
          success: false,
          message: 'Could not generate OAuth access token for Firebase HTTP v1.',
        });
      }

      // Wave 1 (0s): Pure Data-Only High-Priority Push to wake FcmService -> CallService
      const sendResults = await Promise.all(
        targetTokens.map(async (tok) => {
          try {
            const v1Response = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveServiceAccount.project_id}/messages:send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${v1AccessToken}`,
              },
              body: JSON.stringify({
                message: {
                  token: tok,
                  android: {
                    priority: 'HIGH',
                    ttl: '120s',
                    direct_boot_ok: true,
                  },
                  data: fcmDataPayload,
                  apns: {
                    payload: {
                      aps: {
                        sound: 'default',
                      },
                    },
                  },
                  webpush: {
                    headers: { Urgency: 'high' },
                    notification: {
                      title: callerLabel,
                      body: 'ইনকামিং ভয়েস কল — উত্তর দিতে ট্যাপ করুন',
                      sound: 'default',
                      tag: 'incoming-voice-call',
                    },
                    fcm_options: {
                      link: `/?fcm_tap=1&action=incoming_call&call_id=${encodeURIComponent(String(call_id || ''))}&caller_name=${encodeURIComponent(callerLabel)}`,
                    },
                  },
                },
              }),
            });
            const v1Result = await v1Response.json().catch(() => ({}));
            return { token: tok.slice(0, 10), status: v1Response.status, result: v1Result };
          } catch (e: any) {
            return { token: tok.slice(0, 10), error: e.message };
          }
        })
      );

      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const deadTokens: string[] = [];
          sendResults.forEach((resItem: any, idx: number) => {
            const rawTok = targetTokens[idx];
            if (!rawTok) return;
            const resText = JSON.stringify(resItem?.result || resItem?.error || '');
            if (
              resText.includes('UNREGISTERED') ||
              resText.includes('registration-token-not-registered') ||
              resText.includes('NOT_FOUND')
            ) {
              deadTokens.push(rawTok);
            }
          });
          if (deadTokens.length > 0) {
            Promise.all(
              deadTokens.map((deadTok: string) =>
                fetch(`${SUPABASE_URL}/rest/v1/device_tokens?fcm_token=eq.${encodeURIComponent(deadTok)}`, {
                  method: 'DELETE',
                  headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                  },
                }).catch(() => {})
              )
            ).catch(() => {});
          }
        } catch (pruneErr) {
          console.warn('[Call API] Dead token prune notice:', pruneErr);
        }
      }

      // Smart Wave 2 Auto-Escalation (3s):
      // If the app is open, minimized, or wakes up via FcmService, CallService sends 'call:ringing' within ~500ms.
      // If the user swipe-killed the app on Tecno/HiOS/MIUI (Force-Stopped), Data-Only FCM is blocked by the ROM
      // and no 'call:ringing' arrives. In that case, automatically send a system-rendered call alert notification
      // on channel 'deenora_calls_alert_v19' (which plays the phone's ringtone and opens MainActivity on tap).
      let wave2Results: any = null;
      let wave2SkippedReason: string | null = null;
      if (call_id) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const alreadyAcked = await hasCallBeenAcknowledged(String(call_id));
        if (alreadyAcked) {
          wave2SkippedReason = 'Device already acknowledged call (ringing/answered/declined)';
        } else {
          const callBodyText = student_name
            ? `ইনকামিং ভয়েস কল (${student_name}) — উত্তর দিতে ট্যাপ করুন`
            : 'ইনকামিং ভয়েস কল — উত্তর দিতে ট্যাপ করুন';
          const wave2DataPayload: Record<string, string> = {
            ...fcmDataPayload,
            CALLER_NAME: callerLabel,
            CALL_ID: String(call_id || ''),
          };
          wave2Results = await Promise.all(
            targetTokens.map(async (tok) => {
              try {
                const v2Res = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveServiceAccount.project_id}/messages:send`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${v1AccessToken}`,
                  },
                  body: JSON.stringify({
                    message: {
                      token: tok,
                      android: {
                        priority: 'HIGH',
                        ttl: '120s',
                        direct_boot_ok: true,
                        notification: {
                          channel_id: 'deenora_calls_alert_v19',
                          title: callerLabel,
                          body: callBodyText,
                          sound: 'default',
                          default_sound: true,
                          default_vibrate_timings: true,
                          click_action: 'OPEN_ACTIVITY_1',
                          tag: 'incoming-voice-call',
                          notification_priority: 'PRIORITY_MAX',
                          visibility: 'PUBLIC',
                        },
                      },
                      notification: {
                        title: callerLabel,
                        body: callBodyText,
                      },
                      data: wave2DataPayload,
                    },
                  }),
                });
                const v2Json = await v2Res.json().catch(() => ({}));
                return { token: tok.slice(0, 10), status: v2Res.status, result: v2Json };
              } catch (e: any) {
                return { token: tok.slice(0, 10), error: e.message };
              }
            })
          );
        }
      }

      return res.status(200).json({
        success: true,
        fcmSent: true,
        apiType: 'v1',
        devicesNotified: sendResults.length,
        targetTokenFound: true,
        fcmResults: sendResults,
        wave2Results,
        wave2SkippedReason,
        payload: fcmDataPayload,
      });
    } catch (err: any) {
      console.error('[Call API] FCM send error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 2b. ESCALATION PUSH — system-rendered notification for swipe-killed phones.
  if (req.method === 'POST' && action === 'escalate_call_push') {
    try {
      const payload = req.body?.payload || req.body || {};
      const {
        call_id,
        caller_name,
        student_name,
        student_id,
        institution_id,
        callee_phone,
      } = payload;

      if (call_id && (await hasCallBeenAcknowledged(String(call_id)))) {
        return res.status(200).json({
          success: true,
          fcmSent: false,
          skipped: true,
          message: 'Device already acknowledged call (ringing/answered/declined), skipping escalation push.',
        });
      }

      const targetTokens = await findTargetFcmTokens(callee_phone, student_id);
      console.log('[Call API] escalate_call_push attempt:', JSON.stringify({
        devicesNotified: targetTokens.length,
        call_id: String(payload.call_id || ''),
      }));

      const effectiveServiceAccount = await resolveServiceAccount(institution_id);
      if (!effectiveServiceAccount) {
        return res.status(200).json({
          success: false,
          fcmSent: false,
          devicesNotified: 0,
          message: 'Firebase Service Account not configured',
        });
      }
      if (!targetTokens.length) {
        return res.status(200).json({
          success: true,
          fcmSent: false,
          targetTokenFound: false,
          devicesNotified: 0,
          message: 'No device token registered for this phone yet.',
        });
      }

      const v1AccessToken = await getFirebaseV1AccessToken(effectiveServiceAccount);
      if (!v1AccessToken) {
        return res.status(500).json({
          success: false,
          message: 'Could not generate OAuth access token for Firebase HTTP v1.',
        });
      }

      const callerLabel = String(caller_name || 'মাদরাসা এডমিন');
      const callBodyText = student_name
        ? `ইনকামিং ভয়েস কল (${student_name}) — উত্তর দিতে ট্যাপ করুন`
        : 'ইনকামিং ভয়েস কল — উত্তর দিতে ট্যাপ করুন';
      const fcmDataPayload: Record<string, string> = {
        type: 'incoming_call',
        call_id: String(call_id || ''),
        caller_name: callerLabel,
        student_name: String(student_name || ''),
        student_id: String(student_id || ''),
        institution_id: String(institution_id || ''),
        callee_phone: String(callee_phone || ''),
        CALLER_NAME: callerLabel,
        CALL_ID: String(call_id || ''),
      };

      if (call_id) {
        activeCallPayloads[String(call_id)] = {
          payload: fcmDataPayload,
          updatedAt: Date.now(),
        };
      }

      const sendResults = await Promise.all(
        targetTokens.map(async (tok) => {
          try {
            const v1Response = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveServiceAccount.project_id}/messages:send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${v1AccessToken}`,
              },
              body: JSON.stringify({
                message: {
                  token: tok,
                  android: {
                    priority: 'HIGH',
                    ttl: '120s',
                    direct_boot_ok: true,
                    notification: {
                      channel_id: 'deenora_calls_alert_v19',
                      title: callerLabel,
                      body: callBodyText,
                      sound: 'default',
                      default_sound: true,
                      default_vibrate_timings: true,
                      click_action: 'OPEN_ACTIVITY_1',
                      tag: 'incoming-voice-call',
                      notification_priority: 'PRIORITY_MAX',
                      visibility: 'PUBLIC',
                    },
                  },
                  notification: {
                    title: callerLabel,
                    body: callBodyText,
                  },
                  data: fcmDataPayload,
                  apns: {
                    payload: {
                      aps: {
                        sound: 'default',
                      },
                    },
                  },
                  webpush: {
                    headers: { Urgency: 'high' },
                    notification: {
                      title: callerLabel,
                      body: callBodyText,
                      sound: 'default',
                      tag: 'incoming-voice-call',
                    },
                    fcm_options: {
                      link: `/?fcm_tap=1&action=incoming_call&call_id=${encodeURIComponent(String(call_id || ''))}&caller_name=${encodeURIComponent(callerLabel)}`,
                    },
                  },
                },
              }),
            });
            const v1Result = await v1Response.json().catch(() => ({}));
            return { token: tok.slice(0, 10), status: v1Response.status, result: v1Result };
          } catch (e: any) {
            return { token: tok.slice(0, 10), error: e.message };
          }
        })
      );

      return res.status(200).json({
        success: true,
        fcmSent: true,
        apiType: 'v1-escalation',
        devicesNotified: sendResults.length,
        targetTokenFound: true,
        fcmResults: sendResults,
        payload: fcmDataPayload,
      });
    } catch (err: any) {
      console.error('[Call API] escalate_call_push error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3. CANCEL CALL PUSH TO DISMISS ANDROID INCOMING CALL UI AND STOP RINGING
  if (req.method === 'POST' && action === 'cancel_call_push') {
    try {
      const payload = req.body?.payload || req.body || {};
      const {
        call_id,
        callee_phone,
        student_id,
        institution_id,
      } = payload;

      const effectiveServiceAccount = await resolveServiceAccount(institution_id);
      if (!effectiveServiceAccount) {
        return res.status(200).json({
          success: false,
          fcmSent: false,
          message: 'Firebase Service Account not configured',
        });
      }

      const targetTokens = await findTargetFcmTokens(callee_phone, student_id);
      if (!targetTokens.length) {
        return res.status(200).json({
          success: true,
          fcmSent: false,
          message: 'No target tokens found for cancellation',
        });
      }

      const v1AccessToken = await getFirebaseV1AccessToken(effectiveServiceAccount);
      if (!v1AccessToken) {
        return res.status(500).json({
          success: false,
          message: 'Could not generate Firebase access token',
        });
      }

      const cancelPayload: Record<string, string> = {
        type: 'call_cancel',
        call_id: String(call_id || ''),
      };

      const sendResults = await Promise.all(
        targetTokens.map(async (tok) => {
          try {
            const v1Response = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveServiceAccount.project_id}/messages:send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${v1AccessToken}`,
              },
              body: JSON.stringify({
                message: {
                  token: tok,
                  android: { priority: 'HIGH', ttl: '30s' },
                  data: cancelPayload,
                },
              }),
            });
            const v1Result = await v1Response.json().catch(() => ({}));
            return { token: tok.slice(0, 10), status: v1Response.status, result: v1Result };
          } catch (e: any) {
            return { token: tok.slice(0, 10), error: e.message };
          }
        })
      );

      return res.status(200).json({
        success: true,
        fcmSent: true,
        devicesNotified: sendResults.length,
        cancelResults: sendResults,
      });
    } catch (err: any) {
      console.error('[Call API] cancel_call_push error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3b. RELAY CALL SIGNAL (PERSISTENT SUPABASE CALL_SIGNALS + HIGH-PRIORITY FCM BACKEND RELAY)
  if (req.method === 'POST' && action === 'relay_call_signal') {
    try {
      const event = String(req.body?.event || req.body?.type || '').trim();
      const call_id = String(req.body?.call_id || req.body?.payload?.callId || '').trim();
      const payload = req.body?.payload || {};

      const callerId = String(
        req.body?.caller_id ||
        req.body?.callerId ||
        payload?.callerId ||
        payload?.caller?.id ||
        payload?.caller_id ||
        ''
      ).trim();

      const institutionId = String(
        req.body?.institution_id ||
        req.body?.institutionId ||
        payload?.institutionId ||
        payload?.institution_id ||
        payload?.caller?.institution_id ||
        ''
      ).trim();

      const calleePhone = String(
        req.body?.callee_phone ||
        req.body?.calleePhone ||
        payload?.calleePhone ||
        payload?.callee_phone ||
        payload?.student?.guardian_phone ||
        ''
      ).trim();

      const studentId = String(
        req.body?.student_id ||
        req.body?.studentId ||
        payload?.studentId ||
        payload?.student_id ||
        payload?.student?.id ||
        ''
      ).trim();

      const senderId = String(
        req.body?.sender_id ||
        payload?.senderId ||
        payload?.rejectedBy ||
        ''
      ).trim();

      console.log(`[Call API] relay_call_signal: event="${event}", call_id="${call_id}", callerId="${callerId}", institutionId="${institutionId}"`);

      if (call_id && SUPABASE_URL && SUPABASE_KEY) {
        try {
          const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/call_signals`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              call_id,
              event,
              payload: typeof payload === 'string' ? JSON.parse(payload) : (payload || {}),
              consumed: false,
              created_at: new Date().toISOString(),
            }),
          });
          if (!insertRes.ok) {
            const errBody = await insertRes.text().catch(() => '');
            console.warn('[Call API] call_signals INSERT warning:', insertRes.status, errBody);
          }
        } catch (dbErr) {
          console.warn('[Call API] call_signals DB error:', dbErr);
        }
      }

      if (call_id) {
        if (!activeCallSignals[call_id]) {
          activeCallSignals[call_id] = [];
        }
        activeCallSignals[call_id].push({
          event,
          payload,
          timestamp: Date.now(),
        });
        if (activeCallSignals[call_id].length > 20) {
          activeCallSignals[call_id].shift();
        }
      }

      const effectiveServiceAccount = await resolveServiceAccount(institutionId);
      if (!effectiveServiceAccount) {
        return res.status(200).json({
          success: false,
          fcmSent: false,
          message: 'Firebase Service Account not configured',
        });
      }

      let targetTokens: string[] = [];
      const isFromCallee =
        event === 'call:accept' ||
        event === 'call:answer' ||
        event === 'call:reject' ||
        event === 'call:rejected' ||
        event === 'call:busy' ||
        event === 'call:ringing' ||
        (senderId && callerId && String(senderId) !== String(callerId));

      if (isFromCallee) {
        const adminTokens = new Set<string>();

        if (SUPABASE_URL && SUPABASE_KEY) {
          if (callerId) {
            try {
              const uRes = await fetch(
                `${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token&user_id=eq.${encodeURIComponent(callerId)}&order=updated_at.desc&limit=5`,
                {
                  headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                  },
                }
              );
              if (uRes.ok) {
                const uList = await uRes.json();
                if (Array.isArray(uList)) {
                  uList.forEach((t: any) => t?.fcm_token && adminTokens.add(t.fcm_token));
                }
              }
            } catch (uErr) {
              console.warn('[Call API] Admin token query by user_id error:', uErr);
            }
          }

          if (institutionId) {
            try {
              const iRes = await fetch(
                `${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token,user_id&institution_id=eq.${encodeURIComponent(institutionId)}&order=updated_at.desc&limit=10`,
                {
                  headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                  },
                }
              );
              if (iRes.ok) {
                const iList = await iRes.json();
                if (Array.isArray(iList)) {
                  iList.forEach((t: any) => {
                    if (t?.fcm_token) {
                      if (!callerId || t.user_id === callerId || adminTokens.size === 0) {
                        adminTokens.add(t.fcm_token);
                      }
                    }
                  });
                }
              }
            } catch (iErr) {
              console.warn('[Call API] Admin token query by institution_id error:', iErr);
            }
          }
        }

        if (adminTokens.size === 0 && callerId && memoryTokens[`user_${callerId}`]) {
          adminTokens.add(memoryTokens[`user_${callerId}`].token);
        }

        targetTokens = Array.from(adminTokens);
      } else {
        targetTokens = await findTargetFcmTokens(calleePhone, studentId);
      }

      if (!targetTokens.length) {
        const callerTokens = await findTargetFcmTokens(null, null, callerId);
        const calleeTokens = await findTargetFcmTokens(calleePhone, studentId);
        targetTokens = Array.from(new Set([...callerTokens, ...calleeTokens]));
      }

      if (!targetTokens.length) {
        return res.status(200).json({
          success: true,
          fcmSent: false,
          devicesNotified: 0,
          message: 'No recipient device tokens found for signal relay',
        });
      }

      const v1AccessToken = await getFirebaseV1AccessToken(effectiveServiceAccount);
      if (!v1AccessToken) {
        return res.status(500).json({
          success: false,
          message: 'Could not generate OAuth access token for Firebase HTTP v1.',
        });
      }

      const fcmDataPayload: Record<string, string> = {
        type: 'call_signal',
        event: event,
        call_id: String(call_id || ''),
        sender_id: String(senderId || ''),
        timestamp: String(Date.now()),
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
      };

      if (payload?.reason) fcmDataPayload.reason = String(payload.reason);
      if (payload?.answer?.sdp) fcmDataPayload.answer_sdp = String(payload.answer.sdp);
      if (payload?.answer?.type) fcmDataPayload.answer_type = String(payload.answer.type);
      if (payload?.candidate) {
        fcmDataPayload.candidate = typeof payload.candidate === 'string' ? payload.candidate : JSON.stringify(payload.candidate);
      }

      const sendResults = await Promise.all(
        targetTokens.map(async (tok) => {
          try {
            const v1Response = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveServiceAccount.project_id}/messages:send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${v1AccessToken}`,
              },
              body: JSON.stringify({
                message: {
                  token: tok,
                  android: {
                    priority: 'HIGH',
                    ttl: '30s',
                  },
                  data: fcmDataPayload,
                },
              }),
            });
            const v1Result = await v1Response.json().catch(() => ({}));
            return { token: tok.slice(0, 10), status: v1Response.status, result: v1Result };
          } catch (e: any) {
            return { token: tok.slice(0, 10), error: e.message };
          }
        })
      );

      return res.status(200).json({
        success: true,
        fcmSent: true,
        devicesNotified: sendResults.length,
        results: sendResults,
      });
    } catch (err: any) {
      console.error('[Call API] relay_call_signal error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 4. SEND GENERIC PUSH NOTIFICATION
  if (req.method === 'POST' && action === 'send_notification_push') {
    try {
      const { institution_id, title, body, target, conversation_id, class_name, sender_id } = req.body || {};
      if (!institution_id) {
        return res.status(400).json({ success: false, message: 'institution_id is required' });
      }
      if (!title && !body) {
        return res.status(400).json({ success: false, message: 'title or body is required' });
      }
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, message: 'Server configuration error' });
      }
      if (!serviceAccount) {
        return res.status(500).json({ success: false, message: 'Firebase service account not configured' });
      }

      const sbGet = async (path: string): Promise<any[]> => {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: { apikey: SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          });
          if (!r.ok) return [];
          const j = await r.json();
          return Array.isArray(j) ? j : [];
        } catch { return []; }
      };

      const normPhone = (p: any) => String(p || '').replace(/\D/g, '').slice(-10);
      const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

      const studentsToPhones = async (ids: string[]) => {
        const clean = (ids || []).filter(isUuid);
        if (!clean.length) return [];
        const rows = await sbGet(`students?select=guardian_phone&id=in.(${clean.join(',')})&is_active=eq.true&limit=2000`);
        return rows.map(r => r.guardian_phone).filter(Boolean);
      };

      const classToPhones = async (nameOrId: string) => {
        let classIds: string[] = [];
        if (isUuid(nameOrId)) {
          classIds = [nameOrId];
        } else {
          const cls = await sbGet(`classes?select=id&institution_id=eq.${institution_id}&class_name=ilike.${encodeURIComponent(String(nameOrId))}&limit=10`);
          classIds = (cls || []).map((c: any) => c.id).filter(isUuid);
        }
        if (!classIds.length) return [];
        const rows = await sbGet(`students?select=guardian_phone&institution_id=eq.${institution_id}&class_id=in.(${classIds.join(',')})&is_active=eq.true&limit=3000`);
        return rows.map(r => r.guardian_phone).filter(Boolean);
      };

      const allPhones = async () => {
        const rows = await sbGet(`students?select=guardian_phone&institution_id=eq.${institution_id}&is_active=eq.true&limit=5000`);
        return rows.map(r => r.guardian_phone).filter(Boolean);
      };

      const isAllTarget = (n: any) => ['all', 'app_notice', 'app_holiday', 'app_ptm', 'app_event'].includes(String(n || '').toLowerCase());
      const classFromAppKey = (n: any) => {
        const m = String(n || '').match(/^app_(syllabus|suggestion|routine)_(.+)$/i);
        return m ? m[2] : null;
      };

      let phones: any[] = [];
      if (target?.type === 'students' && Array.isArray(target.student_ids)) {
        phones = await studentsToPhones(target.student_ids);
      } else if (target?.type === 'phones' && Array.isArray(target.phones)) {
        phones = target.phones;
      } else if (target?.type === 'class' && target.class_name) {
        phones = await classToPhones(target.class_name);
      } else if (target?.type === 'all') {
        phones = await allPhones();
      } else if (conversation_id) {
        const conv = String(conversation_id);
        const gm = conv.match(/class-group-(.+)/i);
        if (gm) {
          phones = await classToPhones(gm[1]);
        } else if (/^(general|general-chat|announcement)/i.test(conv)) {
          phones = await allPhones();
        } else {
          const byId = await studentsToPhones([conv]);
          phones = byId.length ? byId : [conv];
        }
      } else if (class_name) {
        const ck = classFromAppKey(class_name);
        if (isAllTarget(class_name)) phones = await allPhones();
        else if (ck) phones = await classToPhones(ck);
        else phones = await classToPhones(class_name);
      }

      const phoneSet = new Set(phones.map(normPhone).filter((p: string) => p.length >= 10));
      if (sender_id) phoneSet.delete(normPhone(sender_id));
      const uniquePhones = [...phoneSet];
      if (!uniquePhones.length) {
        return res.status(200).json({ success: true, sent: 0, message: 'No recipient phones resolved' });
      }

      const tokens = await sbGet(`device_tokens?select=fcm_token,phone&order=updated_at.desc&limit=10000`);
      const phoneToToken = new Map<string, string>();
      for (const t of tokens || []) {
        const p = normPhone(t.phone);
        if (p && t.fcm_token && !phoneToToken.has(p)) phoneToToken.set(p, t.fcm_token);
      }
      const finalTokens = [...new Set(uniquePhones.map(p => phoneToToken.get(p)).filter(Boolean) as string[])];
      if (!finalTokens.length) {
        return res.status(200).json({ success: true, sent: 0, matched: 0, message: 'No registered device tokens for recipients yet (parents need to open the Android app once)' });
      }

      const accessToken = await getFirebaseV1AccessToken(serviceAccount);
      if (!accessToken) {
        return res.status(500).json({ success: false, message: 'Could not get Firebase access token' });
      }

      const data = { title: String(title || 'Deenora'), body: String(body || ''), type: 'notification' };
      const results = await Promise.all(finalTokens.map(async (tok) => {
        try {
          const r = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({
              message: {
                token: tok,
                android: { priority: 'HIGH', ttl: '3600s' },
                data,
              },
            }),
          });
          const b = await r.text().catch(() => '');
          return { ok: r.ok, status: r.status, tokenPrefix: tok.slice(0, 16), fcmBody: b.slice(0, 250) };
        } catch (e: any) {
          return { ok: false, status: 0, tokenPrefix: tok.slice(0, 16), fcmBody: String(e?.message || e).slice(0, 250) };
        }
      }));
      const sent = results.filter(r => r.ok).length;
      return res.status(200).json({ success: true, sent, matched: finalTokens.length, _debug: results });
    } catch (err: any) {
      console.error('[Call API] send_notification_push error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 5. GET CALL PAYLOAD FOR KILLED-STATE NOTIFICATION TAP
  if (action === 'get_call_payload' || (req.query && req.query.action === 'get_call_payload')) {
    const targetCallId = String(req.body?.call_id || req.query?.call_id || '').trim();
    if (targetCallId && activeCallPayloads[targetCallId]) {
      return res.status(200).json({
        success: true,
        payload: activeCallPayloads[targetCallId].payload,
      });
    }
    return res.status(200).json({
      success: false,
      message: 'Call payload not found in cache',
    });
  }

  // 5b. GET RELAYED CALL SIGNALS (SUPABASE CALL_SIGNALS + HTTP POLLING FALLBACK)
  if (action === 'get_call_signals' || (req.query && req.query.action === 'get_call_signals')) {
    const targetCallId = String(req.body?.call_id || req.query?.call_id || '').trim();
    if (!targetCallId) {
      return res.status(200).json({ success: true, signals: [] });
    }

    let signals: Array<{ event: string; payload: any; timestamp: number }> = [];

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const selectUrl = `${SUPABASE_URL}/rest/v1/call_signals?select=id,event,payload,created_at&call_id=eq.${encodeURIComponent(targetCallId)}&consumed=eq.false&order=created_at.asc`;
        const selectRes = await fetch(selectUrl, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        });

        if (selectRes.ok) {
          const rows = await selectRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            signals = rows.map((r: any) => ({
              event: r.event,
              payload: r.payload,
              timestamp: new Date(r.created_at).getTime(),
            }));

            const signalIds = rows.map((r: any) => r.id).filter(Boolean);
            if (signalIds.length > 0) {
              fetch(`${SUPABASE_URL}/rest/v1/call_signals?id=in.(${signalIds.join(',')})`, {
                method: 'PATCH',
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ consumed: true }),
              }).catch((patchErr) => {
                console.warn('[Call API] Mark consumed error:', patchErr);
              });
            }
          }
        }
      } catch (dbErr) {
        console.warn('[Call API] get_call_signals DB error:', dbErr);
      }

      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        fetch(`${SUPABASE_URL}/rest/v1/call_signals?created_at=lt.${encodeURIComponent(fiveMinutesAgo)}`, {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }).catch(() => {});
      } catch {}
    }

    const memSignals = activeCallSignals[targetCallId] || [];
    if (signals.length === 0 && memSignals.length > 0) {
      signals = memSignals;
    }

    return res.status(200).json({
      success: true,
      signals,
    });
  }

  // 6. GET CALL CONFIG & HEALTH
  if (req.method === 'GET') {
    if (req.query && req.query.action === 'get_call_payload') {
      const targetCallId = String(req.query?.call_id || '').trim();
      if (targetCallId && activeCallPayloads[targetCallId]) {
        return res.status(200).json({
          success: true,
          payload: activeCallPayloads[targetCallId].payload,
        });
      }
      return res.status(200).json({
        success: false,
        message: 'Call payload not found in cache',
      });
    }

    return res.status(200).json({
      status: 'active',
      hasFirebaseServiceAccount: Boolean(serviceAccount),
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasSupabaseKey: Boolean(SUPABASE_KEY),
      cachedTokensCount: Object.keys(memoryTokens).length,
      timestamp: Date.now(),
    });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}