
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// Import API handlers statically for bundling compatibility
import adminHandler from './api/admin.ts';
import attendanceHandler from './api/attendance.ts';
import awajHandler from './api/awaj.ts';
import feesHandler from './api/fees.ts';
import healthHandler from './api/health.ts';
import messagesHandler from './api/messages.ts';
import parentsHandler from './api/parents.ts';
import proxyAudioHandler from './api/proxy-audio.ts';
import resultsHandler from './api/results.ts';
import smsHandler from './api/sms.ts';
import studentHandler from './api/student.ts';
import teachersHandler from './api/teachers.ts';
import voiceRefundHandler from './api/voice-refund.ts';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map of handlers for routing
const handlers: Record<string, any> = {
  admin: adminHandler,
  attendance: attendanceHandler,
  awaj: awajHandler,
  fees: feesHandler,
  health: healthHandler,
  messages: messagesHandler,
  parents: parentsHandler,
  'proxy-audio': proxyAudioHandler,
  results: resultsHandler,
  sms: smsHandler,
  student: studentHandler,
  teachers: teachersHandler,
  'voice-refund': voiceRefundHandler
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper to run Vercel-style handlers
  const runHandler = async (handler: any, req: express.Request, res: express.Response) => {
    try {
      if (typeof handler === 'function') {
        // Add cache headers for GET requests securely
        if (req.method === 'GET' && !req.url.includes('auth')) {
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
      console.error(`API Error:`, error);
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

  // API Routes
  app.all('/api/:service', async (req, res) => {
    const service = req.params.service;
    const handler = handlers[service];
    
    if (handler) {
      await runHandler(handler, req, res);
    } else {
      res.status(404).json({ error: `API service ${service} not found` });
    }
  });

  // Handle specific paths that might not match :service exactly
  app.all('/api/proxy-audio', async (req, res) => {
    await runHandler(handlers['proxy-audio'], req, res);
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
