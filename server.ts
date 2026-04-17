
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use body-parser for JSON. However, let the Vite ssrLoadModule handle the raw req if needed.
  // Actually, standard express json is fine as long as we mock req.body.
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper to run Vercel-style handlers
  const runHandler = async (filePath: string, req: express.Request, res: express.Response) => {
    try {
      // In dev mode, we use Vite's ssrLoadModule to support HMR and TS
      let handler;
      if (process.env.NODE_ENV !== 'production') {
        const vite = await getViteInstance();
        const module = await vite.ssrLoadModule(filePath);
        handler = module.default;
      } else {
        // In production, we assume compiled or direct import
        handler = (await import(filePath)).default;
      }

      if (typeof handler === 'function') {
        // Mock Vercel style response
        const vercelRes: any = Object.assign(res, {
          status: (code: number) => {
            res.status(code);
            return vercelRes;
          },
          json: (data: any) => {
            res.json(data);
            return vercelRes;
          },
          send: (data: any) => {
            res.send(data);
            return vercelRes;
          },
          setHeader: (key: string, value: string) => {
            res.setHeader(key, value);
            return vercelRes;
          }
        });

        // Mock Vercel style request
        const vercelReq: any = Object.assign(req, {
          query: { ...req.query, ...req.params }
        });

        await handler(vercelReq, vercelRes);
      } else {
        res.status(500).json({ error: 'Handler not found' });
      }
    } catch (error: any) {
      console.error(`API Error (${filePath}):`, error);
      res.status(500).json({ error: error.message });
    }
  };

  let viteInstance: any;
  const getViteInstance = async () => {
    if (!viteInstance) {
      viteInstance = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
    }
    return viteInstance;
  };

  // Specific Routes for Awaj
  app.all('/api/awaj*', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'awaj.ts'), req, res);
  });

  // Specific Routes for Teachers
  app.all('/api/teachers*', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'teachers.ts'), req, res);
  });

  // Audio Proxy Route
  app.get('/api/proxy-audio', async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      const response = await fetch(audioUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Force proper Headers
      let contentType = response.headers.get('content-type') || 'audio/mpeg';
      // Many CDNs serve audio as application/octet-stream or text/plain
      if (contentType.includes('octet-stream') || contentType.includes('text/') || contentType.includes('text/html')) {
        contentType = audioUrl.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h

      res.status(200).send(buffer);
    } catch (error: any) {
      console.error('Audio Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Wildcard
  app.all('/api/:service', async (req, res) => {
    const service = req.params.service;
    const filePath = path.join(__dirname, 'api', `${service}.ts`);
    if (fs.existsSync(filePath)) {
      await runHandler(filePath, req, res);
    } else {
      res.status(404).json({ error: `API service ${service} not found` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await getViteInstance();
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
