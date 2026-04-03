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

function vercelApiPlugin() {
  return {
    name: 'vercel-api-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/')) {
          try {
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
      },
      plugins: [
        react(), 
        tailwindcss(), 
        tsconfigPaths(), 
        vercelApiPlugin(),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'inline',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          manifest: {
            name: 'Deenora Madrasah Management',
            short_name: 'Deenora',
            description: 'Professional Madrasah Management System',
            theme_color: '#2563EB',
            background_color: '#FFFFFF',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            icons: [
              {
                src: 'https://img.icons8.com/ios-filled/192/2563EB/mosque.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'https://img.icons8.com/ios-filled/512/2563EB/mosque.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'https://img.icons8.com/ios-filled/512/2563EB/mosque.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
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
                    maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/img\.icons8\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'icons-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // <== 30 days
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
      }
    };
});