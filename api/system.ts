import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Buffer } from 'node:buffer';

function upsample8kTo16k(wavBuffer: Buffer): Buffer {
  if (wavBuffer.length < 44) return wavBuffer;
  const isRIFF = wavBuffer.toString('ascii', 0, 4) === 'RIFF';
  const isWAVE = wavBuffer.toString('ascii', 8, 12) === 'WAVE';
  if (!isRIFF || !isWAVE) return wavBuffer;

  const audioFormat = wavBuffer.readUInt16LE(20);
  const numChannels = wavBuffer.readUInt16LE(22);
  const sampleRate = wavBuffer.readUInt32LE(24);
  const bitsPerSample = wavBuffer.readUInt16LE(34);

  // If already >= 16000 or not 16-bit PCM mono, return original
  if (sampleRate >= 16000 || audioFormat !== 1 || bitsPerSample !== 16 || numChannels !== 1) {
    return wavBuffer;
  }

  // Find data chunk offset
  let dataOffset = 12;
  while (dataOffset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString('ascii', dataOffset, dataOffset + 4);
    const chunkSize = wavBuffer.readUInt32LE(dataOffset + 4);
    if (chunkId === 'data') {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  if (dataOffset >= wavBuffer.length) return wavBuffer;

  const pcmBytes = wavBuffer.subarray(dataOffset);
  const numSamples = Math.floor(pcmBytes.length / 2);
  const upsampledPcm = Buffer.alloc(numSamples * 4); // 2x samples for 16kHz

  for (let i = 0; i < numSamples; i++) {
    const sample = pcmBytes.readInt16LE(i * 2);
    const nextSample = i < numSamples - 1 ? pcmBytes.readInt16LE((i + 1) * 2) : sample;
    const midSample = Math.round((sample + nextSample) / 2);

    upsampledPcm.writeInt16LE(sample, i * 4);
    upsampledPcm.writeInt16LE(midSample, i * 4 + 2);
  }

  // Build compliant 16kHz WAV header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + upsampledPcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
  header.writeUInt32LE(16000, 24); // SampleRate (16000)
  header.writeUInt32LE(32000, 28); // ByteRate (16000 * 1 * 2)
  header.writeUInt16LE(2, 32); // BlockAlign (1 * 2)
  header.writeUInt16LE(16, 34); // BitsPerSample (16)
  header.write('data', 36);
  header.writeUInt32LE(upsampledPcm.length, 40);

  return Buffer.concat([header, upsampledPcm]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  
  // Basic routing within the system handler
  if (pathname.includes('/health')) {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    return res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      diagnostics: {
        has_supabase_url: !!SUPABASE_URL,
        has_supabase_key: !!SUPABASE_KEY,
        node_env: process.env.NODE_ENV,
        port: process.env.PORT
      }
    });
  }

  if (pathname.includes('/proxy-audio')) {
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

      const response = await fetch(audioUrl, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const rawBuffer = Buffer.from(arrayBuffer);

      let contentType = response.headers.get('content-type') || 'audio/mpeg';
      if (contentType.includes('octet-stream') || contentType.includes('text/') || contentType.includes('text/html')) {
        contentType = audioUrl.toLowerCase().includes('.wav') ? 'audio/wav' : 'audio/mpeg';
      }

      // Upsample 8kHz telephony WAV to 16kHz for universal mobile/desktop browser compatibility
      let finalBuffer: any = rawBuffer;
      if (contentType.includes('wav') || audioUrl.toLowerCase().includes('.wav') || rawBuffer.toString('ascii', 0, 4) === 'RIFF') {
        contentType = 'audio/wav';
        try {
          finalBuffer = upsample8kTo16k(rawBuffer);
        } catch (convErr) {
          console.warn('WAV upsample error (using raw buffer):', convErr);
        }
      }

      const totalSize = finalBuffer.length;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start >= totalSize || end >= totalSize) {
          res.setHeader('Content-Range', `bytes */${totalSize}`);
          return res.status(416).end();
        }

        const chunk = finalBuffer.subarray(start, end + 1);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', chunk.length.toString());
        return res.status(206).send(chunk);
      } else {
        res.setHeader('Content-Length', totalSize.toString());
        return res.status(200).send(finalBuffer);
      }
    } catch (error: any) {
      console.error('Audio Proxy Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (pathname.includes('/proxy-image')) {
    const imageUrl = req.query.url as string;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      // Robust URL decoding and validation
      let finalUrl = '';
      try {
        const decodedUrl = decodeURIComponent(imageUrl);
        // Ensure it's an absolute URL
        if (decodedUrl.startsWith('http')) {
          finalUrl = decodedUrl;
        } else {
          throw new Error('Invalid URL protocol');
        }
      } catch (e) {
        finalUrl = imageUrl;
      }

      // Handle spaces and special chars in URL
      const urlObj = new URL(finalUrl);
      const targetUrl = urlObj.toString();

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Fix generic or incorrect content types
      if (contentType.includes('octet-stream') || contentType.includes('text/') || contentType.includes('text/html')) {
        const urlLower = targetUrl.toLowerCase();
        if (urlLower.endsWith('.png')) contentType = 'image/png';
        else if (urlLower.endsWith('.webp')) contentType = 'image/webp';
        else if (urlLower.endsWith('.svg')) contentType = 'image/svg+xml';
        else if (urlLower.endsWith('.gif')) contentType = 'image/gif';
        else contentType = 'image/jpeg';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache for static assets

      return res.status(200).send(buffer);
    } catch (error: any) {
      console.error('Image Proxy Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(404).json({ error: 'System action not found' });
}
