
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
// fetch is global in Node 18+

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Multer setup for file uploads (up to 15MB)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
  });

  const uploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && contentType.includes('multipart/form-data')) {
      upload.any()(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'File size too large. Maximum allowed size is 10MB' });
          }
          return res.status(400).json({ message: err.message || 'File upload error' });
        }
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          (req as any).file = req.files[0];
        }
        next();
      });
    } else {
      next();
    }
  };

  // Use body-parser for JSON, URL-encoded, and Text (for Biometric ADMS)
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(express.text({ limit: '20mb' }));

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
        handler = (await import(pathToFileURL(filePath).href)).default;
      }

      if (typeof handler === 'function') {
        // Add cache headers for GET requests securely
        if (req.method === 'GET' && !filePath.includes('auth')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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

  // Specific Routes for Awaj & Voices API (with multipart file upload support)
  app.use('/api/awaj', uploadMiddleware, async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'awaj.ts'), req, res);
  });

  app.use('/api/voices', uploadMiddleware, async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'awaj.ts'), req, res);
  });

  app.use('/api/balance', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'awaj.ts'), req, res);
  });

  // Specific Routes for Teachers
  app.use('/api/teachers', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'teachers.ts'), req, res);
  });

  // Specific Routes for Parents
  app.use('/api/parents', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'parents.ts'), req, res);
  });

  // Audio Proxy Route
  app.all('/api/proxy-audio', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'system.ts'), req, res);
  });

  // Image Proxy Route
  app.all('/api/proxy-image', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'system.ts'), req, res);
  });

  // Health check
  app.get('/api/health', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'system.ts'), req, res);
  });

  // Voice Refund Route (Mapping from vercel.json)
  app.all('/api/voice-refund', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'awaj.ts'), req, res);
  });

  // ZKTeco ADMS Route (Biometric Machine Sync)
  app.all('/iclock/*all', async (req, res) => {
    await runHandler(path.join(__dirname, 'api', 'iclock.ts'), req, res);
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
