
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
// fetch is global in Node 18+

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
        // Add cache headers for GET requests securely
        if (req.method === 'GET' && !filePath.includes('auth')) {
          res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
        }

        // Mock Vercel style response
        const originalStatus = res.status.bind(res);
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);
        const originalSetHeader = res.setHeader.bind(res);

        const vercelRes: any = Object.assign(res, {
          status: (code: number) => {
            originalStatus(code);
            return vercelRes;
          },
          json: (data: any) => {
            originalJson(data);
            return vercelRes;
          },
          send: (data: any) => {
            originalSend(data);
            return vercelRes;
          },
          setHeader: (key: string, value: string) => {
            originalSetHeader(key, value);
            return vercelRes;
          }
        });

        // Mock Vercel style request
        const vercelReq: any = req;
        vercelReq.url = vercelReq.originalUrl || vercelReq.url;
        Object.defineProperty(vercelReq, 'query', {
          value: { ...req.query, ...req.params },
          configurable: true,
          enumerable: true,
          writable: true
        });

        await handler(vercelReq, vercelRes);
      } else {
        res.status(500).json({ error: 'Handler not found' });
      }
    } catch (error: any) {
      console.error(`API Error (${filePath}):`, error);
      res.status(500).json({ 
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
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
  app.use('/api/awaj', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'awaj.ts'), req, res);
  });

  // Specific Routes for Teachers
  app.use('/api/teachers', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'teachers.ts'), req, res);
  });

  // Audio Proxy Route
  app.all('/api/proxy-audio', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'proxy-audio.ts'), req, res);
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
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
