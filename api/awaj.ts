
import type { VercelRequest, VercelResponse } from '@vercel/node';
// native fetch used
import FormData from 'form-data';
import { Buffer } from 'node:buffer';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';
const supabase = getSupabaseAdmin();

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
    action = parts[2] === 'upload' ? 'upload' : 'voices';
  } else if (parts[1] === 'awaj') {
    action = (parts[2] || 'voices').toLowerCase().trim();
    if (parts[3] === 'upload') {
      action = 'upload';
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

      // Voice uploaded - set status to approved for auto-approval
      return res.status(201).json({
        ...responseData,
        status: 'approved',
        provider_status: 'approved',
        message: responseData.message || 'Voice uploaded and auto-approved successfully'
      });
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
        // Auto-approve voice list items so all uploaded voices show as approved in UI
        const mapApproved = (v: any) => ({
          ...v,
          status: 'approved',
          provider_status: 'approved'
        });

        if (Array.isArray(data)) {
          return res.status(200).json(data.map(mapApproved));
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.voices)) {
            data.voices = data.voices.map(mapApproved);
          }
          if (Array.isArray(data.data)) {
            data.data = data.data.map(mapApproved);
          }
          if (Array.isArray(data.result)) {
            data.result = data.result.map(mapApproved);
          }
          return res.status(200).json(data);
        }
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

        // Auto-lookup file_url from Supabase voice_templates if voicesList is empty
        if (voicesList.length === 0) {
          const vKey = body.voice_id || body.voice_template_id || body.voice;
          if (vKey) {
            const vKeyStr = String(vKey).trim();
            try {
              const { data: dbVoices } = await supabase
                .from('voice_templates')
                .select('file_url, title, provider_voice_name')
                .or(`id.eq.${vKeyStr},provider_voice_id.eq.${vKeyStr},title.eq.${vKeyStr},provider_voice_name.eq.${vKeyStr}`)
                .limit(1);
              if (dbVoices && dbVoices[0] && dbVoices[0].file_url) {
                const url = dbVoices[0].file_url.trim();
                if (url.startsWith('http://') || url.startsWith('https://')) {
                  voicesList = [url];
                  console.log('Auto-resolved voice audio URL from database:', url);
                }
              }
            } catch (err: any) {
              console.warn('Error resolving voice URL from database:', err.message);
            }
          }
        }

        // 2. Generate unique request_id (16-64 chars required by Awaj Direct API)
        let requestId = (body.request_id || body.requestId || '').toString().trim();
        if (!requestId || requestId.length < 16) {
          const randomSuffix = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
          requestId = `direct_${Date.now()}_${randomSuffix}`.substring(0, 64);
        }

        // 3. Format sender number (e.g., 8809610993084 or 8801XXXXXXXXX)
        let senderNum = (body.sender || body.sender_id || body.caller_id || '').toString().trim();
        const digits = senderNum.replace(/[^0-9]/g, '');
        if (digits.length === 11 && digits.startsWith('01')) {
          senderNum = '88' + digits;
        } else if (digits.length === 13 && digits.startsWith('8801')) {
          senderNum = digits;
        } else if (digits.length === 10 && digits.startsWith('1')) {
          senderNum = '880' + digits;
        }

        // 4. Try Direct Broadcast API if audio URLs are available or direct route explicitly called
        if (voicesList.length > 0 || isDirectRoute || action === 'direct' || body.direct) {
          const directPayload: any = {
            request_id: requestId,
            sender: senderNum,
            phone_numbers: body.phone_numbers || [],
            voices: voicesList.length > 0 ? voicesList : (body.voices || []),
            metadata: body.metadata || { campaign_id: `direct_broadcast_${Date.now()}` }
          };

          console.log(`Sending Awaj Direct Broadcast API: request_id="${requestId}", sender="${senderNum}", phone_count=${(directPayload.phone_numbers || []).length}, voices=${JSON.stringify(voicesList)}`);

          try {
            const directResponse = await fetch(`${AWAJ_BASE_URL}/broadcasts/direct`, {
              method: 'POST',
              headers: headers as any,
              body: JSON.stringify(directPayload)
            });

            const directData = await directResponse.json().catch(() => ({}));
            console.log(`Awaj Direct Broadcast API Response Status: ${directResponse.status}`, directData);

            if (directResponse.ok) {
              return res.status(200).json(directData);
            }

            console.warn(`Awaj Direct Broadcast failed (${directResponse.status}):`, directData);

            // Fallback to standard broadcast endpoint if direct API returns error (e.g. 403 missing permission or 400 format issue) and voice name is provided
            const voiceName = (body.voice || body.voice_name || body.title || '').toString();
            if (voiceName && !voiceName.startsWith('http')) {
              console.log('Falling back to standard Awaj Broadcast endpoint with voice name:', voiceName);
              const stdPayload = {
                ...body,
                request_id: requestId,
                sender: senderNum,
                voice: voiceName
              };
              delete stdPayload.voices;
              delete stdPayload.direct;

              const stdResponse = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
                method: 'POST',
                headers: headers as any,
                body: JSON.stringify(stdPayload)
              });
              const stdData = await stdResponse.json().catch(() => ({}));
              console.log(`Awaj Standard Broadcast Fallback Status: ${stdResponse.status}`, stdData);
              if (!stdResponse.ok) return res.status(stdResponse.status).json(stdData);
              return res.status(200).json(stdData);
            } else {
              return res.status(directResponse.status).json(directData);
            }
          } catch (directErr: any) {
            console.error('Awaj Direct Broadcast Exception:', directErr.message);
            const voiceName = (body.voice || body.voice_name || body.title || '').toString();
            if (voiceName && !voiceName.startsWith('http')) {
              console.log('Exception in Direct Broadcast, falling back to standard Awaj Broadcast');
              const stdPayload = {
                ...body,
                request_id: requestId,
                sender: senderNum,
                voice: voiceName
              };
              delete stdPayload.voices;
              delete stdPayload.direct;

              const stdResponse = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
                method: 'POST',
                headers: headers as any,
                body: JSON.stringify(stdPayload)
              });
              const stdData = await stdResponse.json().catch(() => ({}));
              if (!stdResponse.ok) return res.status(stdResponse.status).json(stdData);
              return res.status(200).json(stdData);
            }
            throw directErr;
          }
        }

        // Standard Broadcast flow
        const stdPayload = {
          ...body,
          request_id: requestId,
          sender: senderNum
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
      
      // Filter out old senders and keep only +880 9610-993084
      sendersList = sendersList.filter((s: any) => {
        const num = String(s.callingNumber || s.caller_id || s.id || '');
        return num.includes('9610993084') || num.includes('9610-993084');
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
          .select('institution_id')
          .eq('id', user.id)
          .single();

        if (profileErr || !profile?.institution_id) {
          console.error('Profile/Institution fetch error:', profileErr);
          return res.status(401).json({ error: 'Unauthorized: Could not determine institution' });
        }

        const institutionId = profile.institution_id;

        // 1. Fetch broadcast details
        const { data: broadcast, error: broadcastErr } = await supabase
          .from('voice_broadcasts')
          .select('*')
          .eq('id', broadcastId)
          .eq('institution_id', institutionId)
          .single();

        if (broadcastErr || !broadcast) {
          console.error('Broadcast fetch error:', broadcastErr);
          return res.status(404).json({ error: 'Broadcast not found or access denied' });
        }

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
        if (!targetCampaignId) {
          return res.status(400).json({ error: 'No provider campaign ID found to process' });
        }

        // Add Jitter
        const jitterMs = Math.floor(Math.random() * 2000) + 500;
        await new Promise(r => setTimeout(r, jitterMs));

        // Check if already refunded
        const refundTxId = `REFUND_CAMP_${targetCampaignId}`;
        const { data: existingRefund } = await supabase
          .from('transactions')
          .select('id')
          .eq('transaction_id', refundTxId)
          .maybeSingle();

        if (existingRefund) {
          return res.status(200).json({ success: true, already_refunded: true, message: 'Refund already processed for this campaign' });
        }

        // Generate deterministic UUID
        const crypto = await import('crypto');
        const hash = crypto.createHash('md5').update(refundTxId).digest('hex');
        const deterministicId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;

        // Fetch logs from Awaj API
        let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${targetCampaignId}/result`, { headers: headers as any });
        if (response.status === 404) {
          response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${targetCampaignId}`, { headers: headers as any });
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch from Awaj API: ${response.statusText}`);
        }

        const resultData = await response.json() as any;
        
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

        const logs = extractLogs(resultData);

        if (!logs || logs.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No call logs found yet. Please wait until broadcast is fully completed.',
            refund_amount: 0
          });
        }

        const failedLogs = logs.filter((log: any) => {
          const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
          const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up', 'connected', 'complete', 'finished', 'finished_success', 'picked up'];
          if (successStatuses.includes(status)) return false;
          
          const failureStatuses = [
            'failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 
            'unanswered', 'timeout', 'no-answer', 'abandoned', 'not_answered', 'notanswered', 
            'notpicked', 'not_picked', 'missed', 'blocked', 'unavailable', 'not answered', 'not picked',
            'no-picked', 'no_picked', 'noanswer', 'not-picked', 'reject', 'declined', 'failed-retry', 'failed_retry',
            'no picked', 'no answered', 'no answer', 'not pick', 'not-pickedup', 'not_pickedup'
          ];
          if (failureStatuses.includes(status) || status.includes('not picked') || status.includes('not answered') || status.includes('no answer')) return true;
          
          const duration = Number(log.duration || 0);
          if (duration === 0 && !['pending', 'sending', 'processing', 'queued'].includes(status)) return true;
          return false;
        });

        console.log(`Processing refund for campaign ${targetCampaignId}. Logs: ${logs.length}, Failures: ${failedLogs.length}`);

        const totalSentOriginal = Number(broadcast.total_numbers || 1);
        const isRetry = targetCampaignId !== broadcast.provider_campaign_id;
        const apiTotal = Number(resultData.total || resultData.broadcast?.total || resultData.broadcast?.total_numbers || resultData.broadcast?.recipient_count || resultData.data?.total || resultData.stats?.total || 0);

        let campaignTotalSent = 0;
        if (apiTotal > logs.length) campaignTotalSent = apiTotal;
        else if (!isRetry) campaignTotalSent = Math.max(logs.length, totalSentOriginal);
        else campaignTotalSent = logs.length;

        if (!isRetry && campaignTotalSent > totalSentOriginal) campaignTotalSent = totalSentOriginal;

        let droppedCalls = Math.max(0, campaignTotalSent - logs.length);
        let totalFailuresToRefund = Math.min(failedLogs.length + droppedCalls, campaignTotalSent);
        
        console.log(`Campaign ${targetCampaignId}: Total: ${campaignTotalSent}, Logs: ${logs.length}, Dropped: ${droppedCalls}, Failures: ${failedLogs.length}, Final Refund: ${totalFailuresToRefund}`);
        if (!isRetry && totalFailuresToRefund > totalSentOriginal) totalFailuresToRefund = totalSentOriginal;

        if (totalFailuresToRefund === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No unreceived calls detected.', 
            refund_amount: 0
          });
        }

        const { data: sysSettings } = await supabase
          .from('system_settings')
          .select('voice_rate')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        
        const voiceRate = institution.voice_rate || sysSettings?.voice_rate || 0.45;
        const refundAmount = Number((totalFailuresToRefund * voiceRate).toFixed(2));

        const txData: any = {
          id: deterministicId,
          institution_id: institutionId,
          amount: refundAmount,
          transaction_id: refundTxId,
          sender_phone: 'SYSTEM',
          description: `Refund for ${totalFailuresToRefund} unreceived calls (Voice Broadcast)`,
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

        return res.status(200).json({ 
          success: true, 
          refunded_calls: totalFailuresToRefund,
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
