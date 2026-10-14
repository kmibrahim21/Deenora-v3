import { Request, Response } from 'express';

// In-memory token store for transient file downloads (auto-expires in 3 minutes)
interface DownloadItem {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  createdAt: number;
}

const downloadCache = new Map<string, DownloadItem>();

// Clean up expired items periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, item] of downloadCache.entries()) {
    if (now - item.createdAt > 3 * 60 * 1000) {
      downloadCache.delete(token);
    }
  }
}, 60 * 1000);

export default async function handler(req: Request, res: Response) {
  // POST: Register a download item and receive a short-lived download token
  if (req.method === 'POST') {
    try {
      const { base64, filename = 'document.pdf', mimeType = 'application/pdf' } = req.body || {};
      if (!base64 || typeof base64 !== 'string') {
        return res.status(400).json({ error: 'Base64 data is required' });
      }

      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const token = 'dl_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);

      downloadCache.set(token, {
        buffer,
        filename: String(filename),
        mimeType: String(mimeType),
        createdAt: Date.now()
      });

      return res.status(200).json({
        token,
        downloadUrl: `/api/download?token=${token}&filename=${encodeURIComponent(filename)}`
      });
    } catch (err: any) {
      console.error('[DownloadHandler] POST Error:', err);
      return res.status(500).json({ error: 'Failed to stage download' });
    }
  }

  // GET: Serve the staged file with attachment header (triggers native Android DownloadManager)
  if (req.method === 'GET') {
    try {
      const token = String(req.query.token || '');
      if (!token || !downloadCache.has(token)) {
        return res.status(404).send('Download link expired or not found. Please try generating again.');
      }

      const item = downloadCache.get(token)!;
      // Single-use download cleanup after 5 seconds to free memory
      setTimeout(() => {
        downloadCache.delete(token);
      }, 5000);

      const safeFilename = encodeURIComponent(item.filename).replace(/['()]/g, escape);
      res.setHeader('Content-Type', item.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${item.filename.replace(/"/g, '')}"; filename*=UTF-8''${safeFilename}`);
      res.setHeader('Content-Length', item.buffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).send(item.buffer);
    } catch (err: any) {
      console.error('[DownloadHandler] GET Error:', err);
      return res.status(500).send('Error delivering file');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
