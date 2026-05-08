import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

// ESM environments do not have __dirname global variable. 
// We define it manually for compatibility with path.resolve.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function vercelApiPlugin(env: Record<string, string> = {}) {
  return {
    name: 'vercel-api-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/')) {
          try {
            // Set environment variables for the handler
            Object.assign(process.env, env);
            const urlPath = req.url.split('?')[0];
            let filePath = path.join(__dirname, urlPath);
            let queryParams: Record<string, string> = {};
            
            // Resolve file path
            if (urlPath.startsWith('/api/teachers')) {
              filePath = path.join(__dirname, '/api/teachers.ts');
            } else if (urlPath.startsWith('/api/awaj')) {
              filePath = path.join(__dirname, '/api/awaj.ts');
            } else if (fs.existsSync(filePath + '.ts')) {
              filePath += '.ts';
            } else if (fs.existsSync(path.join(filePath, 'index.ts'))) {
              filePath = path.join(filePath, 'index.ts');
            } else {
              return next();
            }

            // Load the module using Vite's SSR loader
            const module = await server.ssrLoadModule(filePath);
            const handler = module.default;

            
            if (handler) {
              // Read body if POST/PUT
              let body = '';
              if (req.method === 'POST' || req.method === 'PUT') {
                for await (const chunk of req) {
                  body += chunk;
                }
              }

              let parsedBody = undefined;
              if (body) {
                try {
                  parsedBody = JSON.parse(body);
                } catch (e) {
                  parsedBody = body;
                }
              }

              // Mock VercelRequest and VercelResponse
              const vercelReq = Object.assign(req, {
                body: parsedBody,
                query: {
                  ...Object.fromEntries(new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams),
                  ...queryParams
                }
              });

              const vercelRes = Object.assign(res, {
                status: (code: number) => {
                  res.statusCode = code;
                  return vercelRes;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                send: (data: any) => {
                  res.end(data);
                }
              });

              await handler(vercelReq, vercelRes);
              return;
            }
          } catch (e: any) {
            console.error('API Error:', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: {
          overlay: false
        },
        allowedHosts: true
      },
      plugins: [
        react(), 
        tailwindcss(), 
        tsconfigPaths(), 
        vercelApiPlugin(env),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          devOptions: {
            enabled: true,
            type: 'module'
          },
          includeAssets: ['Deenora192.png', 'Deenora512.png'],
          manifest: {
            name: "Deenora",
            short_name: "Deenora",
            description: "Professional Institute Management System",
            id: "/",
            start_url: "/",
            scope: "/",
            display: "standalone",
            background_color: "#0F172A",
            theme_color: "#0F172A",
            orientation: "portrait",
            icons: [
              {
                src: "/Deenora192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable"
              },
              {
                src: "/Deenora512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
              }
            ]
          },
          workbox: {
            cleanupOutdatedCaches: true,
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_VERCEL_URL': JSON.stringify(env.VERCEL_URL || env.VITE_VERCEL_URL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      build: {
        target: 'es2015',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-supabase': ['@supabase/supabase-js'],
              'vendor-icons': ['lucide-react'],
              'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'uuid'],
              'vendor-ui': ['motion', 'recharts']
            }
          }
        }
      }
    };
});