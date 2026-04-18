import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { Buffer } from 'node:buffer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const audioUrl = req.query.url as string;
  
  if (!audioUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    };
    
    if (req.headers.range) {
      fetchOptions.headers.range = req.headers.range;
    }

    const response = await fetch(audioUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let contentType = response.headers.get('content-type') || 'audio/mpeg';
    // Fix CDN wrong content types
    if (contentType.includes('octet-stream') || contentType.includes('text/') || contentType.includes('text/html')) {
      contentType = audioUrl.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    if (response.headers.has('content-range')) {
      res.setHeader('Content-Range', response.headers.get('content-range')!);
    }
    if (response.headers.has('accept-ranges')) {
      res.setHeader('Accept-Ranges', response.headers.get('accept-ranges')!);
    }

    return res.status(response.status || 200).send(buffer);
  } catch (error: any) {
    console.error('Audio Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
