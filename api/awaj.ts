
import type { VercelRequest, VercelResponse } from '@vercel/node';
// native fetch used
import FormData from 'form-data';
import { Buffer } from 'node:buffer';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';
const supabase = getSupabaseAdmin();

async function fetchWavDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, (res) => {
        const chunks: Buffer[] = [];
        let totalLength = 0;
        let resolved = false;
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          totalLength += chunk.length;
          // WAV headers are in the first 4096 bytes
          if (totalLength >= 4096) {
            res.destroy();
          }
        });
        
        const finish = () => {
          if (resolved) return;
          resolved = true;
          try {
            const buffer = Buffer.concat(chunks);
            if (buffer.length < 44) {
              resolve(0);
              return;
            }
            
            const sampleRate = buffer.readUInt32LE(24);
            const byteRate = buffer.readUInt32LE(28);
            
            let dataOffset = 12;
            while (dataOffset < buffer.length - 8) {
              const subchunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
              const subchunkSize = buffer.readUInt32LE(dataOffset + 4);
              if (subchunkId === 'data') {
                const durationSec = subchunkSize / byteRate;
                resolve(durationSec);
                return;
              }
              dataOffset += 8 + subchunkSize;
            }
            
            const estDuration = buffer.length / byteRate;
            resolve(estDuration);
          } catch (e) {
            resolve(0);
          }
        };

        res.on('end', finish);
        res.on('close', finish);
        res.on('error', () => {
          if (!resolved) {
            resolved = true;
            resolve(0);
          }
        });
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve(0);
      });

      req.on('error', () => resolve(0));
    } catch (err) {
      resolve(0);
    }
  });
}

async function parseRawMultipart(req: any): Promise<{ fields: Record<string, string>, files: { name: string, filename: string, mime: string, buffer: Buffer }[] }> {
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return { fields: {}, files: [] };
  const boundary = match[1] || match[2];

  let rawBuffer: Buffer;
  if (Buffer.isBuffer(req.body)) {
    rawBuffer = req.body;
  } else if (typeof req.body === 'string') {
    rawBuffer = Buffer.from(req.body, 'utf-8');
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    rawBuffer = Buffer.concat(chunks);
  }

  if (!rawBuffer || rawBuffer.length === 0) return { fields: {}, files: [] };

  const fields: Record<string, string> = {};
  const files: { name: string, filename: string, mime: string, buffer: Buffer }[] = [];

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let start = 0;

  while (start < rawBuffer.length) {
    const boundaryIdx = rawBuffer.indexOf(boundaryBuffer, start);
    if (boundaryIdx === -1) break;

    const nextBoundaryIdx = rawBuffer.indexOf(boundaryBuffer, boundaryIdx + boundaryBuffer.length);
    if (nextBoundaryIdx === -1) break;

    const partBuffer = rawBuffer.subarray(boundaryIdx + boundaryBuffer.length, nextBoundaryIdx);
    start = nextBoundaryIdx;

    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerStr = partBuffer.subarray(0, headerEnd).toString('utf-8');
    let bodyBuffer = partBuffer.subarray(headerEnd + 4);
    if (bodyBuffer.length >= 2 && bodyBuffer[bodyBuffer.length - 2] === 13 && bodyBuffer[bodyBuffer.length - 1] === 10) {
      bodyBuffer = bodyBuffer.subarray(0, bodyBuffer.length - 2);
    }

    const dispositionMatch = headerStr.match(/Content-Disposition:[^\r\n]*/i);
    if (!dispositionMatch) continue;

    const disp = dispositionMatch[0];
    const nameMatch = disp.match(/name="([^"]+)"/i);
    const filenameMatch = disp.match(/filename="([^"]+)"/i);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

    const fieldName = nameMatch ? nameMatch[1] : '';
    const filename = filenameMatch ? filenameMatch[1] : '';
    const mime = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

    if (filename) {
      files.push({ name: fieldName, filename, mime, buffer: bodyBuffer });
    } else if (fieldName) {
      fields[fieldName] = bodyBuffer.toString('utf-8').trim();
    }
  }

  return { fields, files };
}

const getAwajHeaders = () => {
  const token = (process.env.AWAJ_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('AWAJ_API_TOKEN is not set. Please add it to your environment variables in settings.');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const urlPath = url.pathname;
  const parts = urlPath.split('/').filter(Boolean);
  
  // Robust action detection
  let action = '';
  const isDirectRoute = parts.includes('direct');
  if (parts[1] === 'voices' || parts[1] === 'voice') {
    if (parts[2] === 'upload') action = 'upload';
    else if (parts[2] === 'stream' || parts[2] === 'play') action = 'stream';
    else action = 'voices';
  } else if (parts[1] === 'awaj') {
    action = (parts[2] || 'voices').toLowerCase().trim();
    if (parts[3] === 'upload') {
      action = 'upload';
    } else if (parts[3] === 'stream' || parts[2] === 'stream') {
      action = 'stream';
    }
  } else if (parts[1] === 'voice-refund') {
    action = 'voice-refund';
  } else {
    action = (parts[1] || 'voices').toLowerCase().trim();
  }

  // Override with query or body if explicitly provided
  const explicitAction = (req.query.action as string || req.body?.action as string || '').toLowerCase().trim();
  if (explicitAction) {
    action = explicitAction;
  }

  const subAction = parts[3] || parts[2] || (req.query.id as string);
  console.log(`Awaj API: url=${req.url}, parts=${JSON.stringify(parts)}, action="${action}", subAction="${subAction}"`);

  // Ensure body is parsed if it's a string
  if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      console.warn('Failed to parse req.body as JSON in awaj API handler:', e);
    }
  }

  // AUDIO PROXY STREAM (Direct audio streaming without CORS)
  if (action === 'stream' || action === 'proxy-audio') {
    const rawUrl = (req.query.url as string) || (req.body?.url as string) || '';
    const voiceId = (req.query.id as string) || (req.body?.id as string) || '';
    let targetUrl = rawUrl;

    if (!targetUrl && voiceId) {
      try {
        const { data: v } = await supabase.from('voice_templates').select('file_url').eq('id', voiceId).maybeSingle();
        if (v?.file_url) targetUrl = v.file_url;
      } catch (err: any) {
        console.warn('Could not resolve voice_template URL by id:', err.message);
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ error: 'Audio URL or Voice ID is required' });
    }

    if (targetUrl.startsWith('/') || targetUrl.startsWith('voices/') || targetUrl.startsWith('uploads/')) {
      const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
      targetUrl = `https://api.awajdigital.com${cleanPath}`;
    }

    try {
      const audioFetchRes = await fetch(targetUrl);
      if (!audioFetchRes.ok) {
        return res.status(audioFetchRes.status).json({ error: 'Failed to fetch audio stream' });
      }

      const contentType = audioFetchRes.headers.get('content-type') || 'audio/wav';
      const contentLength = audioFetchRes.headers.get('content-length');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      const arrayBuffer = await audioFetchRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (streamErr: any) {
      console.error('Audio stream proxy error:', streamErr);
      return res.status(500).json({ error: streamErr.message });
    }
  }

  try {
    const headers = getAwajHeaders();
    const token = (process.env.AWAJ_API_TOKEN || '').trim();

    // VOICE UPLOAD & MANAGEMENT
    if (action === 'upload' || (action === 'voices' && req.method === 'POST')) {
      const body = req.body || {};

      // Extract uploaded audio file first (needed for fallback name if any)
      let fileBuffer: Buffer | null = null;
      let filename = 'voice.mp3';
      let contentType = 'audio/mpeg';

      // 1. From multer req.file or req.files
      const multerReq = req as any;
      const uploadedFile = multerReq.file || 
        (Array.isArray(multerReq.files) ? multerReq.files[0] : null) || 
        (multerReq.files?.['audio']?.[0] || multerReq.files?.['file']?.[0]);

      if (uploadedFile && uploadedFile.buffer) {
        fileBuffer = uploadedFile.buffer;
        filename = uploadedFile.originalname || 'voice.mp3';
        contentType = uploadedFile.mimetype || 'audio/mpeg';
      } 
      // 2. From base64 string in body
      else if (body.audio_base64 || body.audioBase64 || (typeof body.audio === 'string' && body.audio.startsWith('data:'))) {
        const base64Str = body.audio_base64 || body.audioBase64 || body.audio;
        const matches = base64Str.match(/^data:([A-Za-z-+\/0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          fileBuffer = Buffer.from(matches[2], 'base64');
        } else {
          fileBuffer = Buffer.from(base64Str.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
        }
        filename = body.filename || body.audio_filename || `voice.${contentType.split('/')[1] || 'mp3'}`;
      }
      // 3. From downloadable file_url
      else if (body.file_url) {
        const fileRes = await fetch(body.file_url);
        if (!fileRes.ok) throw new Error(`Failed to download file from url: ${fileRes.statusText}`);
        const arrayBuf = await fileRes.arrayBuffer();
        fileBuffer = Buffer.from(new Uint8Array(arrayBuf));
        contentType = fileRes.headers.get('content-type') || 'audio/mpeg';
        const ext = body.file_url.split('.').pop()?.split('?')[0] || 'mp3';
        filename = `voice.${ext}`;
      }
      // 4. From raw multipart body parser (for Vercel Serverless environment without multer)
      else if (!fileBuffer && (req.headers['content-type'] || '').includes('multipart/form-data')) {
        try {
          const parsed = await parseRawMultipart(req);
          if (parsed.files && parsed.files.length > 0) {
            const firstFile = parsed.files[0];
            fileBuffer = firstFile.buffer;
            filename = firstFile.filename || 'voice.mp3';
            contentType = firstFile.mime || 'audio/mpeg';
          }
          if (parsed.fields) {
            for (const k in parsed.fields) {
              if (!body[k]) body[k] = parsed.fields[k];
            }
          }
        } catch (e) {
          console.warn('Failed to parse raw multipart body:', e);
        }
      }

      // Check header for x-voice-name if passed
      let headerName = '';
      if (req.headers['x-voice-name']) {
        try {
          headerName = decodeURIComponent(req.headers['x-voice-name'] as string);
        } catch (e) {
          headerName = req.headers['x-voice-name'] as string;
        }
      }

      const rawName = 
        body.name || 
        body.voice_name || 
        body.title || 
        body.voiceName || 
        req.query?.name || 
        req.query?.voice_name || 
        req.query?.title || 
        req.query?.voiceName || 
        headerName || 
        (uploadedFile?.originalname ? uploadedFile.originalname.replace(/\.[^/.]+$/, "") : '') ||
        '';

      const voiceName = String(rawName).trim();
      
      if (!voiceName) {
        return res.status(400).json({ message: 'Voice name is required (1-255 characters)' });
      }
      if (voiceName.length > 255) {
        return res.status(400).json({ message: 'Voice name exceeds 255 characters limit' });
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ message: 'Audio file is required. Supported formats: mp3, wav, ogg, m4a, aac, webm, flac' });
      }

      // Check max size (10MB)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (fileBuffer.length > MAX_SIZE) {
        return res.status(413).json({ message: 'File size too large. Maximum allowed size is 10MB' });
      }

      // Extract allowed audio extension and normalize it
      const allowedExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'flac'];
      let rawExt = (filename.split('.').pop() || '').toLowerCase();
      
      // Normalize common aliases
      if (['mpeg', 'mpga', 'mp3'].includes(rawExt)) rawExt = 'mp3';
      else if (['mp4'].includes(rawExt)) rawExt = 'm4a';

      let normalizedExt = rawExt;
      if (!allowedExts.includes(normalizedExt)) {
        // Fallback: inspect MIME type
        const lowerType = (contentType || '').toLowerCase();
        if (lowerType.includes('mpeg') || lowerType.includes('mp3')) normalizedExt = 'mp3';
        else if (lowerType.includes('wav')) normalizedExt = 'wav';
        else if (lowerType.includes('ogg')) normalizedExt = 'ogg';
        else if (lowerType.includes('mp4') || lowerType.includes('m4a')) normalizedExt = 'm4a';
        else if (lowerType.includes('aac')) normalizedExt = 'aac';
        else if (lowerType.includes('webm')) normalizedExt = 'webm';
        else if (lowerType.includes('flac')) normalizedExt = 'flac';
        else normalizedExt = 'mp3'; // default to mp3 for audio
      }

      // Always pass a clean ASCII filename to avoid Unicode/Header parsing issues in PHP/Laravel backend
      const cleanFilename = `voice_${Date.now()}.${normalizedExt}`;

      // Canonical MIME type map required by Awaj Digital / Laravel file validators
      const canonicalMimeMap: Record<string, string> = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        m4a: 'audio/mp4',
        aac: 'audio/aac',
        webm: 'audio/webm',
        flac: 'audio/flac'
      };
      const finalContentType = canonicalMimeMap[normalizedExt] || 'audio/mpeg';

      // Create multipart FormData for Awaj Digital
      const formData = new FormData();
      formData.append('name', voiceName);
      formData.append('audio', fileBuffer, {
        filename: cleanFilename,
        contentType: finalContentType,
        knownLength: fileBuffer.length
      });

      const formHeaders = formData.getHeaders();
      const formBuffer = formData.getBuffer();

      console.log(`Uploading voice to Awaj Digital: name="${voiceName}", filename="${filename}", size=${fileBuffer.length} bytes, formLength=${formBuffer.length}`);

      const response = await fetch(`${AWAJ_BASE_URL}/voices/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Length': formBuffer.length.toString(),
          ...formHeaders
        },
        body: formBuffer as any
      });

      const responseData = await response.json().catch(() => ({}));
      console.log(`Awaj Digital Upload Response Status: ${response.status}`, responseData);

      if (!response.ok) {
        return res.status(response.status).json(responseData);
      }

      // Voice uploaded successfully
      let rawFileUrl = responseData.file_url || responseData.preview_url || responseData.url || (responseData.data && (responseData.data.file_url || responseData.data.url)) || '';
      if (rawFileUrl && !rawFileUrl.startsWith('http') && !rawFileUrl.startsWith('data:')) {
        const cleanPath = rawFileUrl.startsWith('/') ? rawFileUrl : `/${rawFileUrl}`;
        rawFileUrl = `https://api.awajdigital.com${cleanPath}`;
      }

      // Awaj Digital audio URL directly (not stored in Supabase storage as requested)
      const fileUrl = rawFileUrl || '';
      const providerVoiceId = responseData.id || responseData.voice_id || responseData.data?.id || responseData.result?.id || '';
      const providerVoiceName = responseData.name || responseData.title || voiceName;

      let savedTemplate: any = null;
      const targetInstId = body.institution_id || req.query.institution_id;
      if (targetInstId) {
        try {
          const isSuper = body.is_super_admin === true || body.is_super_admin === 'true';
          const isManager = body.is_manager === true || body.is_manager === 'true';
          const initStatus = (isSuper || isManager) ? 'approved' : 'pending';
          const inputDuration = body.duration ? Number(body.duration) : null;
          const { data: dbItem, error: dbErr } = await supabase.from('voice_templates').insert({
            institution_id: targetInstId,
            title: voiceName,
            file_url: fileUrl,
            admin_status: initStatus,
            provider_status: initStatus,
            provider_voice_name: providerVoiceName,
            provider_voice_id: providerVoiceId ? String(providerVoiceId) : null,
            duration: inputDuration
          }).select().single();

          if (dbErr) {
            console.error('Error auto-inserting voice_template in api/awaj:', dbErr);
          } else {
            savedTemplate = dbItem;
            console.log('Successfully saved voice_template:', dbItem.id, 'status:', initStatus, 'url:', fileUrl);
          }
        } catch (dbEx) {
          console.error('Exception inserting voice_template in api/awaj:', dbEx);
        }
      }

      return res.status(201).json({
        ...responseData,
        file_url: fileUrl,
        voice_template: savedTemplate,
        message: 'Voice uploaded successfully'
      });
    }

    // LIST DATABASE VOICE TEMPLATES
    if (action === 'templates' || action === 'list_templates') {
      const instId = (req.query.institution_id || req.body?.institution_id || '') as string;
      const isSuper = req.query.is_super_admin === 'true' || req.body?.is_super_admin === true;
      const isManager = req.query.is_manager === 'true' || req.body?.is_manager === true;

      let query = supabase.from('voice_templates').select('*');
      if (!isSuper && !isManager && instId) {
        query = query.eq('institution_id', instId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, templates: data || [] });
    }

    // VOICES LIST & DELETE
    if (action === 'voices') {
      if (req.method === 'GET') {
        const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: headers as any });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
        }
        const data = await response.json();
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE') {
        const voiceIdToDelete = subAction || (req.query.id as string) || parts[parts.length - 1];
        if (!voiceIdToDelete || voiceIdToDelete === 'voices') {
          return res.status(400).json({ error: 'Voice ID is required for deletion' });
        }
        try {
          const response = await fetch(`${AWAJ_BASE_URL}/voices/${voiceIdToDelete}`, { 
            method: 'DELETE', 
            headers: headers as any 
          });
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.warn(`Awaj API DELETE returned status ${response.status}: ${errorText}`);
            return res.status(200).json({ 
              success: true, 
              warning: `Awaj API returned status ${response.status}`, 
              details: errorText 
            });
          }
          let data = {};
          try { data = await response.json(); } catch (e) {}
          return res.status(200).json({ success: true, ...data });
        } catch (err: any) {
          console.warn('Awaj API DELETE exception:', err.message);
          return res.status(200).json({ success: true, warning: err.message });
        }
      }
    }

    // BROADCAST & DIRECT BROADCAST
    if (action === 'broadcast' || action === 'broadcasts' || action === 'direct' || isDirectRoute) {
      if (req.method === 'POST') {
        const body = req.body || {};

        // 1. Extract audio URLs if passed in voices array, file_url, audio_url, etc.
        let voicesList: string[] = [];
        if (Array.isArray(body.voices) && body.voices.length > 0) {
          voicesList = body.voices.filter((v: any) => typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://')));
        } else if (body.file_url && typeof body.file_url === 'string' && (body.file_url.startsWith('http://') || body.file_url.startsWith('https://'))) {
          voicesList = [body.file_url];
        } else if (body.voice_url && typeof body.voice_url === 'string' && (body.voice_url.startsWith('http://') || body.voice_url.startsWith('https://'))) {
          voicesList = [body.voice_url];
        } else if (typeof body.voice === 'string' && (body.voice.startsWith('http://') || body.voice.startsWith('https://'))) {
          voicesList = [body.voice];
        }

        // Auto-lookup details from Supabase voice_templates if needed
        let dbResolvedVoiceId = body.provider_voice_id || null;
        let dbResolvedVoiceName = body.provider_voice_name || null;
        let dbResolvedTitle = body.title || null;
        let dbResolvedFileUrl: string | null = null;

        const vKey = body.voice_id || body.voice_template_id || body.voice || body.provider_voice_id || body.voice_name || body.title;
        if (vKey) {
          const vKeyStr = String(vKey).trim();
          try {
            const { data: dbVoices } = await supabase
              .from('voice_templates')
              .select('id, file_url, title, provider_voice_name, provider_voice_id, status, admin_status, provider_status')
              .or(`id.eq.${vKeyStr},provider_voice_id.eq.${vKeyStr},title.eq.${vKeyStr},provider_voice_name.eq.${vKeyStr},title.ilike.%${vKeyStr}%,provider_voice_name.ilike.%${vKeyStr}%`)
              .limit(1);
            if (dbVoices && dbVoices[0]) {
              const matched = dbVoices[0];
              if (matched.file_url && matched.file_url.trim().startsWith('http')) {
                dbResolvedFileUrl = matched.file_url.trim();
                if (voicesList.length === 0) {
                  voicesList = [matched.file_url.trim()];
                }
                console.log('Auto-resolved voice audio URL from database:', matched.file_url);
              }
              if (matched.provider_voice_id) {
                dbResolvedVoiceId = matched.provider_voice_id;
              }
              if (matched.provider_voice_name) {
                dbResolvedVoiceName = matched.provider_voice_name;
              }
              if (matched.title) {
                dbResolvedTitle = matched.title;
              }
            }
          } catch (err: any) {
            console.warn('Error resolving voice details from database:', err.message);
          }
        }

        // Live resolution from Awaj Digital /voices list:
        const voiceCandidates = [
          body.provider_voice_name,
          dbResolvedVoiceName,
          body.voice_name,
          body.title,
          dbResolvedTitle,
          body.voice,
          dbResolvedVoiceId,
          body.provider_voice_id,
          body.voice_id,
          vKey
        ].filter(Boolean).map(x => String(x).trim());

        let awajMatchedVoiceName: string | null = null;
        let awajMatchedVoiceId: string | null = null;
        let awajVoiceList: any[] = [];

        try {
          const token = (process.env.AWAJ_API_TOKEN || '').trim();
          if (token) {
            const awajRes = await fetch(`${AWAJ_BASE_URL}/voices`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            if (awajRes.ok) {
              const awajData = await awajRes.json();
              awajVoiceList = Array.isArray(awajData) ? awajData : (awajData.voices || awajData.data || []);
              
              // 1. Try match by numeric ID first (e.g. 3592, 4731)
              for (const c of voiceCandidates) {
                const foundById = awajVoiceList.find((v: any) => v.id?.toString() === c);
                if (foundById && foundById.name) {
                  awajMatchedVoiceName = foundById.name;
                  awajMatchedVoiceId = foundById.id?.toString();
                  if (foundById.previewUrl && voicesList.length === 0) {
                    voicesList = [foundById.previewUrl];
                  }
                  break;
                }
              }

              // 2. Try match by exact name or name without extension (e.g. DNRA0148 vs DNRA0148.wav)
              if (!awajMatchedVoiceName) {
                for (const c of voiceCandidates) {
                  const cleanC = c.replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '').toLowerCase();
                  const foundByName = awajVoiceList.find((v: any) => {
                    const cleanVName = (v.name || '').replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '').toLowerCase();
                    return cleanVName === cleanC || (v.name && v.name.toLowerCase() === c.toLowerCase());
                  });
                  if (foundByName && foundByName.name) {
                    awajMatchedVoiceName = foundByName.name;
                    awajMatchedVoiceId = foundByName.id?.toString();
                    if (foundByName.previewUrl && voicesList.length === 0) {
                      voicesList = [foundByName.previewUrl];
                    }
                    break;
                  }
                }
              }

              // 3. Try partial substring match (excluding pure digits)
              if (!awajMatchedVoiceName) {
                for (const c of voiceCandidates) {
                  if (/^\d+$/.test(c)) continue;
                  const foundByPartial = awajVoiceList.find((v: any) => 
                    (v.name && v.name.toLowerCase().includes(c.toLowerCase())) || 
                    (c.toLowerCase().includes((v.name || '').toLowerCase()))
                  );
                  if (foundByPartial && foundByPartial.name) {
                    awajMatchedVoiceName = foundByPartial.name;
                    awajMatchedVoiceId = foundByPartial.id?.toString();
                    if (foundByPartial.previewUrl && voicesList.length === 0) {
                      voicesList = [foundByPartial.previewUrl];
                    }
                    break;
                  }
                }
              }
            }
          }
        } catch (e: any) {
          console.warn('Live voice URL resolution failed in awaj broadcast handler:', e.message);
        }

        // Determine effective voice name:
        let effectiveVoiceKey = awajMatchedVoiceName;
        if (!effectiveVoiceKey) {
          const nonNumeric = voiceCandidates.find(c => !/^\d+$/.test(c) && !c.startsWith('http'));
          effectiveVoiceKey = nonNumeric || dbResolvedVoiceName || body.provider_voice_name || body.voice_name || body.title || (vKey ? String(vKey) : '');
        }

        console.log(`Resolved Awaj Voice for broadcast: effectiveVoiceKey="${effectiveVoiceKey}", awajMatchedVoiceName="${awajMatchedVoiceName}", awajMatchedVoiceId="${awajMatchedVoiceId}", audioCount=${voicesList.length}`);

        // 2. Generate unique request_id (16-64 chars required by Awaj API)
        let requestId = (body.request_id || body.requestId || '').toString().trim();
        if (!requestId || requestId.length < 16) {
          const randomSuffix = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
          requestId = `direct_${Date.now()}_${randomSuffix}`.substring(0, 64);
        }

        // 3. Format sender number (must be active Awaj sender callingNumber, e.g., 09610993084)
        let senderNum = (body.sender || body.sender_id || body.caller_id || '').toString().trim();
        if (senderNum.startsWith('88096')) {
          senderNum = senderNum.replace(/^88/, '');
        }
        if (senderNum === '83' || senderNum === '8809610993084') {
          senderNum = '09610993084';
        } else if (senderNum === '1' || senderNum === '8809606990198') {
          senderNum = '09606990198';
        } else if (!senderNum.startsWith('096')) {
          senderNum = '09610993084';
        }

        const phoneNumbers = body.phone_numbers || [];

        // 4. Try Direct Broadcast API if direct route requested or audio file URL is available
        const audioUrl = voicesList.length > 0 ? voicesList[0] : dbResolvedFileUrl;

        // Try standard broadcast first if we have a resolved voice name
        if (effectiveVoiceKey && !isDirectRoute && !body.direct) {
          const stdPayload = {
            request_id: requestId,
            sender: senderNum,
            phone_numbers: phoneNumbers,
            voice: effectiveVoiceKey
          };

          console.log(`Attempting Awaj Standard Broadcast: request_id="${requestId}", sender="${senderNum}", voice="${effectiveVoiceKey}", phones=${phoneNumbers.length}`);

          const stdResponse = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
            method: 'POST',
            headers: headers as any,
            body: JSON.stringify(stdPayload)
          });

          const stdData = await stdResponse.json().catch(() => ({}));
          console.log(`Awaj Standard Broadcast Status: ${stdResponse.status}`, stdData);

          if (stdResponse.ok) {
            return res.status(200).json(stdData);
          }

          // If standard broadcast failed with 'Voice not found or not approved', attempt auto-recovery:
          console.warn(`Standard broadcast failed (${stdResponse.status}): ${stdData.message || stdData.error}`);

          // A) Try Direct Broadcast with audio URL (Approved Direct API)
          if (audioUrl && audioUrl.startsWith('http')) {
            console.log('Attempting Approved Direct Broadcast fallback with audio URL:', audioUrl);
            try {
              const directPayload = {
                request_id: requestId,
                sender: senderNum,
                phone_numbers: phoneNumbers,
                voices: [audioUrl],
                metadata: { voice_key: effectiveVoiceKey, timestamp: Date.now() }
              };
              const directRes = await fetch(`${AWAJ_BASE_URL}/broadcasts/direct`, {
                method: 'POST',
                headers: headers as any,
                body: JSON.stringify(directPayload)
              });
              const directData = await directRes.json().catch(() => ({}));
              console.log(`Awaj Direct Broadcast Fallback Status: ${directRes.status}`, directData);
              if (directRes.ok) {
                return res.status(200).json(directData);
              }
            } catch (dErr: any) {
              console.warn('Direct broadcast fallback notice:', dErr.message);
            }

            // B) Auto-upload and sync voice audio directly to Awaj Digital
            try {
              console.log(`Auto-uploading audio to Awaj server with name "${effectiveVoiceKey}"...`);
              const downloadRes = await fetch(audioUrl);
              if (downloadRes.ok) {
                const audioBuffer = Buffer.from(await downloadRes.arrayBuffer());
                const formData = new FormData();
                formData.append('name', effectiveVoiceKey);
                formData.append('audio', audioBuffer, {
                  filename: `${effectiveVoiceKey}.mp3`,
                  contentType: 'audio/mpeg',
                  knownLength: audioBuffer.length
                });
                const formHeaders = formData.getHeaders();
                const formBuffer = formData.getBuffer();
                const upRes = await fetch(`${AWAJ_BASE_URL}/voices/upload`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${(process.env.AWAJ_API_TOKEN || '').trim()}`,
                    'Accept': 'application/json',
                    'Content-Length': formBuffer.length.toString(),
                    ...formHeaders
                  },
                  body: formBuffer as any
                });
                const upData = await upRes.json().catch(() => ({}));
                console.log(`Auto-upload to Awaj response (${upRes.status}):`, upData);
                
                // Retry standard broadcast now that voice is uploaded
                const retryStdRes = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
                  method: 'POST',
                  headers: headers as any,
                  body: JSON.stringify({
                    request_id: `retry_${requestId}`.substring(0, 64),
                    sender: senderNum,
                    phone_numbers: phoneNumbers,
                    voice: effectiveVoiceKey
                  })
                });
                const retryData = await retryStdRes.json().catch(() => ({}));
                if (retryStdRes.ok) {
                  return res.status(200).json(retryData);
                }
              }
            } catch (autoUpErr: any) {
              console.warn('Auto-upload fallback notice:', autoUpErr.message);
            }
          }

          // C) Try alternative candidate names from list
          for (const cand of voiceCandidates) {
            if (cand && cand !== effectiveVoiceKey && !/^\d+$/.test(cand) && !cand.startsWith('http')) {
              try {
                console.log(`Trying alternative candidate voice key "${cand}"...`);
                const altRes = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
                  method: 'POST',
                  headers: headers as any,
                  body: JSON.stringify({
                    request_id: `alt_${requestId}`.substring(0, 64),
                    sender: senderNum,
                    phone_numbers: phoneNumbers,
                    voice: cand
                  })
                });
                const altData = await altRes.json().catch(() => ({}));
                if (altRes.ok) {
                  return res.status(200).json(altData);
                }
              } catch {}
            }
          }

          let errorMsg = stdData.message || stdData.error || 'Failed to send broadcast via Awaj API';
          if (stdData.message === 'Voice not found or not approved') {
            errorMsg = `ভয়েস "${effectiveVoiceKey}" Awaj Digital সার্ভারে পাওয়া যায়নি বা এখনো অনুমোদিত হয়নি। দয়া করে Voice ব্রডকাস্ট পেইজ থেকে ভয়েসটি নির্বাচন বা রি-আপলোড করুন।`;
          }
          return res.status(stdResponse.status).json({
            ...stdData,
            error: errorMsg
          });
        }

        // 5. Try Direct Broadcast API if direct route explicitly requested or custom audio URLs
        if (voicesList.length > 0 || isDirectRoute || action === 'direct' || body.direct) {
          const directPayload: any = {
            request_id: requestId,
            sender: senderNum,
            phone_numbers: phoneNumbers,
            voices: voicesList.length > 0 ? voicesList : (body.voices || [audioUrl]),
            metadata: body.metadata || { campaign_id: `direct_broadcast_${Date.now()}` }
          };

          console.log(`Sending Awaj Direct Broadcast API: request_id="${requestId}", sender="${senderNum}", phones=${phoneNumbers.length}, voices=${JSON.stringify(directPayload.voices)}`);

          const directResponse = await fetch(`${AWAJ_BASE_URL}/broadcasts/direct`, {
            method: 'POST',
            headers: headers as any,
            body: JSON.stringify(directPayload)
          });

          const directData = await directResponse.json().catch(() => ({}));
          console.log(`Awaj Direct Broadcast API Status: ${directResponse.status}`, directData);

          if (directResponse.ok) {
            return res.status(200).json(directData);
          }

          // Fallback to standard broadcast endpoint
          if (effectiveVoiceKey) {
            console.log('Falling back to standard Awaj Broadcast endpoint with voice key:', effectiveVoiceKey);
            const stdPayload = {
              request_id: requestId,
              sender: senderNum,
              phone_numbers: phoneNumbers,
              voice: effectiveVoiceKey
            };

            const stdResponse = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
              method: 'POST',
              headers: headers as any,
              body: JSON.stringify(stdPayload)
            });
            const stdData = await stdResponse.json().catch(() => ({}));
            if (!stdResponse.ok) return res.status(stdResponse.status).json(stdData);
            return res.status(200).json(stdData);
          }

          return res.status(directResponse.status).json(directData);
        }

        // Standard Broadcast final fallback
        const stdPayload = {
          request_id: requestId,
          sender: senderNum,
          phone_numbers: body.phone_numbers || [],
          voice: effectiveVoiceKey
        };

        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, { 
          method: 'POST', 
          headers: headers as any, 
          body: JSON.stringify(stdPayload) 
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'GET') {
        if (subAction) {
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}/result`, { headers: headers });
          if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}`, { headers: headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
          }
          const data = await response.json();
          return res.status(200).json(data);
        } else {
          const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, { headers: headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
          }
          const data = await response.json();
          return res.status(200).json(data);
        }
      }
    }

    // BROADCAST-RESULT (legacy or direct)
    if (action === 'broadcast-result') {
      const id = req.query.id || subAction;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}/result`, { headers: headers });
      if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}`, { headers: headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
      }
      const data = await response.json();
      return res.status(200).json(data);
    }

    // BALANCE
    if (action === 'balance') {
      try {
        const response = await fetch(`${AWAJ_BASE_URL}/balance`, { headers: headers as any });
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.warn(`Awaj Balance API returned status ${response.status}: ${errorText}`);
          return res.status(200).json({ success: false, balance: 0, error: `Awaj API (${response.status}): ${errorText}` });
        }
        const data = await response.json();
        return res.status(200).json(data);
      } catch (err: any) {
        console.warn('Awaj Balance API exception:', err.message);
        return res.status(200).json({ success: false, balance: 0, error: err.message });
      }
    }

    // SENDERS
    if (action === 'senders') {
      const response = await fetch(`${AWAJ_BASE_URL}/senders`, { headers: headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
      }
      
      const rawData = await response.json();
      let sendersList = Array.isArray(rawData) ? rawData : (rawData.senders || rawData.data || []);
      
      // Keep only valid senders, hiding 98 and keeping 84
      sendersList = sendersList.filter((s: any) => {
        const num = String(s.callingNumber || s.caller_id || s.id || '');
        if (num.endsWith('98')) return false;
        return num.endsWith('84') || num.length > 5;
      });
      
      // Ensure the correct structure is returned
      const finalData = Array.isArray(rawData) ? sendersList : { ...rawData, data: sendersList, senders: sendersList };

      return res.status(200).json(finalData);
    }

    // SURVEYS
    if (action === 'surveys') {
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/surveys`, { 
          method: 'POST', 
          headers: headers, 
          body: JSON.stringify(req.body) 
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Awaj API Error (${response.status}): ${response.statusText || errorText}`);
        }
        const data = await response.json();
        return res.status(200).json(data);
      }
    }

    // VOICE-REFUND (Consolidated from /api/voice-refund.ts)
    if (action === 'voice-refund' || action === 'refund') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Unauthorized: Missing token' });
        
        const token = authHeader.replace('Bearer ', '').trim();
        if (!token || token === 'undefined' || token === 'null') {
          return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        let user: any = null;
        let userId: string = '';

        try {
          const { data: userData } = await supabase.auth.getUser(token);
          if (userData?.user) {
            user = userData.user;
            userId = user.id;
          }
        } catch (e) {}

        if (!user) {
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
              if (payload && payload.sub) {
                userId = payload.sub;
                user = { id: userId };
              }
            }
          } catch (jwtErr) {}
        }

        if (!user || !userId) {
          return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        const broadcastId = req.body.broadcast_id || req.body.broadcastId;
        const campaignId = req.body.campaign_id || req.body.campaignId;
        const providedInstitutionId = req.body.institution_id || req.body.institutionId;

        if (!broadcastId) {
          return res.status(400).json({ error: 'Broadcast ID is required' });
        }

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('institution_id, role')
          .eq('id', user.id)
          .single();

        // 1. Fetch broadcast details directly by broadcastId
        const { data: broadcast, error: broadcastErr } = await supabase
          .from('voice_broadcasts')
          .select('*')
          .eq('id', broadcastId)
          .single();

        if (broadcastErr || !broadcast) {
          console.error('Broadcast fetch error:', broadcastErr);
          return res.status(404).json({ error: 'Broadcast not found' });
        }

        const deterministicId = crypto.randomUUID();

        // Safe lookup of voice template duration (fetching WAV format dynamically if null)
        let templateDuration = 0;
        if (broadcast.voice_template_id) {
          const { data: vTemp } = await supabase
            .from('voice_templates')
            .select('duration, file_url')
            .eq('id', broadcast.voice_template_id)
            .maybeSingle();
          if (vTemp?.duration) {
            templateDuration = Number(vTemp.duration) || 0;
          } else if (vTemp?.file_url) {
            try {
              const fetchedDuration = await fetchWavDuration(vTemp.file_url);
              if (fetchedDuration > 0) {
                templateDuration = Math.ceil(fetchedDuration);
                await supabase
                  .from('voice_templates')
                  .update({ duration: templateDuration })
                  .eq('id', broadcast.voice_template_id);
              }
            } catch (err) {
              console.error('Error fetching wav duration on-the-fly:', err);
            }
          }
        }

        const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'manager';
        const userInstId = profile?.institution_id;

        if (!isSuperAdmin && userInstId !== broadcast.institution_id) {
          return res.status(403).json({ error: 'Forbidden: Access denied to this broadcast' });
        }

        const institutionId = broadcast.institution_id;

        const { data: institution, error: instErr } = await supabase
          .from('institutions')
          .select('balance, voice_rate')
          .eq('id', institutionId)
          .single();
        
        if (instErr || !institution) {
          console.error('Institution fetch error:', instErr);
          return res.status(404).json({ error: 'Institution not found' });
        }

        const targetCampaignId = campaignId || broadcast.provider_campaign_id;

        // Resolve all campaign runs for this broadcast (main run + all retries)
        const allCampaignIds = [broadcast.provider_campaign_id, ...(broadcast.retries || [])].filter(id => !!id);
        if (allCampaignIds.length === 0) {
          return res.status(400).json({ error: 'No provider campaign IDs found to process' });
        }

        const { data: sysSettings } = await supabase
          .from('system_settings')
          .select('voice_rate')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();

        const voiceRate = Number(institution.voice_rate || sysSettings?.voice_rate || 0.45);
        const totalSentOriginal = Math.max(1, Number(broadcast.total_numbers || 1));
        const estimatedCostOriginal = Number(broadcast.estimated_cost || (totalSentOriginal * voiceRate));
        const prevRefund = Number(broadcast.refunded_amount || 0);

        // Maximum pulses a single call can ever consume based on the audio template length
        const maxPulsesForThisAudio = (templateDuration > 0 && templateDuration > 30) ? Math.min(2, Math.ceil(templateDuration / 30)) : 1;
        // In the database/UI, each call is charged strictly based on getPulsesForVoice:
        const chargedPulsesPerCall = maxPulsesForThisAudio;
        const costPerPulse = voiceRate;

        const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up', 'connected', 'complete', 'finished', 'finished_success', 'picked up'];
        const failureStatuses = [
          'failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 
          'unanswered', 'timeout', 'no-answer', 'abandoned', 'not_answered', 'notanswered', 
          'notpicked', 'not_picked', 'missed', 'blocked', 'unavailable', 'not answered', 'not picked',
          'no-picked', 'no_picked', 'noanswer', 'not-picked', 'reject', 'declined', 'failed-retry', 'failed_retry',
          'no picked', 'no answered', 'no answer', 'not pick', 'not-pickedup', 'not_pickedup'
        ];

        const extractLogs = (details: any) => {
          if (!details) return [];
          if (Array.isArray(details)) return details;
          if (details.calls && Array.isArray(details.calls)) return details.calls;
          if (details.logs && Array.isArray(details.logs)) return details.logs;
          if (details.recipients && Array.isArray(details.recipients)) return details.recipients;
          if (details.data && Array.isArray(details.data)) return details.data;
          if (details.results && Array.isArray(details.results)) return details.results;
          if (details.details && Array.isArray(details.details)) return details.details;
          if (details.broadcast?.calls && Array.isArray(details.broadcast.calls)) return details.broadcast.calls;
          if (details.broadcast?.logs && Array.isArray(details.broadcast.logs)) return details.broadcast.logs;
          
          for (const key in details) {
            if (Array.isArray(details[key]) && details[key].length > 0 && typeof details[key][0] === 'object') {
              const firstItem = details[key][0];
              if (firstItem.phone || firstItem.number || firstItem.to || firstItem.msisdn || firstItem.recipient || firstItem.mobile || firstItem.destination) {
                return details[key];
              }
            }
          }
          return [];
        };

        let totalOverallRefundPulses = 0;
        let anyLogsFound = false;

        for (const campId of allCampaignIds) {
          try {
            let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${campId}/result`, { headers: headers as any });
            if (response.status === 404) {
              response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${campId}`, { headers: headers as any });
            }

            if (!response.ok) {
              console.warn(`Campaign ${campId} logs fetch failed: ${response.statusText}`);
              continue;
            }

            const resultData = await response.json() as any;
            const campaignLogs = extractLogs(resultData);

            if (!campaignLogs || campaignLogs.length === 0) {
              continue;
            }

            anyLogsFound = true;
            let campaignRefundPulses = 0;

            campaignLogs.forEach((log: any) => {
              const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
              const rawDuration = log.duration ?? log.billsec ?? log.duration_sec ?? log.talking_time ?? log.seconds ?? log.duration_seconds ?? log.call_duration ?? log.answer_duration ?? 0;
              const duration = Number(rawDuration) || 0;

              const isFailedStatus = failureStatuses.includes(status) || status.includes('not picked') || status.includes('not answered') || status.includes('no answer');
              const isSuccessStatus = successStatuses.includes(status);

              if (isSuccessStatus || duration > 0) {
                let pulsesUsed = 1;
                if (duration > 0 && templateDuration > 30) {
                  pulsesUsed = Math.min(2, Math.ceil(duration / 30));
                }
                if (pulsesUsed > maxPulsesForThisAudio) pulsesUsed = maxPulsesForThisAudio;
                if (pulsesUsed > chargedPulsesPerCall) pulsesUsed = chargedPulsesPerCall;

                const refundPulsesForThisCall = Math.max(0, chargedPulsesPerCall - pulsesUsed);
                campaignRefundPulses += refundPulsesForThisCall;
              } else if (isFailedStatus) {
                campaignRefundPulses += chargedPulsesPerCall;
              } else if (!['pending', 'sending', 'processing', 'queued'].includes(status)) {
                campaignRefundPulses += chargedPulsesPerCall;
              }
            });

            const isOriginal = String(campId) === String(broadcast.provider_campaign_id);
            const apiTotal = Number(resultData.total || resultData.broadcast?.total || resultData.broadcast?.total_numbers || resultData.broadcast?.recipient_count || resultData.data?.total || resultData.stats?.total || 0);

            let campaignTotalSent = 0;
            if (apiTotal > campaignLogs.length) {
              campaignTotalSent = apiTotal;
            } else if (isOriginal) {
              campaignTotalSent = Math.max(campaignLogs.length, totalSentOriginal);
            } else {
              campaignTotalSent = campaignLogs.length;
            }

            if (isOriginal && campaignTotalSent > totalSentOriginal) {
              campaignTotalSent = totalSentOriginal;
            }

            const isFinished = ['completed', 'done', 'success', 'complete', 'finished', 'failed', 'error', 'cancelled'].includes(String(broadcast.status || '').toLowerCase());
            if (isFinished) {
              const droppedCalls = Math.max(0, campaignTotalSent - campaignLogs.length);
              campaignRefundPulses += (droppedCalls * chargedPulsesPerCall);
            }

            const maxPossibleRefundPulses = campaignTotalSent * chargedPulsesPerCall;
            if (campaignRefundPulses > maxPossibleRefundPulses) {
              campaignRefundPulses = maxPossibleRefundPulses;
            }

            console.log(`Campaign ${campId}: Total sent: ${campaignTotalSent}, Logs: ${campaignLogs.length}, Refund pulses: ${campaignRefundPulses}`);
            totalOverallRefundPulses += campaignRefundPulses;

          } catch (campErr) {
            console.error(`Error calculating refund for campaign ${campId}:`, campErr);
          }
        }

        if (!anyLogsFound) {
          return res.status(200).json({ 
            success: true, 
            message: 'No call logs found yet. Please wait until broadcast is fully completed.',
            refund_amount: 0
          });
        }

        const calculatedRefund = Number((totalOverallRefundPulses * costPerPulse).toFixed(2));

        // IF prevRefund is higher than calculatedRefund, perform auto-correction (deduct excess)
        // This is safe to run now because background polling is restricted to once per completed campaign
        if (prevRefund > (calculatedRefund + 0.01)) {
          const excessRefund = Number((prevRefund - calculatedRefund).toFixed(2));
          if (excessRefund > 0) {
            const { data: inst } = await supabase
              .from('institutions')
              .select('balance')
              .eq('id', institutionId)
              .single();

            if (inst) {
              const currentBal = Number(inst.balance || 0);
              const newBal = Math.max(0, Number((currentBal - excessRefund).toFixed(2)));
              await supabase.from('institutions').update({ balance: newBal }).eq('id', institutionId);

              await supabase.from('transactions').insert({
                institution_id: institutionId,
                amount: excessRefund,
                transaction_id: `CORRECT_VOICE_${broadcast.id.slice(0, 8)}_${Date.now()}`,
                sender_phone: 'SYSTEM',
                description: `Voice refund auto-correction: Deducted ${excessRefund} ৳ excess refund`,
                type: 'debit',
                status: 'approved',
                module: 'voice'
              });
            }

            await supabase.from('voice_broadcasts').update({
              refunded_amount: calculatedRefund,
              is_refunded: calculatedRefund >= (estimatedCostOriginal - 0.01)
            }).eq('id', broadcast.id);

            return res.status(200).json({
              success: true,
              corrected: true,
              refund_amount: calculatedRefund,
              actual_cost: Number((estimatedCostOriginal - calculatedRefund).toFixed(2)),
              message: `Corrected excess refund from ${prevRefund} ৳ to ${calculatedRefund} ৳`
            });
          }
        }

        // IF prevRefund is equal to calculatedRefund (or within 0.01 range), treat as already fully refunded
        if (Math.abs(prevRefund - calculatedRefund) <= 0.01) {
          await supabase.from('voice_broadcasts').update({
            is_refunded: true
          }).eq('id', broadcast.id);

          return res.status(200).json({
            success: true,
            already_refunded: true,
            refund_amount: prevRefund,
            actual_cost: Number((estimatedCostOriginal - prevRefund).toFixed(2)),
            message: `Sufficiently refunded (${prevRefund} ৳ credited previously)`
          });
        }

        // IF calculatedRefund is GREATER than prevRefund, process additional refund
        if (calculatedRefund > (prevRefund + 0.01)) {
          const additionalRefund = Number((calculatedRefund - prevRefund).toFixed(2));
          
          try {
            const { error: rpcErr } = await supabase.rpc('add_balance', {
              p_institution_id: institutionId,
              p_amount: additionalRefund
            });
            if (rpcErr) throw rpcErr;
          } catch (err) {
            const { data: inst } = await supabase.from('institutions').select('balance').eq('id', institutionId).single();
            if (inst) {
              const newBal = Number((Number(inst.balance || 0) + additionalRefund).toFixed(2));
              await supabase.from('institutions').update({ balance: newBal }).eq('id', institutionId);
            }
          }

          await supabase.from('transactions').insert({
            institution_id: institutionId,
            amount: additionalRefund,
            transaction_id: `ADD_REFUND_${targetCampaignId}_${Date.now()}`,
            sender_phone: 'SYSTEM',
            description: `Voice refund adjustment: Credited ${additionalRefund} ৳ additional refund`,
            type: 'credit',
            status: 'approved',
            module: 'voice'
          });

          await supabase.from('voice_broadcasts').update({
            refunded_amount: calculatedRefund,
            is_refunded: calculatedRefund >= (estimatedCostOriginal - 0.01)
          }).eq('id', broadcast.id);

          return res.status(200).json({
            success: true,
            updated: true,
            refund_amount: calculatedRefund,
            actual_cost: Number((estimatedCostOriginal - calculatedRefund).toFixed(2)),
            message: `Updated refund to ${calculatedRefund} ৳`
          });
        }

        // Check if transaction already exists for this campaign
        const refundTxId = `REFUND_CAMP_${targetCampaignId}`;
        const { data: existingRefund } = await supabase
          .from('transactions')
          .select('id')
          .eq('transaction_id', refundTxId)
          .maybeSingle();

        if (existingRefund) {
          return res.status(200).json({ 
            success: true, 
            already_refunded: true, 
            message: 'Refund already processed for this campaign', 
            refund_amount: prevRefund,
            actual_cost: Number((estimatedCostOriginal - prevRefund).toFixed(2))
          });
        }

        // Maximum refund can NEVER exceed the remaining charged amount for this broadcast
        const maxRefundAllowed = Math.max(0, Number((estimatedCostOriginal - prevRefund).toFixed(2)));

        if (maxRefundAllowed <= 0 || broadcast.is_refunded) {
          return res.status(200).json({ 
            success: true, 
            already_refunded: true, 
            message: 'Refund already processed for this campaign', 
            refund_amount: 0 
          });
        }

        const refundAmount = Number(Math.min(calculatedRefund, maxRefundAllowed).toFixed(2));

        if (refundAmount <= 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No unreceived calls or pulse refunds detected.', 
            refund_amount: 0
          });
        }

        const txData: any = {
          id: deterministicId,
          institution_id: institutionId,
          amount: refundAmount,
          transaction_id: refundTxId,
          sender_phone: 'SYSTEM',
          description: `Refund for ${totalOverallRefundPulses} unreceived calls / unused pulses (Voice Broadcast)`,
          type: 'credit',
          status: 'approved',
          module: 'voice',
          sms_count: 0
        };

        const { error: txError } = await supabase.from('transactions').insert(txData);

        if (txError) {
          if (txError.message?.toLowerCase().includes('duplicate') || txError.code === '23505') {
            return res.status(200).json({ success: true, already_refunded: true, message: 'Refund already processed for this campaign' });
          }
          throw txError;
        }

        const { error: addBalanceErr } = await supabase.rpc('add_balance', {
          p_institution_id: institutionId,
          p_amount: refundAmount
        });

        if (addBalanceErr) {
           const currentBalance = Number(institution.balance || 0);
           const newBalance = Number((currentBalance + refundAmount).toFixed(2));
           await supabase.from('institutions').update({ balance: newBalance }).eq('id', institutionId);
        }

        const newRefundTotal = Number((prevRefund + refundAmount).toFixed(2));
        const isFullyRefunded = newRefundTotal >= (estimatedCostOriginal - 0.01);
        await supabase.from('voice_broadcasts').update({
          refunded_amount: newRefundTotal,
          is_refunded: isFullyRefunded
        }).eq('id', broadcast.id);

        return res.status(200).json({ 
          success: true, 
          refunded_calls: totalOverallRefundPulses,
          refunded_pulses: totalOverallRefundPulses,
          refund_amount: refundAmount,
          message: `Successfully refunded ${refundAmount} ৳` 
        });
      } catch (error: any) {
        console.error('Voice Refund Error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // WEBHOOK
    if (action === 'webhook') {
      if (req.method === 'POST') {
        console.log('Received webhook:', req.body);
        return res.status(200).json({ received: true });
      }
    }

    console.log(`Awaj API: Action not found or not matched: "${action}" (Path: ${req.url})`);
    return res.status(404).json({ error: `Action not found: ${action}` });
  } catch (error: any) {
    console.error(`Awaj API error (${action}):`, error);
    res.status(500).json({ error: error.message });
  }
}
