
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

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
