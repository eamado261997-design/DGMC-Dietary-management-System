import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let client: Redis | null = null;
let connected = false;

/**
 * Returns the shared ioredis singleton.
 * Returns null if Redis is not configured (REDIS_HOST / REDIS_URL absent).
 */
export function getRedisClient(): Redis | null {
  if (client) return client;

  const isInvalid = (v?: string | null) =>
    !v ||
    typeof v !== "string" ||
    v.trim() === "" ||
    v === "EMPTY" ||
    v === "YOUR_REDIS_HOST" ||
    v === "YOUR_REDIS_URL" ||
    v === "undefined" ||
    v === "null" ||
    v === '""' ||
    v === "''";

  const rawUrl = process.env.REDIS_URL ? process.env.REDIS_URL.trim() : "";
  const rawHost = process.env.REDIS_HOST ? process.env.REDIS_HOST.trim() : "";
  const rawPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
  const rawPassword = process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD.trim() : undefined;

  let targetUrl: string | null = null;
  let targetHost: string | null = null;
  let targetPort: number = isNaN(rawPort) ? 6379 : rawPort;

  if (!isInvalid(rawUrl)) {
    let formattedUrl = rawUrl;
    if (!formattedUrl.startsWith("redis://") && !formattedUrl.startsWith("rediss://")) {
      formattedUrl = `redis://${formattedUrl}`;
    }
    try {
      const parsed = new URL(formattedUrl);
      if (parsed.hostname) {
        targetUrl = formattedUrl;
      }
    } catch {
      const cleanUrl = rawUrl.replace(/^(redis|rediss):\/\//, "");
      const parts = cleanUrl.split(":");
      if (parts[0] && !isInvalid(parts[0])) {
        targetHost = parts[0];
        if (parts[1]) targetPort = parseInt(parts[1], 10);
      }
    }
  }

  if (!targetUrl && !targetHost && !isInvalid(rawHost)) {
    if (rawHost.startsWith("redis://") || rawHost.startsWith("rediss://")) {
      try {
        const parsed = new URL(rawHost);
        if (parsed.hostname) {
          targetUrl = rawHost;
        }
      } catch {
        const clean = rawHost.replace(/^(redis|rediss):\/\//, "");
        const parts = clean.split(":");
        targetHost = parts[0];
        if (parts[1]) targetPort = parseInt(parts[1], 10);
      }
    } else if (rawHost.includes(":")) {
      const parts = rawHost.split(":");
      targetHost = parts[0];
      if (parts[1]) targetPort = parseInt(parts[1], 10);
    } else {
      targetHost = rawHost;
    }
  }

  if (!targetUrl && !targetHost) {
    return null;
  }

  try {
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      enableOfflineQueue: false,
      connectTimeout: 2000,
    };

    if (targetUrl) {
      client = new Redis(targetUrl, options);
    } else if (targetHost) {
      client = new Redis({ host: targetHost, port: targetPort, password: rawPassword, ...options });
    }

    if (client) {
      client.on("connect", () => {
        connected = true;
        console.log("[Redis] Shared client connected.");
      });

      client.on("error", () => {
        connected = false;
      });

      client.connect().catch(() => {
        connected = false;
      });
    }
  } catch {
    client = null;
  }

  return client;
}

export function isRedisClientConnected(): boolean {
  return connected;
}
