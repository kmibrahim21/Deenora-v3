import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Routes handler
  app.all('/api/*', async (req, res) => {
    console.log(`[Server] API Request: ${req.method} ${req.url}`);
    try {
      const urlPath = req.url.split('?')[0];
      let filePath = path.join(__dirname, urlPath);
      
      if (urlPath.startsWith('/api/teachers')) {
        filePath = path.join(__dirname, '/api/teachers.ts');
      } else if (urlPath.startsWith('/api/awaj')) {
        filePath = path.join(__dirname, '/api/awaj.ts');
      } else if (urlPath.startsWith('/api/sms')) {
        filePath = path.join(__dirname, '/api/sms.ts');
      } else if (fs.existsSync(filePath + '.ts')) {
        filePath += '.ts';
      } else if (fs.existsSync(path.join(filePath, 'index.ts'))) {
        filePath = path.join(filePath, 'index.ts');
      } else {
        return res.status(404).json({ error: 'Not found' });
      }

      const module = await import(filePath);
      const handler = module.default;

      if (handler) {
        // The handlers expect VercelRequest/Response which are similar to Express req/res
        await handler(req, res);
      } else {
        res.status(404).json({ error: 'Handler not found' });
      }
    } catch (e: any) {
      console.error('API Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
