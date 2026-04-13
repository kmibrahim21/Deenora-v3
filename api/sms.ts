import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import https from 'https';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { apiUrl } = req.body;

    if (!apiUrl) {
      return res.status(400).json({ error: 'apiUrl is required' });
    }

    // Create a custom agent to ignore SSL certificate errors if any
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await fetch(apiUrl, {
      method: 'GET',
      agent
    });

    const text = await response.text();

    return res.status(200).json({ success: true, response: text });
  } catch (error: any) {
    console.error('SMS Proxy Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
