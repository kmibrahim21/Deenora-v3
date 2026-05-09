import type { VercelRequest, VercelResponse } from '@vercel/node';
// native fetch used
import https from 'https';

// Simple in-memory cache to prevent double sending due to network retries
const requestCache = new Map<string, number>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { apiUrl } = req.body;

    if (!apiUrl) {
      return res.status(400).json({ error: 'apiUrl is required' });
    }

    const now = Date.now();
    const lastRequestTime = requestCache.get(apiUrl);
    
    // If the exact same API URL is requested within 5 seconds, it's likely a network retry
    if (lastRequestTime && (now - lastRequestTime) < 5000) {
      return res.status(200).json({ success: true, response: 'Duplicate request blocked by idempotency check' });
    }

    // Update cache
    requestCache.set(apiUrl, now);
    
    // Cleanup old cache entries (older than 10 seconds)
    for (const [key, timestamp] of requestCache.entries()) {
      if (now - timestamp > 10000) {
        requestCache.delete(key);
      }
    }

    // Create a custom agent to ignore SSL certificate errors if any
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await fetch(apiUrl, {
      method: 'GET'
    });

    const text = await response.text();

    return res.status(200).json({ success: true, response: text });
  } catch (error: any) {
    console.error('SMS Proxy Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
