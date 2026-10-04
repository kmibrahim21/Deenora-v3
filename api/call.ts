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

function parseServiceAccount(): FirebaseServiceAccount | null {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const parsed = typeof raw === 'string' && raw.trim().startsWith('{')
        ? JSON.parse(raw)
        : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      if (parsed.client_email && parsed.private_key && parsed.project_id) {
        return parsed;
      }
    }
  } catch {}

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
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

    const cleanPrivateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
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
  const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;
  const serviceAccount = parseServiceAccount();

  const action = req.query.action || req.body?.action;

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
      // IMPORTANT (2026-10-04 fix): only send fields that actually have values.
      // The native app posts on EVERY launch with phone=null — with
      // resolution=merge-duplicates that was wiping the phone/student linkage
      // the web registration had just set. Now nulls never overwrite.
      let dbDebug: any = null;
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const upsertBody: any = {
            fcm_token: token,
            updated_at: new Date().toISOString(),
          };
          if (phone) upsertBody.phone = phone;
          if (user_id) upsertBody.user_id = user_id;
          if (student_id) upsertBody.student_id = student_id;
          if (institution_id) upsertBody.institution_id = institution_id;
          // IMPORTANT (2026-10-05 fix): PostgREST needs ?on_conflict=fcm_token
          // (snake_case — onConflict is supabase-js syntax, raw PostgREST
          // rejects it with PGRST100 "failed to parse filter").
          // Without it, merge-duplicates only matches the PRIMARY KEY (id),
          // so every POST tried to INSERT a duplicate fcm_token → 409 silently
          // caught → phone was NEVER saved. The unique fcm_token IS the conflict target.
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
          console.error('[Call API] device_tokens upsert:', dbRes.status, dbText.slice(0, 300));
          dbDebug = { status: dbRes.status, ok: dbRes.ok, body: dbText.slice(0, 300) };
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
      const payload = req.body?.payload || req.body;
      const {
        call_id,
        caller_name,
        student_name,
        student_id,
        institution_id,
        callee_phone,
      } = payload;

      const cleanPhone = callee_phone ? String(callee_phone).replace(/\D/g, '').slice(-10) : '';

      // Find token from memory or database
      let targetToken: string | null = null;
      if (cleanPhone && memoryTokens[`phone_${cleanPhone}`]) {
        targetToken = memoryTokens[`phone_${cleanPhone}`].token;
      } else if (student_id && memoryTokens[`student_${student_id}`]) {
        targetToken = memoryTokens[`student_${student_id}`].token;
      }

      // Query database if not in memory
      if (!targetToken && SUPABASE_URL && SUPABASE_KEY) {
        try {
          let qUrl = `${SUPABASE_URL}/rest/v1/device_tokens?select=fcm_token`;
          if (cleanPhone) {
            qUrl += `&phone=ilike.*${cleanPhone}*`;
          } else if (student_id) {
            qUrl += `&student_id=eq.${student_id}`;
          }
          qUrl += `&order=updated_at.desc&limit=1`;

          const tokenRes = await fetch(qUrl, {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          });
          if (tokenRes.ok) {
            const tokenList = await tokenRes.json();
            if (tokenList && tokenList.length > 0 && tokenList[0].fcm_token) {
              targetToken = tokenList[0].fcm_token;
            }
          }
        } catch (dbQErr) {
          console.warn('[Call API] Querying device_tokens notice:', dbQErr);
        }
      }

      // Check institution config for custom FCM key if not in env
      let effectiveFcmKey = FCM_SERVER_KEY;
      let effectiveServiceAccount = serviceAccount;

      if (!effectiveFcmKey && !effectiveServiceAccount && institution_id && SUPABASE_URL && SUPABASE_KEY) {
        try {
          const instRes = await fetch(`${SUPABASE_URL}/rest/v1/institutions?select=config_json&id=eq.${institution_id}&limit=1`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          });
          if (instRes.ok) {
            const instData = await instRes.json();
            const config = instData?.[0]?.config_json || {};
            if (config.fcm_server_key) {
              effectiveFcmKey = config.fcm_server_key;
            }
            if (config.firebase_service_account) {
              try {
                effectiveServiceAccount = typeof config.firebase_service_account === 'string'
                  ? JSON.parse(config.firebase_service_account)
                  : config.firebase_service_account;
              } catch {}
            }
          }
        } catch {}
      }

      // High-Priority Data Payload expected by Fcmservice.kt
      const fcmDataPayload = {
        type: 'incoming_call',
        call_id: String(call_id || ''),
        caller_name: String(caller_name || 'মাদরাসা এডমিন'),
        student_name: String(student_name || ''),
        student_id: String(student_id || ''),
        institution_id: String(institution_id || ''),
        callee_phone: String(callee_phone || ''),
        timestamp: String(Date.now()),
      };

      // METHOD 1: Firebase Cloud Messaging HTTP v1 API (Google Recommended Modern API)
      if (effectiveServiceAccount && targetToken) {
        const v1AccessToken = await getFirebaseV1AccessToken(effectiveServiceAccount);
        if (v1AccessToken) {
          const v1Response = await fetch(`https://fcm.googleapis.com/v1/projects/${effectiveServiceAccount.project_id}/messages:send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${v1AccessToken}`,
            },
            body: JSON.stringify({
              message: {
                token: targetToken,
                android: {
                  priority: 'HIGH',
                },
                data: fcmDataPayload,
              },
            }),
          });

          const v1Result = await v1Response.json().catch(() => ({}));
          return res.status(200).json({
            success: true,
            fcmSent: true,
            apiType: 'v1',
            targetTokenFound: true,
            fcmResult: v1Result,
            payload: fcmDataPayload,
          });
        }
      }

      // METHOD 2: Firebase Legacy HTTP API (Simple Server Key)
      if (effectiveFcmKey && targetToken) {
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${effectiveFcmKey}`,
          },
          body: JSON.stringify({
            to: targetToken,
            priority: 'high',
            android: {
              priority: 'high',
            },
            data: fcmDataPayload,
          }),
        });

        const fcmResult = await fcmResponse.json().catch(() => ({}));
        return res.status(200).json({
          success: true,
          fcmSent: true,
          apiType: 'legacy',
          targetTokenFound: true,
          fcmResult,
          payload: fcmDataPayload,
        });
      }

      return res.status(200).json({
        success: true,
        fcmSent: false,
        targetTokenFound: Boolean(targetToken),
        hasServerKey: Boolean(effectiveFcmKey || effectiveServiceAccount),
        message: !(effectiveFcmKey || effectiveServiceAccount)
          ? 'Neither FCM_SERVER_KEY nor FIREBASE_SERVICE_ACCOUNT is configured.'
          : 'Device FCM token not registered for this phone yet. Open the app on Android once to register token.',
        payload: fcmDataPayload,
      });
    } catch (err: any) {
      console.error('[Call API] FCM send error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3. SEND GENERIC PUSH NOTIFICATION (notice / result / diary / chat) to parent Android apps
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
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
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
      const tokens = await sbGet(`device_tokens?select=fcm_token,phone&limit=10000`);
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
      const results = await Promise.all(finalTokens.map(tok =>
        fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ message: { token: tok, android: { priority: 'HIGH' }, data } }),
        }).then(r => r.ok).catch(() => false)
      ));
      const sent = results.filter(Boolean).length;
      return res.status(200).json({ success: true, sent, matched: finalTokens.length });
    } catch (err: any) {
      console.error('[Call API] send_notification_push error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 4. GET CALL CONFIG & HEALTH
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      hasFcmServerKey: Boolean(FCM_SERVER_KEY),
      hasFirebaseServiceAccount: Boolean(serviceAccount),
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasSupabaseKey: Boolean(SUPABASE_KEY),
      cachedTokensCount: Object.keys(memoryTokens).length,
      timestamp: Date.now(),
    });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
