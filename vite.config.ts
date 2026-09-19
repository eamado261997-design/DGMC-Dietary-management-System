import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import urlHelper from 'url';
import { handleApiRequest } from './src/server/api';
import { addBenchmarkLog } from './src/server/utils/apiUtils';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const reqUrl = req.url || '';
            if (!reqUrl.startsWith('/api/')) {
              return next();
            }

            // Set CORS headers for local hospital intranet and dev environments
            const origin = req.headers.origin;
            const isAllowedOrigin = !origin ||
              origin.includes('localhost') ||
              origin.includes('127.0.0.1') ||
              origin.includes('192.168.') ||
              origin.includes('10.') ||
              /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./.test(origin) ||
              origin.endsWith('.run.app');

            if (isAllowedOrigin && origin) {
              res.setHeader('Access-Control-Allow-Origin', origin);
              res.setHeader('Access-Control-Allow-Credentials', 'true');
            } else if (!origin) {
              res.setHeader('Access-Control-Allow-Origin', '*');
            }

            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, X-Request-ID, Accept');

            // Handle OPTIONS preflight immediately
            if (req.method === 'OPTIONS') {
              res.writeHead(204);
              res.end();
              return;
            }

            const parsed = urlHelper.parse(reqUrl, true);
            const queryParams = parsed.query;
            const pathOnly = parsed.pathname || '';
            const startTime = Date.now();
            const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1';

            const executeRequest = async (body: any) => {
              let status = 200;
              try {
                // Intercept the Prometheus metrics endpoint in Vite middleware
                if (pathOnly === '/api/metrics') {
                  const { isInternalIpAllowed } = await import('./src/server/utils/ipSecurity');
                  
                  if (!isInternalIpAllowed(String(ip))) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Forbidden: Telemetry access restricted to internal monitoring systems." }));
                    return;
                  }

                  // Dynamically import to ensure we get the latest compiled logic in dev
                  const { getPrometheusMetrics } = await import('./src/server/utils/performanceTracker');
                  const metrics = getPrometheusMetrics();
                  res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
                  res.end(metrics);
                  return;
                }

                const result = await handleApiRequest(
                  req.method || 'GET',
                  pathOnly,
                  body,
                  req.headers,
                  queryParams
                );
                status = result.status;
                
                res.writeHead(result.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.body));
              } catch (err: any) {
                status = 500;
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
              } finally {
                const endTime = Date.now();
                const duration = endTime - startTime;
                const normalizedPath = pathOnly.split('?')[0].replace(/\/+/g, '/');
                if (normalizedPath !== '/api/admin/sys-perf' && normalizedPath !== '/api/health') {
                  addBenchmarkLog(req.method || 'GET', normalizedPath, duration, status, String(ip));
                }
              }
            };

            const hasNoBody = ['GET', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method || 'GET');
            if (hasNoBody) {
              executeRequest({});
            } else {
              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                let body = {};
                try {
                  body = bodyStr ? JSON.parse(bodyStr) : {};
                } catch (e) {
                  // Ignore parse error or keep empty
                }
                executeRequest(body);
              });
            }
          });
        },
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: process.env.NODE_ENV !== 'production' || process.env.GENERATE_SOURCEMAP === 'true',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('jszip') || id.includes('qrcode')) {
                return 'vendor-utils';
              }
            }
          }
        }
      },
      chunkSizeWarningLimit: 600,
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: {
        host: 'localhost',
      },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
