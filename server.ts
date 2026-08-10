import express from 'express';
import path from 'path';
import os from 'os';
import compression from 'compression';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { cacheLayer } from './src/server/cache.ts';
import { logger } from './src/server/utils/logger.ts';
import { handleApiRequest } from './src/server/api.ts';
import { loadAndInitDatabase } from './src/server/db.ts';
import { checkMysqlHealth, getPoolStats, isMysqlConnected, getMysqlPool } from './src/server/mysql.ts';
import { isSqliteConnected } from './src/server/sqlite.ts';
import { getOpenApiSpec } from './src/server/services/openapiService.ts';

// Environment validation
function validateEnvironment() {
  logger.info(`[EnvCheck] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[EnvCheck] MYSQL_HOST: ${process.env.MYSQL_HOST ? 'Configured (' + process.env.MYSQL_HOST + ')' : 'Not configured (using file-backed JSON fallback)'}`);
}

async function startServer() {
  validateEnvironment();

  // Load and initialize the dual-mode storage engine (MySQL + JSON backing)
  try {
    await loadAndInitDatabase();
  } catch (dbInitErr: any) {
    logger.error("Critical: Could not initialize storage engine:", { error: dbInitErr.message });
  }

  const app = express();
  const port = 3000;

  // Trust proxy for rate limiter
  app.set('trust proxy', 1);

  // Request ID and Nonce middleware for tracing & CSP
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    // Generate a secure CSP nonce for inline scripts
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.nonce = nonce;
    next();
  });

  // Structured Request Logging Middleware
  app.use((req, res, next) => {
    // Skip logging for development assets, source files, and HMR to keep logs clean and avoid false-positives
    const isAssetOrSource = 
      req.originalUrl.startsWith('/src/') ||
      req.originalUrl.startsWith('/node_modules/') ||
      req.originalUrl.startsWith('/@') ||
      req.originalUrl.includes('hot-update') ||
      /\.(ts|tsx|js|jsx|css|png|jpg|jpeg|gif|svg|ico|json|map|woff2?|eot|ttf)$/i.test(req.path);

    if (isAssetOrSource) {
      return next();
    }

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        requestId: req.headers['x-request-id']
      });
    });
    next();
  });

  // 1. Response compression (Very Safe)
  app.use(compression());

  // 2. Configure Helmet Security Headers (OWASP compliant)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          (req, res) => `'nonce-${(res as any).locals.nonce}'`,
          // Only fall back to 'unsafe-inline' and 'unsafe-eval' during local development if needed by Vite/HMR
          ...(process.env.NODE_ENV !== 'production' ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
          "https://*"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://*"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        connectSrc: ["'self'", "wss:", "https://*", "http://*", "ws://*"],
        frameAncestors: ["'self'", "https://*", "http://*"], // allow embedding in AI Studio preview iframe
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  // 3. Configure CORS Policy (OWASP compliant)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'http://localhost:3000',
        'https://ais-dev-2ymn52j2l5tejuq3jdq65c-542216201555.asia-southeast1.run.app',
        'https://ais-pre-2ymn52j2l5tejuq3jdq65c-542216201555.asia-southeast1.run.app'
      ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.includes(origin) || 
                        origin.endsWith('.run.app') || 
                        origin.startsWith('http://localhost:') || 
                        origin.startsWith('http://127.0.0.1:');
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  }));

  // 4. Request Timeout Safety
  app.use((req, res, next) => {
    req.setTimeout(30000, () => {
      if (!res.headersSent) {
        res.status(408).json({ error: 'Request timeout after 30 seconds' });
      }
    });
    next();
  });

  // 5. Rate Limiting to prevent abuse & DoS (Safe)
  let limiterStore;
  if (cacheLayer.getIsRedisConnected()) {
    const redisClient = cacheLayer.getRedisClient();
    if (redisClient) {
      console.log("[RATE-LIMIT] Redis is connected. Using RedisStore for rate limiting.");
      limiterStore = new RedisStore({
        sendCommand: ((...args: string[]) => redisClient.call(args[0], ...args.slice(1))) as any,
      });
    }
  }

  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 500, // 500 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    store: limiterStore,
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests, please try again later.' });
    },
  });
  app.use('/api/', limiter);

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint with granular system diagnostics
  app.get('/api/health', async (req, res) => {
    const dbHealth = await checkMysqlHealth();
    const isMysqlConfigured = !!process.env.MYSQL_HOST && 
                             process.env.MYSQL_HOST !== 'YOUR_MYSQL_HOST' && 
                             process.env.MYSQL_HOST !== '' && 
                             process.env.MYSQL_HOST !== 'dgmc' && 
                             process.env.MYSQL_HOST !== 'EMPTY';
    
    const memory = process.memoryUsage();
    const uptimeSeconds = process.uptime();
    
    // Overall status is degraded if SQLite is inactive or if MySQL is configured but not reachable
    let systemStatus = 'healthy';
    if (!isSqliteConnected() || (isMysqlConfigured && !dbHealth.healthy)) {
      systemStatus = 'degraded';
    }

    res.json({
      status: systemStatus,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptimeSeconds,
        formatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${Math.floor(uptimeSeconds % 60)}s`
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        cpu: {
          usage: process.cpuUsage(),
          loadAvg: os.loadavg()
        },
        memory: {
          rssBytes: memory.rss,
          heapTotalBytes: memory.heapTotal,
          heapUsedBytes: memory.heapUsed,
          externalBytes: memory.external,
          arrayBuffersBytes: memory.arrayBuffers,
          rssFormatted: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
          heapUsedFormatted: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotalFormatted: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`
        },
        os: {
          totalMemoryBytes: os.totalmem(),
          freeMemoryBytes: os.freemem(),
          freeMemoryFormatted: `${(os.freemem() / 1024 / 1024).toFixed(2)} MB`,
          totalMemoryFormatted: `${(os.totalmem() / 1024 / 1024).toFixed(2)} MB`
        }
      },
      databases: {
        sqlite: {
          connected: isSqliteConnected(),
          mode: 'WAL (Write-Ahead Logging)'
        },
        mysql: {
          configured: isMysqlConfigured,
          connected: isMysqlConnected(),
          health: {
            healthy: dbHealth.healthy,
            latencyMs: dbHealth.latencyMs,
            error: dbHealth.error || null
          },
          poolStats: getPoolStats()
        }
      },
      cache: {
        stats: cacheLayer.getStats()
      }
    });
  });

  app.get('/api/health/db', async (req, res) => {
    const dbHealth = await checkMysqlHealth();
    const stats = getPoolStats();
    res.json({
      status: dbHealth.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      mysqlConnected: isMysqlConnected(),
      sqliteConnected: isSqliteConnected(),
      health: dbHealth,
      poolStats: stats
    });
  });

  app.get('/api/db-status', (req, res) => {
    res.json({
      sqliteConnected: isSqliteConnected(),
      mysqlConnected: isMysqlConnected(),
      mysqlHost: process.env.MYSQL_HOST || 'Not Configured',
      isMysqlConfigured: !!process.env.MYSQL_HOST && process.env.MYSQL_HOST !== 'YOUR_MYSQL_HOST' && process.env.MYSQL_HOST !== '' && process.env.MYSQL_HOST !== 'dgmc' && process.env.MYSQL_HOST !== 'EMPTY'
    });
  });

  // OpenAPI Specification & Swagger Docs
  app.get('/api/openapi.json', (req, res) => {
    res.json(getOpenApiSpec());
  });

  app.get('/api/swagger-ui', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DGMC API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`);
  });

  // 7. API Versioning support (/api/v1/* maps gracefully to base handlers)
  app.all(['/api/*', '/api/v1/*'], async (req, res) => {
    try {
      // Normalize version prefix away for internal handling
      let requestPath = req.path;
      if (requestPath.startsWith('/api/v1/')) {
        requestPath = '/api/' + requestPath.substring(8);
      }

      const result = await handleApiRequest(
        req.method,
        requestPath,
        req.body,
        req.headers,
        req.query
      );

      // Apply any cookies requested by the API handler (e.g. XSRF-TOKEN)
      if (result.cookies) {
        for (const [name, config] of Object.entries(result.cookies)) {
          res.cookie(name, config.value, config.options);
        }
      }

      // Prevent caching of all dynamic API responses
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.status(result.status).json(result.body);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    logger.info('Starting server in DEVELOPMENT mode with Vite integration...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    logger.info('Starting server in PRODUCTION mode with static file hosting...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 8. Custom Central Error-Handler (Disables default stack traces & technical leaks in production)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errorId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    logger.error(`[Secure-Error-Tracker] [ID: ${errorId}]`, { error: err.message, stack: err.stack, errorId });

    const isProdEnv = process.env.NODE_ENV === 'production';
    res.status(err.status || 500).json({
      error: 'An unexpected internal error occurred',
      message: isProdEnv ? 'Technical details are hidden for security reasons. Please contact the administrator.' : err.message,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  });

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`[Server] Full-stack server running on http://localhost:${port}`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`[Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      logger.info('[Server] HTTP server closed.');
      try {
        const pool = getMysqlPool();
        if (pool && typeof pool.end === 'function') {
          await pool.end();
          logger.info('[MySQL] Connection pool closed successfully.');
        }
      } catch (dbCloseErr: any) {
        logger.error('[MySQL] Error closing connection pool:', { error: dbCloseErr.message });
      }
      logger.info('[Server] Shutdown complete. Exiting process.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('[Server] Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error('Failed to start server:', { error: err.message, stack: err.stack });
});
