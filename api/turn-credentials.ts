import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Parent-Phone');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let userId = '';
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (token && token !== 'undefined' && token !== 'null') {
      const supabase = getSupabaseAdmin();
      // 1. Verify token with Supabase auth.getUser(token) if available
      if (supabase) {
        try {
          const { data: userData, error: userError } = await supabase.auth.getUser(token);
          if (userData?.user && !userError) {
            userId = userData.user.id;
          }
        } catch (e) {
          console.warn('[TURN Credentials] supabase.auth.getUser notice:', e);
        }
      }

      // 2. Fallback: Parse JWT payload directly if getUser fails
      if (!userId) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            if (payload && (payload.sub || payload.id)) {
              userId = String(payload.sub || payload.id);
            }
          }
        } catch (jwtErr) {
          console.warn('[TURN Credentials] JWT parse notice:', jwtErr);
        }
      }
    }

    // 3. Parent Portal / Guardian fallback (no Supabase JWT session)
    if (!userId) {
      const queryPhone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
      const headerPhone = typeof req.headers['x-parent-phone'] === 'string' ? req.headers['x-parent-phone'].trim() : '';
      const queryCallId = typeof req.query.callId === 'string' ? req.query.callId.trim() : '';
      const rawIdentifier = queryPhone || headerPhone || queryCallId || `guest_${Date.now()}`;
      userId = rawIdentifier.replace(/[^a-zA-Z0-9_-]/g, '') || `guest_${Date.now()}`;
    }

    const turnServerIp = (process.env.TURN_SERVER_IP || '').trim().replace(/^<|>$/g, '');
    const turnStaticSecret = process.env.TURN_STATIC_SECRET;

    if (!turnServerIp || !turnStaticSecret) {
      return res.status(500).json({ error: 'TURN server configuration missing' });
    }

    // Generate time-limited credential (coturn use-auth-secret / REST-style)
    const ttl = 3600;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiry}:${userId}`;
    const cleanSecret = turnStaticSecret.trim().replace(/^<|>$/g, '');

    const password = crypto
      .createHmac('sha1', cleanSecret)
      .update(username)
      .digest('base64');

    const turnUrls = [
      `turn:${turnServerIp}:3478?transport=udp`,
      `turn:${turnServerIp}:3478?transport=tcp`,
    ];

    return res.status(200).json({
      urls: turnUrls,
      username,
      credential: password,
      iceServers: [
        {
          urls: turnUrls,
          username,
          credential: password,
        },
      ],
      ttl,
    });
  } catch (error: any) {
    console.error('[TURN Credentials] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
