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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';
  const serviceAccount = parseServiceAccount();

  // FIX 2026-10-13: log key SHAPE only (never the key itself) to diagnose paste issues
  // if (serviceAccount) {
  //   const pk = serviceAccount.private_key;
  //   console.log('[Call API] private key shape:', {
  //     len: pk.length,
  //     hasBegin: pk.includes('BEGIN PRIVATE KEY'),
  //     hasEnd: pk.includes('END PRIVATE KEY'),
  //     newlines: (pk.match(/\n/g) || []).length,
  //   });
  // }

  const action = req.query.action || req.body?.action;

  // Helper: Find target FCM tokens by callee_phone, student_id, or user_id (memory cache + Supabase device_tokens for multi-device support)
  async function findTargetFcmTokens(
    calleePhone?: string | null | undefined,
    studentId?: string | null | undefined,
    userId?: string | null | undefined
  ): Promise<string[]> {
    const rawPhone = calleePhone ? String(calleePhone).trim() : '';
    const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '').slice(-10) : '';
    const cleanUserId = userId ? String(userId).trim() : '';
    const foundTokens = new Set<string>();

    // 1. Check in-memory token cache
    if (cleanPhone && memoryTokens[`phone_${cleanPhone}`]) {
      foundTokens.add(memoryTokens[`phone_${cleanPhone}`].token);
    }
    if (studentId && memoryTokens[`student_${studentId}`]) {
      foundTokens.add(memoryTokens[`student_${studentId}`].token);
    }
    if (cleanUserId && memoryTokens[`user_${cleanUserId}`]) {
      foundTokens.add(memoryTokens[`user_${cleanUserId}`].token);
    }

    // 2. Query Supabase device_tokens table (returns up to 5 active devices per recipient)
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

  // Helper: Resolve caller display name (replaces generic 'user' with actual institution name)
  async function resolveCallerLabel(rawCallerName?: string | null, institutionId?: string | null): Promise<string> {
    const clean = String(rawCallerName || '').trim();
    if (clean && clean.toLowerCase() !== 'user') {
      return clean;
    }
    if (institutionId && SUPABASE_URL && SUPABASE_KEY) {
      try {
        const instRes = await fetch(
          `${SUPABASE_URL}/rest/v1/institutions?select=name&id=eq.${encodeURIComponent(String(institutionId))}&limit=1`,
          {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          }
        );
        if (instRes.ok) {
          const instData = await instRes.json();
          const instName = String(instData?.[0]?.name || '').trim();
          if (instName && instName.toLowerCase() !== 'user') {
            return instName;
          }
        }
      } catch {}
    }
    return 'মাদরাসা এডমিন';
  }

  // Helper: Resolve effective service account (env or institution settings)
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

      // Store in memory cache
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

      // Try saving to Supabase device_tokens table if available.
      let dbDebug: any = null;
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const { device_id, device_name } = req.body || {};

          // Best-effort dedupe: same device er purono token row muche felo, upsert er age
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

          // Auto-prune stale tokens if more than 5 devices registered for same phone number
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

      const isCallingAdmin = Boolean(
        student_id?.startsWith('admin') || 
        payload.target_type === 'admin' || 
        payload.callee_role === 'admin'
      );

      let targetTokens: string[] = [];
      if (isCallingAdmin && institution_id) {
        try {
          const qUrl = `${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token&institution_id=eq.${encodeURIComponent(institution_id)}&user_id=not.is.null&order=updated_at.desc&limit=10`;
          const res = await fetch(qUrl, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
          });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              list.forEach((t: any) => { if (t?.fcm_token) targetTokens.push(t.fcm_token); });
            }
          }
        } catch (e) {
          console.warn('[Call API] Admin token query notice:', e);
        }
      } else {
        targetTokens = await findTargetFcmTokens(callee_phone, student_id, payload.user_id);
      }
      targetTokens = Array.from(new Set(targetTokens));

      console.log('[Call API] initiate_call_push attempt:', JSON.stringify({
        devicesNotified: targetTokens.length,
        call_id: String(payload.call_id || ''),
        isCallingAdmin,
      }));

      // Check institution config for service account if not in env
      const effectiveServiceAccount = await resolveServiceAccount(institution_id);

      if (!effectiveServiceAccount) {
        return res.status(200).json({
          success: false,
          fcmSent: false,
          message: 'Firebase Service Account (HTTP v1) is not configured in environment variables or institution settings.',
        });
      }

      // High-Priority Data Payload expected by FcmService.kt (all values must be strings)
      const callerLabel = await resolveCallerLabel(caller_name, institution_id);
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

      // Send call push to ALL active devices for simultaneous ringing
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

      // Prune dead/unregistered tokens (best-effort, push ke fail korbe na)
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

      return res.status(200).json({
        success: true,
        fcmSent: true,
        apiType: 'v1',
        devicesNotified: sendResults.length,
        targetTokenFound: true,
        fcmResults: sendResults,
        payload: fcmDataPayload,
      });
    } catch (err: any) {
      console.error('[Call API] FCM send error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 2b. ESCALATION PUSH — system-rendered notification for swipe-killed phones.
  // Data-only FCM cannot wake the app on Tecno/HiOS after a recents-swipe, but a
  // notification payload is rendered by the system itself (verified 2026-10-05:
  // hybrid notification arrived while the app was closed). The admin client
  // fires this once if the call is not answered within ~20s. Tapping the
  // notification opens MainActivity with the data extras → fcm_tap URL →
  // requestOffer → the caller re-sends the offer → the parent answers.
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

      const isCallingAdminEscalation = Boolean(
        student_id?.startsWith('admin') || 
        payload.target_type === 'admin' || 
        payload.callee_role === 'admin'
      );

      let targetTokens: string[] = [];
      if (isCallingAdminEscalation && institution_id) {
        try {
          const qUrl = `${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token&institution_id=eq.${encodeURIComponent(institution_id)}&user_id=not.is.null&order=updated_at.desc&limit=10`;
          const res = await fetch(qUrl, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
          });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              list.forEach((t: any) => { if (t?.fcm_token) targetTokens.push(t.fcm_token); });
            }
          }
        } catch (e) {
          console.warn('[Call API] Admin token query notice:', e);
        }
      } else {
        targetTokens = await findTargetFcmTokens(callee_phone, student_id, payload.user_id);
      }
      targetTokens = Array.from(new Set(targetTokens));

      console.log('[Call API] escalate_call_push attempt:', JSON.stringify({
        devicesNotified: targetTokens.length,
        call_id: String(payload.call_id || ''),
        isCallingAdmin: isCallingAdminEscalation,
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

      const callerLabel = await resolveCallerLabel(caller_name, institution_id);
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

  // 3. TASK 4a: CANCEL CALL PUSH TO DISMISS ANDROID INCOMING CALL UI AND STOP RINGING
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

      // 1. INSERT into Supabase call_signals table (persistent across all serverless instances)
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

      // Memory fallback for instant single-instance polling
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

      // 2. Identify the target recipient(s) for the signal
      const effectiveServiceAccount = await resolveServiceAccount(institutionId);
      if (!effectiveServiceAccount) {
        return res.status(200).json({
          success: false,
          fcmSent: false,
          message: 'Firebase Service Account not configured',
        });
      }

      // Determine target devices
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
        // Send to admin caller's device(s) - lookup via caller_id and institution_id from request (not memory!)
        const adminTokens = new Set<string>();

        if (SUPABASE_URL && SUPABASE_KEY) {
          // A. Lookup tokens by caller_id (user_id in device_tokens)
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

          // B. Lookup tokens by institution_id (all admin/teacher devices for this institution)
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

        // Memory token fallback for callerId if available
        if (adminTokens.size === 0 && callerId && memoryTokens[`user_${callerId}`]) {
          adminTokens.add(memoryTokens[`user_${callerId}`].token);
        }

        targetTokens = Array.from(adminTokens);
      } else {
        // Send to callee's device(s)
        targetTokens = await findTargetFcmTokens(calleePhone, studentId);
      }

      // Fallback: If no tokens found, try finding both caller and callee tokens
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

      // Build data payload expected by Android FcmService
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

  // 4. SEND GENERIC PUSH NOTIFICATION (notice / result / diary / chat) to parent Android apps
  // Body: { institution_id, title, body, target?: {type:'class'|'all'|'students'|'phones', ...}, conversation_id?, class_name?, sender_id? }
  // Finds parent FCM tokens from device_tokens (matched by guardian phone) and sends
  // an FCM v1 DATA message {title, body}. The Android FcmService shows it as a
  // regular notification (no caller_name => not a call).
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
      const effectiveSa = await resolveServiceAccount(institution_id);
      if (!effectiveSa) {
        return res.status(200).json({ success: false, sent: 0, message: 'Firebase service account not configured' });
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
        const rows = await sbGet(`students?select=guardian_phone,guardian_phone_2&id=in.(${clean.join(',')})&limit=2000`);
        const phs: string[] = [];
        for (const r of rows || []) {
          if (r.guardian_phone) phs.push(r.guardian_phone);
          if (r.guardian_phone_2) phs.push(r.guardian_phone_2);
        }
        return phs;
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
        const rows = await sbGet(`students?select=guardian_phone,guardian_phone_2&institution_id=eq.${institution_id}&class_id=in.(${classIds.join(',')})&limit=3000`);
        const phs: string[] = [];
        for (const r of rows || []) {
          if (r.guardian_phone) phs.push(r.guardian_phone);
          if (r.guardian_phone_2) phs.push(r.guardian_phone_2);
        }
        return phs;
      };

      const allPhones = async () => {
        const rows = await sbGet(`students?select=guardian_phone,guardian_phone_2&institution_id=eq.${institution_id}&limit=5000`);
        const phs: string[] = [];
        for (const r of rows || []) {
          if (r.guardian_phone) phs.push(r.guardian_phone);
          if (r.guardian_phone_2) phs.push(r.guardian_phone_2);
        }
        return phs;
      };

      const isAllTarget = (n: any) => ['all', 'app_notice', 'app_holiday', 'app_ptm', 'app_event'].includes(String(n || '').toLowerCase());
      const classFromAppKey = (n: any) => {
        const m = String(n || '').match(/^app_(syllabus|suggestion|routine)_(.+)$/i);
        return m ? m[2] : null;
      };

      let phones: any[] = [];
      if (Array.isArray(target?.phones) && target.phones.length > 0) {
        phones.push(...target.phones);
      }
      if (target?.type === 'students' && Array.isArray(target.student_ids)) {
        const dbPhones = await studentsToPhones(target.student_ids);
        phones.push(...dbPhones);
      } else if (target?.type === 'phones' && Array.isArray(target.phones)) {
        phones.push(...target.phones);
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
          // direct conversation: student id or phone
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

      // Match phones to registered FCM tokens (check memory cache first, then query database with filter)
      const phoneToToken = new Map<string, string>();

      // 1. Instant lookup from memory cache
      for (const p of uniquePhones) {
        if (memoryTokens[`phone_${p}`]?.token) {
          phoneToToken.set(p, memoryTokens[`phone_${p}`].token);
        }
      }

      // 2. Query DB specifically for the target phones if needed
      const missingPhones = uniquePhones.filter(p => !phoneToToken.has(p));
      if (missingPhones.length > 0) {
        const filterStr = missingPhones.map(p => `phone.ilike.*${p}*`).join(',');
        const tokens = await sbGet(`device_tokens?select=fcm_token,phone,student_id&or=(${filterStr})&order=updated_at.desc&limit=1000`);
        for (const t of tokens || []) {
          const p = normPhone(t.phone);
          if (p && t.fcm_token && !phoneToToken.has(p)) {
            phoneToToken.set(p, t.fcm_token);
          }
        }
      }

      // 3. Also match device_tokens directly by student_id if provided
      const targetStudentIds = (Array.isArray(target?.student_ids) ? target.student_ids : []).filter(isUuid);
      const studentTokensSet = new Set<string>();
      if (targetStudentIds.length > 0) {
        const sTokens = await sbGet(`device_tokens?select=fcm_token,student_id&student_id=in.(${targetStudentIds.join(',')})&limit=200`);
        for (const st of sTokens || []) {
          if (st.fcm_token) studentTokensSet.add(st.fcm_token);
        }
      }

      // 4. Fallback for broadcast/unmatched tokens
      if (phoneToToken.size === 0 && studentTokensSet.size === 0) {
        const tokens = await sbGet(`device_tokens?select=fcm_token,phone&order=updated_at.desc&limit=1000`);
        for (const t of tokens || []) {
          const p = normPhone(t.phone);
          if (p && t.fcm_token && !phoneToToken.has(p)) {
            phoneToToken.set(p, t.fcm_token);
          }
        }
      }

      const finalTokens = [
        ...new Set([
          ...uniquePhones.map(p => phoneToToken.get(p)).filter(Boolean),
          ...Array.from(studentTokensSet),
        ])
      ] as string[];
      if (!finalTokens.length) {
        return res.status(200).json({ success: true, sent: 0, matched: 0, message: 'No registered device tokens for recipients yet (parents need to open the Android app once)' });
      }

      const accessToken = await getFirebaseV1AccessToken(effectiveSa);
      if (!accessToken) {
        return res.status(500).json({ success: false, message: 'Could not get Firebase access token' });
      }

      const cleanTitle = String(title || 'Deenora').trim();
      const cleanBody = String(body || '').trim();
      const notifType = String(req.body?.type || 'notification');
      const data = { 
        title: cleanTitle, 
        body: cleanBody, 
        type: 'app_notification',
        notif_type: notifType,
        is_call: 'false',
        caller_name: '',
        call_id: '',
        click_action: '/parent-portal'
      };

      const results = await Promise.all(finalTokens.map(async (tok) => {
        try {
          const r = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveSa.project_id}/messages:send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({
              message: {
                token: tok,
                android: { 
                  priority: 'HIGH', 
                  ttl: '3600s',
                  notification: {
                    title: cleanTitle,
                    body: cleanBody,
                    sound: 'default',
                    channel_id: 'deenora_general_alerts',
                    notification_priority: 'PRIORITY_HIGH',
                    default_sound: true,
                    default_vibrate_timings: true
                  }
                },
                notification: {
                  title: cleanTitle,
                  body: cleanBody,
                },
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

  // 4b. ZERO-COST INTERNET VOICE CALL BROADCAST
  if (req.method === 'POST' && action === 'broadcast_internet_voice_call') {
    try {
      const {
        institution_id,
        voice_template_id,
        target_phones,
        student_ids,
        class_id,
        title,
        body,
      } = req.body || {};

      const isUuid = (s: any) =>
        typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

      if (!institution_id || !isUuid(institution_id)) {
        return res.status(400).json({ success: false, error: 'Valid institution_id is required' });
      }
      if (!voice_template_id || !isUuid(voice_template_id)) {
        return res.status(400).json({ success: false, error: 'Valid voice_template_id is required' });
      }
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, error: 'Server configuration error' });
      }

      // 1. Verify caller authentication & tenant authorization
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
      }
      const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!bearerToken || bearerToken === 'undefined' || bearerToken === 'null') {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
      }

      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearerToken}` },
      });
      if (!userRes.ok) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
      }
      const authUser = await userRes.json();
      const userId = authUser?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
      }

      const sbHeaders = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      };

      const sbGet = async (path: string): Promise<any[]> => {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
          if (!r.ok) return [];
          const j = await r.json();
          return Array.isArray(j) ? j : [];
        } catch {
          return [];
        }
      };

      const profiles = await sbGet(`profiles?select=id,institution_id,role&id=eq.${encodeURIComponent(userId)}&limit=1`);
      const callerProfile = profiles[0];
      if (!callerProfile) {
        return res.status(403).json({ success: false, error: 'Forbidden: Profile not found' });
      }

      const isSuperAdmin = callerProfile.role === 'super_admin' || callerProfile.role === 'manager';
      if (!isSuperAdmin && callerProfile.institution_id !== institution_id) {
        const instCheck = await sbGet(`institutions?select=id,config_json&id=eq.${encodeURIComponent(institution_id)}&limit=1`);
        let cfgObj: any = instCheck[0]?.config_json || {};
        if (typeof cfgObj === 'string') {
          try { cfgObj = JSON.parse(cfgObj); } catch { cfgObj = {}; }
        }
        if (cfgObj?.parent_institution_id !== callerProfile.institution_id) {
          return res.status(403).json({ success: false, error: 'Forbidden: Access denied for this institution' });
        }
      }

      // 2. Verify voice template exists, belongs to institution (or global), and is SuperAdmin approved
      const templates = await sbGet(
        `voice_templates?select=id,institution_id,title,file_url,admin_status&id=eq.${encodeURIComponent(voice_template_id)}&limit=1`
      );
      const voiceTemplate = templates[0];
      if (!voiceTemplate) {
        return res.status(404).json({ success: false, error: 'Voice template not found' });
      }
      if (voiceTemplate.institution_id && voiceTemplate.institution_id !== institution_id) {
        return res.status(403).json({ success: false, error: 'Forbidden: Voice template belongs to another institution' });
      }
      if (voiceTemplate.admin_status !== 'approved') {
        return res.status(403).json({
          success: false,
          error: 'এই ভয়েস টেমপ্লেটটি এখনো সুপার অ্যাডমিন কর্তৃক অনুমোদিত হয়নি। অনুমোদনের পর কল পাঠানো যাবে।',
        });
      }

      const normalizeVoiceAudioUrl = (raw: any): string => {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return '';
        return trimmed.replace(/^https?:\/\/t2\.tenbytecloud\.com\//i, 'https://s3.eslcloud.io/');
      };

      const audioUrl = normalizeVoiceAudioUrl(voiceTemplate.file_url);
      if (!audioUrl || (!audioUrl.startsWith('https://') && !audioUrl.startsWith('http://') && !audioUrl.startsWith('/'))) {
        return res.status(400).json({ success: false, error: 'Valid voice template audio URL is missing' });
      }

      // 3. Fetch institution display name and verify Internet Voice Call module permission
      const instRows = await sbGet(`institutions?select=id,name,config_json,is_super_admin&id=eq.${encodeURIComponent(institution_id)}&limit=1`);
      const instRow = instRows[0];
      const institutionName = String(instRow?.name || 'প্রতিষ্ঠান').trim();

      if (!isSuperAdmin && !instRow?.is_super_admin) {
        let instCfg: any = instRow?.config_json || {};
        if (typeof instCfg === 'string') {
          try { instCfg = JSON.parse(instCfg); } catch { instCfg = {}; }
        }
        const cfgMods = instCfg?.modules || {};
        if (cfgMods.internet_voice_call !== true) {
          return res.status(403).json({
            success: false,
            error: 'ইন্টারনেট ভয়েস কল ব্যবহারের জন্য সুপার অ্যাডমিন প্যানেল থেকে "Internet Voice Call" পারমিশন অ্যাক্টিভ থাকতে হবে।',
          });
        }
      }

      // 4. Normalize and collect targets
      const normLast10 = (p: any) => String(p || '').replace(/\D/g, '').slice(-10);
      const normalizeBdPhone = (p: any): string => {
        const digits = String(p || '').replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('01')) return digits;
        if (digits.length === 13 && digits.startsWith('8801')) return digits.slice(2);
        if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
        return digits;
      };

      const targetAllStudents = Boolean(req.body?.target_all_students);
      const inputPhones: string[] = Array.isArray(target_phones) ? target_phones.map(normalizeBdPhone).filter((p) => p.length >= 10) : [];
      const inputStudentIds: string[] = Array.isArray(student_ids) ? student_ids.filter(isUuid) : [];

      let resolvedStudents: Array<{ id: string; guardian_phone?: string; guardian_phone_2?: string }> = [];
      if (inputStudentIds.length > 0) {
        for (let i = 0; i < inputStudentIds.length; i += 200) {
          const sChunk = inputStudentIds.slice(i, i + 200);
          const rows = await sbGet(
            `students?select=id,guardian_phone,guardian_phone_2&institution_id=eq.${encodeURIComponent(institution_id)}&id=in.(${sChunk.join(',')})&limit=500`
          );
          resolvedStudents.push(...rows);
        }
      } else if (class_id && isUuid(class_id)) {
        resolvedStudents = await sbGet(
          `students?select=id,guardian_phone,guardian_phone_2&institution_id=eq.${encodeURIComponent(institution_id)}&class_id=eq.${encodeURIComponent(class_id)}&is_active=eq.true&limit=2000`
        );
      } else if (targetAllStudents) {
        resolvedStudents = await sbGet(
          `students?select=id,guardian_phone,guardian_phone_2&institution_id=eq.${encodeURIComponent(institution_id)}&is_active=eq.true&limit=5000`
        );
      } else if (inputPhones.length > 0) {
        const last10s = Array.from(new Set(inputPhones.map(normLast10).filter((p) => p.length >= 10)));
        for (let i = 0; i < last10s.length; i += 40) {
          const chunk = last10s.slice(i, i + 40);
          const orFilter = chunk.map((p) => `guardian_phone.ilike.*${p}*,guardian_phone_2.ilike.*${p}*`).join(',');
          const rows = await sbGet(
            `students?select=id,guardian_phone,guardian_phone_2&institution_id=eq.${encodeURIComponent(institution_id)}&or=(${orFilter})&limit=500`
          );
          resolvedStudents.push(...rows);
        }
      }

      const phoneSet = new Set<string>(inputPhones);
      const studentIdSet = new Set<string>(inputStudentIds);
      for (const st of resolvedStudents) {
        if (st.id) studentIdSet.add(st.id);
        if (st.guardian_phone) {
          const n1 = normalizeBdPhone(st.guardian_phone);
          if (n1.length >= 10) phoneSet.add(n1);
        }
        if (st.guardian_phone_2) {
          const n2 = normalizeBdPhone(st.guardian_phone_2);
          if (n2.length >= 10) phoneSet.add(n2);
        }
      }

      const uniquePhones = Array.from(phoneSet);
      const uniqueStudentIds = Array.from(studentIdSet);
      const uniqueLast10 = Array.from(new Set(uniquePhones.map(normLast10).filter((p) => p.length >= 10)));

      if (uniquePhones.length === 0 && uniqueStudentIds.length === 0) {
        return res.status(400).json({ success: false, error: 'No target guardian phone numbers or students provided' });
      }

      const callId = `ivc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const cleanTitle = String(title || voiceTemplate.title || 'প্রতিষ্ঠান থেকে ভয়েস কল').trim();
      const cleanBody = String(body || `${institutionName} থেকে একটি জরুরি ভয়েস বার্তা এসেছে।`).trim();

      activeCallPayloads[callId] = {
        updatedAt: Date.now(),
        payload: {
          call_id: callId,
          type: 'auto_voice_alert',
          call_mode: 'internet_voice_broadcast',
          audio_url: audioUrl,
          institution_name: institutionName,
          title: cleanTitle,
          body: cleanBody,
          voice_template_id: voiceTemplate.id,
        },
      };

      // 5. Insert app_notifications records (NO metadata column)
      const messageJson = JSON.stringify({
        text: cleanBody,
        audio_url: audioUrl,
        call_mode: 'internet_voice_broadcast',
        institution_name: institutionName,
        voice_template_id: voiceTemplate.id,
        call_id: callId,
      });

      const nowIso = new Date().toISOString();
      const notifRows: Array<Record<string, any>> = [];
      const seenNotifKeys = new Set<string>();

      for (const st of resolvedStudents) {
        const gPhone = normalizeBdPhone(st.guardian_phone || st.guardian_phone_2 || '') || null;
        const key = `${st.id}_${gPhone || ''}`;
        if (!seenNotifKeys.has(key)) {
          seenNotifKeys.add(key);
          notifRows.push({
            institution_id,
            student_id: st.id,
            guardian_phone: gPhone,
            title: cleanTitle,
            message: messageJson,
            type: 'auto_voice_alert',
            is_read: false,
            created_at: nowIso,
          });
        }
      }

      const coveredLast10 = new Set(notifRows.map((r) => normLast10(r.guardian_phone)).filter(Boolean));
      for (const ph of uniquePhones) {
        const l10 = normLast10(ph);
        if (l10 && !coveredLast10.has(l10)) {
          coveredLast10.add(l10);
          notifRows.push({
            institution_id,
            student_id: null,
            guardian_phone: ph,
            title: cleanTitle,
            message: messageJson,
            type: 'auto_voice_alert',
            is_read: false,
            created_at: nowIso,
          });
        }
      }

      let notificationsInserted = 0;
      for (let i = 0; i < notifRows.length; i += 100) {
        const batch = notifRows.slice(i, i + 100);
        try {
          const insRes = await fetch(`${SUPABASE_URL}/rest/v1/app_notifications`, {
            method: 'POST',
            headers: { ...sbHeaders, Prefer: 'return=minimal' },
            body: JSON.stringify(batch),
          });
          if (insRes.ok) {
            notificationsInserted += batch.length;
          } else {
            const errTxt = await insRes.text().catch(() => '');
            console.warn('[Call API] app_notifications insert warning:', errTxt.slice(0, 200));
          }
        } catch (insErr) {
          console.warn('[Call API] app_notifications batch insert error:', insErr);
        }
      }

      // 6. Lookup matching parent FCM tokens across memoryTokens, device_tokens, fcm_tokens, call_tokens
      const tokenSet = new Set<string>();

      for (const l10 of uniqueLast10) {
        if (memoryTokens[`phone_${l10}`]?.token) {
          tokenSet.add(memoryTokens[`phone_${l10}`].token);
        }
      }
      for (const sid of uniqueStudentIds) {
        if (memoryTokens[`student_${sid}`]?.token) {
          tokenSet.add(memoryTokens[`student_${sid}`].token);
        }
      }

      for (let i = 0; i < uniqueLast10.length; i += 30) {
        const chunk = uniqueLast10.slice(i, i + 30);
        const orFilter = chunk.map((p) => `phone.ilike.*${p}*`).join(',');
        const devRows = await sbGet(`device_tokens?select=fcm_token&or=(${orFilter})&order=updated_at.desc&limit=500`);
        for (const row of devRows) {
          if (row?.fcm_token) tokenSet.add(row.fcm_token);
        }

        const fcmRows = await sbGet(`fcm_tokens?select=token,fcm_token&or=(${orFilter})&limit=300`);
        for (const row of fcmRows) {
          const tok = row?.fcm_token || row?.token;
          if (tok) tokenSet.add(tok);
        }
        const callTokRows = await sbGet(`call_tokens?select=token,fcm_token&or=(${orFilter})&limit=300`);
        for (const row of callTokRows) {
          const tok = row?.fcm_token || row?.token;
          if (tok) tokenSet.add(tok);
        }
      }

      if (uniqueStudentIds.length > 0) {
        for (let i = 0; i < uniqueStudentIds.length; i += 50) {
          const sChunk = uniqueStudentIds.slice(i, i + 50);
          const sDevRows = await sbGet(`device_tokens?select=fcm_token&student_id=in.(${sChunk.join(',')})&limit=300`);
          for (const row of sDevRows) {
            if (row?.fcm_token) tokenSet.add(row.fcm_token);
          }
        }
      }

      const finalTokens = Array.from(tokenSet).filter(Boolean);
      let pushedDevicesCount = 0;

      // 7. Send high-priority FCM v1 pushes (NO balance or voice_rate deduction)
      if (finalTokens.length > 0) {
        const effectiveSa = await resolveServiceAccount(institution_id);
        const fcmAccessToken = effectiveSa ? await getFirebaseV1AccessToken(effectiveSa) : null;

        if (effectiveSa && fcmAccessToken) {
          const clickAction = `/parent-portal?action=auto_voice_alert&call_id=${encodeURIComponent(callId)}`;
          const fcmData: Record<string, string> = {
            type: 'auto_voice_alert',
            call_mode: 'internet_voice_broadcast',
            call_id: callId,
            audio_url: audioUrl,
            institution_name: institutionName,
            title: cleanTitle,
            body: cleanBody,
            voice_template_id: String(voiceTemplate.id),
            click_action: clickAction,
          };

          const deadTokens: string[] = [];
          await Promise.all(
            finalTokens.map(async (tok) => {
              try {
                const r = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveSa.project_id}/messages:send`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${fcmAccessToken}`,
                  },
                  body: JSON.stringify({
                    message: {
                      token: tok,
                      android: {
                        priority: 'HIGH',
                        ttl: '120s',
                        notification: {
                          title: cleanTitle,
                          body: cleanBody,
                          sound: 'default',
                          channel_id: 'deenora_general_alerts',
                          notification_priority: 'PRIORITY_HIGH',
                          default_sound: true,
                          default_vibrate_timings: true,
                        },
                      },
                      notification: {
                        title: cleanTitle,
                        body: cleanBody,
                      },
                      data: fcmData,
                    },
                  }),
                });
                if (r.ok) {
                  pushedDevicesCount++;
                } else if (r.status === 404 || r.status === 410) {
                  deadTokens.push(tok);
                }
              } catch {
                // continue other devices
              }
            })
          );

          if (deadTokens.length > 0) {
            fetch(`${SUPABASE_URL}/rest/v1/device_tokens?fcm_token=in.(${deadTokens.map((t) => encodeURIComponent(t)).join(',')})`, {
              method: 'DELETE',
              headers: sbHeaders,
            }).catch(() => {});
          }
        }
      }

      return res.status(200).json({
        success: true,
        call_id: callId,
        pushed_devices_count: pushedDevicesCount,
        total_targets: Math.max(uniquePhones.length, uniqueStudentIds.length),
        notifications_inserted: notificationsInserted,
      });
    } catch (err: any) {
      console.error('[Call API] broadcast_internet_voice_call error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
    }
  }

  // 4c. MARK INTERNET VOICE CALL RECEIVED BY GUARDIAN
  if (req.method === 'POST' && action === 'mark_internet_voice_received') {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, error: 'Server configuration error' });
      }
      const { call_id, guardian_phone, student_id } = req.body || {};
      const cleanCallId = String(call_id || '').trim();
      if (!cleanCallId || !/^ivc_[0-9]+_[a-f0-9]+$/i.test(cleanCallId)) {
        return res.status(400).json({ success: false, error: 'Valid call_id is required' });
      }

      const isUuid = (s: any) =>
        typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      const cleanStudentId = isUuid(student_id) ? String(student_id).trim() : '';
      const digitsPhone = String(guardian_phone || '').replace(/\D/g, '');
      const last10Phone = digitsPhone.length >= 10 ? digitsPhone.slice(-10) : '';

      if (!cleanStudentId && !last10Phone) {
        return res.status(400).json({ success: false, error: 'Valid student_id or guardian_phone is required' });
      }

      let filterQuery = `type=eq.auto_voice_alert&message=ilike.*${encodeURIComponent(cleanCallId)}*`;
      if (cleanStudentId && last10Phone) {
        filterQuery += `&or=(student_id.eq.${encodeURIComponent(cleanStudentId)},guardian_phone.ilike.*${encodeURIComponent(last10Phone)}*)`;
      } else if (cleanStudentId) {
        filterQuery += `&student_id=eq.${encodeURIComponent(cleanStudentId)}`;
      } else {
        filterQuery += `&guardian_phone=ilike.*${encodeURIComponent(last10Phone)}*`;
      }

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/app_notifications?${filterQuery}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ is_read: true }),
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text().catch(() => '');
        return res.status(500).json({ success: false, error: errText || 'Failed to update notification status' });
      }

      const patchedRows = await patchRes.json().catch(() => []);
      return res.status(200).json({
        success: true,
        updated_count: Array.isArray(patchedRows) ? patchedRows.length : 0,
      });
    } catch (err: any) {
      console.error('[Call API] mark_internet_voice_received error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
    }
  }

  // 4d. SUPERADMIN CLEANUP OLD OR SPECIFIC INTERNET VOICE CALL HISTORY
  if (req.method === 'POST' && action === 'cleanup_old_internet_calls') {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, error: 'Server configuration error' });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
      }
      const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!bearerToken || bearerToken === 'undefined' || bearerToken === 'null') {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
      }

      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearerToken}` },
      });
      if (!userRes.ok) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
      }
      const authUser = await userRes.json();
      const userId = authUser?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
      }

      const sbHeaders = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      };
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,role&id=eq.${encodeURIComponent(userId)}&limit=1`,
        { headers: sbHeaders }
      );
      const profRows = profRes.ok ? await profRes.json() : [];
      const callerProfile = Array.isArray(profRows) ? profRows[0] : null;
      if (!callerProfile || (callerProfile.role !== 'super_admin' && callerProfile.role !== 'manager')) {
        return res.status(403).json({ success: false, error: 'Forbidden: SuperAdmin permission required' });
      }

      const { days_old, call_id } = req.body || {};
      const cleanCallId = String(call_id || '').trim();
      let deleteQuery = '';

      if (cleanCallId) {
        if (!/^ivc_[0-9]+_[a-f0-9]+$/i.test(cleanCallId)) {
          return res.status(400).json({ success: false, error: 'Invalid call_id format' });
        }
        deleteQuery = `type=eq.auto_voice_alert&message=ilike.*${encodeURIComponent(cleanCallId)}*`;
      } else {
        const parsedDays = Number(days_old ?? 30);
        if (!Number.isFinite(parsedDays) || parsedDays < 1 || parsedDays > 3650) {
          return res.status(400).json({ success: false, error: 'days_old must be between 1 and 3650' });
        }
        const cutoffIso = new Date(Date.now() - Math.floor(parsedDays) * 24 * 60 * 60 * 1000).toISOString();
        deleteQuery = `type=eq.auto_voice_alert&created_at=lt.${encodeURIComponent(cutoffIso)}`;
      }

      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/app_notifications?${deleteQuery}`, {
        method: 'DELETE',
        headers: {
          ...sbHeaders,
          Prefer: 'return=representation',
        },
      });

      if (!delRes.ok) {
        const errTxt = await delRes.text().catch(() => '');
        return res.status(500).json({ success: false, error: errTxt || 'Failed to delete call history' });
      }

      const deletedRows = await delRes.json().catch(() => []);
      return res.status(200).json({
        success: true,
        deleted_count: Array.isArray(deletedRows) ? deletedRows.length : 0,
      });
    } catch (err: any) {
      console.error('[Call API] cleanup_old_internet_calls error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
    }
  }

  // 4e. INSTITUTION ADMIN / SUPERADMIN DELETE SPECIFIC INTERNET VOICE CALL HISTORY RECORD
  if (req.method === 'POST' && action === 'delete_internet_voice_history') {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, error: 'Server configuration error' });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
      }
      const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!bearerToken || bearerToken === 'undefined' || bearerToken === 'null') {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
      }

      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearerToken}` },
      });
      if (!userRes.ok) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
      }
      const authUser = await userRes.json();
      const userId = authUser?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
      }

      const sbHeaders = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      };
      const sbGet = async (path: string): Promise<any[]> => {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
          if (!r.ok) return [];
          const j = await r.json();
          return Array.isArray(j) ? j : [];
        } catch {
          return [];
        }
      };

      const profiles = await sbGet(`profiles?select=id,institution_id,role,permissions&id=eq.${encodeURIComponent(userId)}&limit=1`);
      const callerProfile = profiles[0];
      if (!callerProfile) {
        return res.status(403).json({ success: false, error: 'Forbidden: Profile not found' });
      }

      const isSuperAdmin = callerProfile.role === 'super_admin' || callerProfile.role === 'manager';
      let parsedPermissions: any = callerProfile.permissions || {};
      if (typeof parsedPermissions === 'string') {
        try { parsedPermissions = JSON.parse(parsedPermissions); } catch { parsedPermissions = {}; }
      }
      const isAllowedInstitutionRole =
        callerProfile.role === 'madrasah_admin' ||
        callerProfile.role === 'accountant' ||
        (callerProfile.role === 'teacher' && Boolean(parsedPermissions?.can_use_voice_call || parsedPermissions?.voice_dashboard));

      if (!isSuperAdmin && !isAllowedInstitutionRole) {
        return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
      }

      const isUuid = (s: any) =>
        typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

      const { call_id, institution_id, notification_ids } = req.body || {};
      const requestedInstId = String(institution_id || '').trim();
      if (requestedInstId && !isUuid(requestedInstId)) {
        return res.status(400).json({ success: false, error: 'Invalid institution_id' });
      }

      const effectiveInstId = requestedInstId || (!isSuperAdmin ? callerProfile.institution_id : '');
      if (!isSuperAdmin) {
        if (!effectiveInstId) {
          return res.status(403).json({ success: false, error: 'Forbidden: Institution access required' });
        }
        if (callerProfile.institution_id !== effectiveInstId) {
          const instCheck = await sbGet(`institutions?select=id,config_json&id=eq.${encodeURIComponent(effectiveInstId)}&limit=1`);
          let cfgObj: any = instCheck[0]?.config_json || {};
          if (typeof cfgObj === 'string') {
            try { cfgObj = JSON.parse(cfgObj); } catch { cfgObj = {}; }
          }
          if (cfgObj?.parent_institution_id !== callerProfile.institution_id) {
            return res.status(403).json({ success: false, error: 'Forbidden: Access denied for this institution' });
          }
        }
      }

      const cleanCallId = String(call_id || '').trim();
      const validIds = Array.isArray(notification_ids)
        ? notification_ids.map((v: any) => String(v || '').trim()).filter((v: string) => isUuid(v)).slice(0, 500)
        : [];

      let deleteQuery = '';
      if (cleanCallId && /^ivc_[0-9]+_[a-f0-9]+$/i.test(cleanCallId)) {
        deleteQuery = `type=eq.auto_voice_alert&message=ilike.*${encodeURIComponent(cleanCallId)}*`;
      } else if (validIds.length > 0) {
        deleteQuery = `type=eq.auto_voice_alert&id=in.(${validIds.join(',')})`;
      } else {
        return res.status(400).json({ success: false, error: 'Valid call_id or notification_ids required' });
      }

      if (effectiveInstId) {
        deleteQuery += `&institution_id=eq.${encodeURIComponent(effectiveInstId)}`;
      }

      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/app_notifications?${deleteQuery}`, {
        method: 'DELETE',
        headers: {
          ...sbHeaders,
          Prefer: 'return=representation',
        },
      });

      if (!delRes.ok) {
        const errTxt = await delRes.text().catch(() => '');
        return res.status(500).json({ success: false, error: errTxt || 'Failed to delete internet voice call history' });
      }

      const deletedRows = await delRes.json().catch(() => []);
      return res.status(200).json({
        success: true,
        deleted_count: Array.isArray(deletedRows) ? deletedRows.length : 0,
      });
    } catch (err: any) {
      console.error('[Call API] delete_internet_voice_history error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
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

    // 1. SELECT from call_signals WHERE call_id = ? AND consumed = false
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

            // 2. Mark as consumed after returning
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

      // 3. DELETE signals older than 5 minutes (cleanup in background)
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

    // Fallback: merge with local in-memory buffer if database is pending or returned empty
    const memSignals = activeCallSignals[targetCallId] || [];
    if (signals.length === 0 && memSignals.length > 0) {
      signals = memSignals;
    }

    return res.status(200).json({
      success: true,
      signals,
    });
  }

  // 6. GET CALL CONFIG, INTERNET VOICE HISTORY & HEALTH
  if (req.method === 'GET') {
    if (req.query && req.query.action === 'get_internet_voice_history') {
      try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
          return res.status(500).json({ success: false, error: 'Server configuration error' });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
        }
        const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!bearerToken || bearerToken === 'undefined' || bearerToken === 'null') {
          return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
        }

        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearerToken}` },
        });
        if (!userRes.ok) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
        }
        const authUser = await userRes.json();
        const userId = authUser?.id;
        if (!userId) {
          return res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
        }

        const sbHeaders = {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        };
        const sbGet = async (path: string): Promise<any[]> => {
          try {
            const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
            if (!r.ok) return [];
            const j = await r.json();
            return Array.isArray(j) ? j : [];
          } catch {
            return [];
          }
        };

        const profiles = await sbGet(`profiles?select=id,institution_id,role&id=eq.${encodeURIComponent(userId)}&limit=1`);
        const callerProfile = profiles[0];
        if (!callerProfile) {
          return res.status(403).json({ success: false, error: 'Forbidden: Profile not found' });
        }

        const isUuid = (s: any) =>
          typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        const isSuperAdmin = callerProfile.role === 'super_admin' || callerProfile.role === 'manager';
        const requestedInstId = String(req.query.institution_id || '').trim();

        if (requestedInstId && !isUuid(requestedInstId)) {
          return res.status(400).json({ success: false, error: 'Invalid institution_id' });
        }

        const effectiveInstId = requestedInstId || (!isSuperAdmin ? callerProfile.institution_id : '');
        if (!isSuperAdmin) {
          if (!effectiveInstId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Institution access required' });
          }
          if (callerProfile.institution_id !== effectiveInstId) {
            const instCheck = await sbGet(`institutions?select=id,config_json&id=eq.${encodeURIComponent(effectiveInstId)}&limit=1`);
            let cfgObj: any = instCheck[0]?.config_json || {};
            if (typeof cfgObj === 'string') {
              try { cfgObj = JSON.parse(cfgObj); } catch { cfgObj = {}; }
            }
            if (cfgObj?.parent_institution_id !== callerProfile.institution_id) {
              return res.status(403).json({ success: false, error: 'Forbidden: Access denied for this institution' });
            }
          }
        }

        let queryUrl = `app_notifications?select=id,institution_id,student_id,guardian_phone,title,message,is_read,created_at&type=eq.auto_voice_alert&order=created_at.desc&limit=2000`;
        if (effectiveInstId) {
          queryUrl += `&institution_id=eq.${encodeURIComponent(effectiveInstId)}`;
        }

        const rows = await sbGet(queryUrl);
        const normalizeVoiceAudioUrl = (raw: any): string => {
          const trimmed = String(raw || '').trim();
          if (!trimmed) return '';
          return trimmed.replace(/^https?:\/\/t2\.tenbytecloud\.com\//i, 'https://s3.eslcloud.io/');
        };
        const normLast10 = (p: any) => String(p || '').replace(/\D/g, '').slice(-10);

        interface AggregatedCall {
          call_id: string;
          institution_id: string;
          title: string;
          institution_name: string;
          audio_url: string;
          created_at: string;
          notification_ids: string[];
          recipientMap: Map<string, { guardian_phone: string; student_id: string | null; received: boolean }>;
        }

        const grouped = new Map<string, AggregatedCall>();

        for (const row of rows) {
          let parsed: any = {};
          if (row?.message) {
            try {
              parsed = typeof row.message === 'string' ? JSON.parse(row.message) : row.message;
            } catch {
              parsed = {};
            }
          }
          const callId = String(
            parsed?.call_id ||
            `legacy_${row.institution_id || 'x'}_${row.title || 'voice'}_${String(row.created_at || '').slice(0, 16)}`
          ).trim();

          let bucket = grouped.get(callId);
          if (!bucket) {
            bucket = {
              call_id: callId,
              institution_id: row.institution_id || '',
              title: String(row.title || parsed?.title || 'জরুরি ভয়েস বার্তা'),
              institution_name: String(parsed?.institution_name || 'প্রতিষ্ঠান'),
              audio_url: normalizeVoiceAudioUrl(parsed?.audio_url || ''),
              created_at: row.created_at,
              notification_ids: [],
              recipientMap: new Map(),
            };
            grouped.set(callId, bucket);
          }

          if (row.id) {
            bucket.notification_ids.push(String(row.id));
          }
          if (row.created_at && new Date(row.created_at).getTime() > new Date(bucket.created_at).getTime()) {
            bucket.created_at = row.created_at;
          }
          if (!bucket.audio_url && parsed?.audio_url) {
            bucket.audio_url = normalizeVoiceAudioUrl(parsed.audio_url);
          }

          const gPhone = String(row.guardian_phone || '').trim();
          const sId = row.student_id || null;
          const rKey = `${sId || ''}_${normLast10(gPhone) || row.id}`;
          const prevRecipient = bucket.recipientMap.get(rKey);
          const isReceived = Boolean(row.is_read);
          if (prevRecipient) {
            prevRecipient.received = prevRecipient.received || isReceived;
          } else {
            bucket.recipientMap.set(rKey, {
              guardian_phone: gPhone,
              student_id: sId,
              received: isReceived,
            });
          }
        }

        const history = Array.from(grouped.values())
          .map((item) => {
            const recipients = Array.from(item.recipientMap.values());
            const received_count = recipients.filter((r) => r.received).length;
            const total_sent = recipients.length;
            return {
              call_id: item.call_id,
              institution_id: item.institution_id,
              title: item.title,
              institution_name: item.institution_name,
              audio_url: item.audio_url,
              created_at: item.created_at,
              notification_ids: item.notification_ids,
              total_sent,
              received_count,
              pending_count: Math.max(0, total_sent - received_count),
              recipients,
            };
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return res.status(200).json({ success: true, history });
      } catch (err: any) {
        console.error('[Call API] get_internet_voice_history error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
      }
    }

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
