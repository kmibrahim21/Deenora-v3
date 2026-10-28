import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(500).json({ error: 'Database service unavailable' });
    }

    let user: any = null;
    let userId = '';

    // 1. Verify token with Supabase auth.getUser(token)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userData?.user && !userError) {
        user = userData.user;
        userId = user.id;
      }
    } catch (e) {
      console.warn('[TURN Credentials] supabase.auth.getUser notice:', e);
    }

    // 2. Fallback: Parse JWT payload directly if getUser fails
    if (!user) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload && (payload.sub || payload.id)) {
            userId = payload.sub || payload.id;
            user = { id: userId };
          }
        }
      } catch (jwtErr) {
        console.warn('[TURN Credentials] JWT parse notice:', jwtErr);
      }
    }

    if (!user || !userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const turnServerIp = process.env.TURN_SERVER_IP;
    const turnStaticSecret = process.env.TURN_STATIC_SECRET;

    if (!turnServerIp || !turnStaticSecret) {
      return res.status(500).json({ error: 'TURN server configuration missing' });
    }

    // Generate time-limited credential (coturn use-auth-secret / REST-style)
    const ttl = 3600;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiry}:${userId}`;
    const password = crypto
      .createHmac('sha1', turnStaticSecret)
      .update(username)
      .digest('base64');

    return res.status(200).json({
      urls: [
        `turn:${turnServerIp}:3478?transport=udp`,
        `turn:${turnServerIp}:3478?transport=tcp`,
        `turns:${turnServerIp}:5349?transport=tcp`,
      ],
      username,
      credential: password,
      ttl,
    });
  } catch (error: any) {
    console.error('[TURN Credentials] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
