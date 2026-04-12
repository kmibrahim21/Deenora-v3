
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, secretKey, callerId, toUser, message, clientId } = req.body;

  if (!apiKey || !secretKey || !callerId || !toUser || !message) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    let apiUrl = `https://smpp.revesms.com:7790/sendtext?apikey=${apiKey}&secretkey=${secretKey}&callerID=${callerId}&toUser=${toUser}&messageContent=${encodeURIComponent(message)}&type=3`;
    if (clientId) apiUrl += `&clientid=${clientId}`;

    const response = await fetch(apiUrl);
    const text = await response.text();

    return res.status(200).json({ success: true, response: text });
  } catch (error: any) {
    console.error('SMS API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
