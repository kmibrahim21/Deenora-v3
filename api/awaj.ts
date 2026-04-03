
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Buffer } from 'node:buffer';

const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';

const getAwajHeaders = () => {
  const token = process.env.AWAJ_API_TOKEN;
  if (!token) {
    throw new Error('AWAJ_API_TOKEN is not set. Please add it to your environment variables.');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const parts = pathname.split('/').filter(Boolean);
  
  // More robust action detection
  let action = parts[2]; // e.g. 'voices', 'broadcast', 'senders', etc.
  if (parts[1] === 'awaj' && !action) {
    action = (req.query.action as string) || 'voices';
  }
  const subAction = parts[3] || (req.query.id as string);

  try {
    // VOICES
    if (action === 'voices') {
      if (req.method === 'GET') {
        const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: getAwajHeaders() as any });
        if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
        const data = await response.json();
        return res.status(200).json(data);
      }
      if (req.method === 'POST') {
        // Ensure body is parsed if it's a string
        if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
          try {
            req.body = JSON.parse(req.body);
          } catch (e) {
            console.warn('Failed to parse req.body as JSON in awaj API:', e);
          }
        }
        const body = req.body || {};
        const { name, file_url } = body;
        let bodyStr: any = JSON.stringify(body);
        let headers: any = { ...getAwajHeaders() };
        if (file_url) {
          const fileRes = await fetch(file_url);
          if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.statusText}`);
          const fileBuffer = await fileRes.arrayBuffer();
          const contentType = fileRes.headers.get('content-type') || 'audio/mpeg';
          const extension = file_url.split('.').pop()?.split('?')[0] || 'mp3';
          const filename = `voice.${extension}`;
          const formData = new FormData();
          formData.append('name', name || 'Voice Upload');
          formData.append('audio', Buffer.from(new Uint8Array(fileBuffer)), { filename, contentType });
          formData.append('file', Buffer.from(new Uint8Array(fileBuffer)), { filename, contentType });
          bodyStr = formData;
          headers = { 'Authorization': `Bearer ${process.env.AWAJ_API_TOKEN}`, 'Accept': 'application/json', ...formData.getHeaders() };
        }
        const response = await fetch(`${AWAJ_BASE_URL}/voices/upload`, { method: 'POST', headers, body: bodyStr });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE' && subAction) {
        const response = await fetch(`${AWAJ_BASE_URL}/voices/${subAction}`, { method: 'DELETE', headers: getAwajHeaders() as any });
        if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
        let data = {};
        try { data = await response.json(); } catch (e) {}
        return res.status(200).json({ success: true, ...data });
      }
    }

    // BROADCAST
    if (action === 'broadcast' || action === 'broadcasts') {
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, { method: 'POST', headers: getAwajHeaders(), body: JSON.stringify(req.body) });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'GET') {
        if (subAction) {
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}/result`, { headers: getAwajHeaders() });
          if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}`, { headers: getAwajHeaders() });
          if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
          const data = await response.json();
          return res.status(200).json(data);
        } else {
          const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, { headers: getAwajHeaders() });
          if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
          const data = await response.json();
          return res.status(200).json(data);
        }
      }
    }

    // BROADCAST-RESULT (legacy or direct)
    if (action === 'broadcast-result') {
      const id = req.query.id || subAction;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}/result`, { headers: getAwajHeaders() });
      if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}`, { headers: getAwajHeaders() });
      if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // SENDERS
    if (action === 'senders') {
      const response = await fetch(`${AWAJ_BASE_URL}/senders`, { headers: getAwajHeaders() });
      if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // SURVEYS
    if (action === 'surveys') {
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/surveys`, { method: 'POST', headers: getAwajHeaders(), body: JSON.stringify(req.body) });
        if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
        const data = await response.json();
        return res.status(200).json(data);
      }
    }

    // WEBHOOK
    if (action === 'webhook') {
      if (req.method === 'POST') {
        console.log('Received webhook:', req.body);
        return res.status(200).json({ received: true });
      }
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error: any) {
    console.error(`Awaj API error (${action}):`, error);
    res.status(500).json({ error: error.message });
  }
}
