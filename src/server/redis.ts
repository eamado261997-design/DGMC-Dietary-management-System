import Redis, { RedisOptions } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let client: Redis | null = null;
let connected = false;

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

export function getRedisConfig(): { targetUrl: string | null; targetHost: string | null; targetPort: number; options: RedisOptions } | null {
  const rawUrl = process.env.REDIS_URL ? process.env.REDIS_URL.trim() : "";
  const rawHost = process.env.REDIS_HOST ? process.env.REDIS_HOST.trim() : "";
  const rawPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
  const rawPassword = process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD.trim() : undefined;
  const rawUsername = process.env.REDIS_USERNAME ? process.env.REDIS_USERNAME.trim() : undefined;
  const rawDb = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined;
  const rawFamily = process.env.REDIS_FAMILY ? parseInt(process.env.REDIS_FAMILY, 10) : 4;
  const connectTimeout = process.env.REDIS_CONNECT_TIMEOUT ? parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) : 5000;
  const maxRetries = process.env.REDIS_MAX_RETRIES ? parseInt(process.env.REDIS_MAX_RETRIES, 10) : 3;
  const keepAlive = process.env.REDIS_KEEP_ALIVE ? parseInt(process.env.REDIS_KEEP_ALIVE, 10) : 10000;
  const enableOfflineQueue = process.env.REDIS_ENABLE_OFFLINE_QUEUE === "false" ? false : true;

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

  const options: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: isNaN(maxRetries) ? 3 : maxRetries,
    enableOfflineQueue,
    connectTimeout: isNaN(connectTimeout) ? 5000 : connectTimeout,
    family: isNaN(rawFamily) ? 4 : rawFamily,
    keepAlive: isNaN(keepAlive) ? 10000 : keepAlive,
    db: rawDb !== undefined && !isNaN(rawDb) ? rawDb : undefined,
    username: rawUsername && !isInvalid(rawUsername) ? rawUsername : undefined,
    password: rawPassword && !isInvalid(rawPassword) ? rawPassword : undefined,
    retryStrategy: (times: number) => {
      const maxReconnectAttempts = process.env.REDIS_MAX_RECONNECT_ATTEMPTS
        ? parseInt(process.env.REDIS_MAX_RECONNECT_ATTEMPTS, 10)
        : 50;
      if (times > maxReconnectAttempts) {
        console.warn(`[Redis] Max reconnect attempts (${maxReconnectAttempts}) reached.`);
        return null;
      }
      return Math.min(times * 150, 3000);
    },
    reconnectOnError: (err) => {
      if (err.message && err.message.includes("READONLY")) {
        return true;
      }
      return false;
    },
  };

  return { targetUrl, targetHost, targetPort, options };
}

/**
 * Returns the shared ioredis singleton.
 * Returns null if Redis is not configured (REDIS_HOST / REDIS_URL absent).
 */
export function getRedisClient(): Redis | null {
  if (client) return client;

  const config = getRedisConfig();
  if (!config) {
    return null;
  }

  try {
    const { targetUrl, targetHost, targetPort, options } = config;

    if (targetUrl) {
      client = new Redis(targetUrl, options);
    } else if (targetHost) {
      client = new Redis({
        host: targetHost,
        port: targetPort,
        ...options,
      });
    }

    if (client) {
      client.on("connect", () => {
        connected = true;
        console.log("[Redis] Shared client connected.");
      });

      client.on("ready", () => {
        connected = true;
        console.log("[Redis] Shared client ready to receive commands.");
      });

      client.on("close", () => {
        connected = false;
      });

      client.on("reconnecting", () => {
        console.log("[Redis] Client reconnecting...");
      });

      client.on("end", () => {
        connected = false;
      });

      client.on("error", (err: any) => {
        if (client && client.status !== "ready" && client.status !== "connect") {
          connected = false;
        }
      });

      client.connect().catch((_err: any) => {
        connected = false;
      });
    }
  } catch (err) {
    client = null;
    connected = false;
  }

  return client;
}

export function isRedisClientConnected(): boolean {
  if (client) {
    return client.status === "ready" || client.status === "connect" || connected;
  }
  return connected;
}
