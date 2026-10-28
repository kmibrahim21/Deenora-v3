import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// In-memory token cache fallback if table is not yet migrated in Supabase
const memoryTokens: Record<string, { token: string; updatedAt: number }> = {};

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

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceAccount = parseServiceAccount();

  // FIX 2026-10-13: log key SHAPE only (never the key itself) to diagnose paste issues
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

  // Helper: Find target FCM tokens by callee_phone or student_id (memory cache + Supabase device_tokens for multi-device support)
  async function findTargetFcmTokens(
    calleePhone: string | null | undefined,
    studentId: string | null | undefined
  ): Promise<string[]> {
    const rawPhone = calleePhone ? String(calleePhone).trim() : '';
    const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '').slice(-10) : '';
    const foundTokens = new Set<string>();

    // 1. Check in-memory token cache
    if (cleanPhone && memoryTokens[`phone_${cleanPhone}`]) {
      foundTokens.add(memoryTokens[`phone_${cleanPhone}`].token);
    }
    if (studentId && memoryTokens[`student_${studentId}`]) {
      foundTokens.add(memoryTokens[`student_${studentId}`].token);
    }

    // 2. Query Supabase device_tokens table (returns up to 5 active devices per recipient)
    if (SUPABASE_URL && SUPABASE_KEY && (cleanPhone || rawPhone || studentId)) {
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
    calleePhone: string | null | undefined,
    studentId: string | null | undefined
  ): Promise<string | null> {
    const tokens = await findTargetFcmTokens(calleePhone, studentId);
    return tokens[0] || null;
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

          // Best-effort dedupe: if device_id is present, delete old rows for the same device with a different token
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

      // Find all target tokens for multi-device simultaneous ring
      const targetTokens = await findTargetFcmTokens(callee_phone, student_id);
      console.log('[Call API] initiate_call_push attempt:', JSON.stringify({
        devicesNotified: targetTokens.length,
        call_id: String(payload.call_id || ''),
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
      const fcmDataPayload: Record<string, string> = {
        type: 'incoming_call',
        call_id: String(call_id || ''),
        caller_name: String(caller_name || 'মাদরাসা এডমিন'),
        student_name: String(student_name || ''),
        student_id: String(student_id || ''),
        institution_id: String(institution_id || ''),
        callee_phone: String(callee_phone || ''),
        timestamp: String(Date.now()),
      };

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
                  android: { priority: 'HIGH', ttl: '120s' },
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

      // Prune dead/unregistered tokens (best-effort, never fail the push)
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const deadTokens: string[] = [];
          sendResults.forEach((resItem, idx) => {
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
              deadTokens.map((deadTok) =>
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

      // Match phones to registered FCM tokens (single bulk query, match in JS)
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
      // TEMP DEBUG 2026-10-05: capture which token + what FCM actually says
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

  // 5. GET CALL CONFIG & HEALTH
  if (req.method === 'GET') {
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
