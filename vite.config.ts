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
            if (reqUrl.startsWith('/api/')) {
              const parsed = urlHelper.parse(reqUrl, true);
              const queryParams = parsed.query;
              const pathOnly = parsed.pathname || '';
              const startTime = Date.now();
              const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1';

              const executeRequest = async (body: any) => {
                let status = 200;
                try {
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
            } else {
              next();
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
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
