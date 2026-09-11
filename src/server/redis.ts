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

  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
  const redisPassword = process.env.REDIS_PASSWORD || undefined;

  const hasConfig =
    redisUrl ||
    (redisHost && redisHost !== "EMPTY" && redisHost !== "YOUR_REDIS_HOST" && redisHost.trim() !== "");

  if (!hasConfig) {
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

    if (redisUrl) {
      client = new Redis(redisUrl, options);
    } else {
      client = new Redis({ host: redisHost!, port: redisPort, password: redisPassword, ...options });
    }

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
  } catch {
    client = null;
  }

  return client;
}

export function isRedisClientConnected(): boolean {
  return connected;
}
