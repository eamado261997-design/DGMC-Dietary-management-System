import { cacheLayer } from "../cache.js";

export interface CacheItem {
  value: any;
  expiry: number;
}

export class InMemoryCache {
  get(key: string): any {
    return cacheLayer.get(key);
  }

  set(key: string, value: any, ttlSeconds: number): void {
    cacheLayer.set(key, value, ttlSeconds);
  }
  
  clear(): void {
    cacheLayer.clear();
  }
}

export const apiCache = cacheLayer;

export interface ApiResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
  cookies?: Record<string, { value: string; options?: any }>;
}

export interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface TokenBucketRecord {
  tokens: number;
  lastRefill: number;
}

export const tokenBucketStore: Record<string, TokenBucketRecord> = {};

export interface RateLimitRecord {
  count: number;
  resetTime: number;
}
export const rateLimitStore: Record<string, RateLimitRecord> = {};

export function checkTokenBucket(key: string, capacity: number, fillRatePerSecond: number): { allowed: boolean; tokens: number } {
  const now = Date.now();
  const record = tokenBucketStore[key];
  
  if (!record) {
    tokenBucketStore[key] = {
      tokens: capacity - 1,
      lastRefill: now
    };
    return { allowed: true, tokens: capacity - 1 };
  }

  const timePassed = (now - record.lastRefill) / 1000;
  const newTokens = timePassed * fillRatePerSecond;
  
  record.tokens = Math.min(capacity, record.tokens + newTokens);
  record.lastRefill = now;
  
  if (record.tokens >= 1) {
    record.tokens -= 1;
    return { allowed: true, tokens: record.tokens };
  }
  
  return { allowed: false, tokens: record.tokens };
}


export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  // If Redis is connected, use Redis for rate limiting
  if (cacheLayer.getIsRedisConnected()) {
    const redis = cacheLayer.getRedisClient();
    if (redis) {
      const redisKey = `ratelimit:${key}`;
      try {
        const results = await redis.multi()
          .incr(redisKey)
          .ttl(redisKey)
          .exec();
        
        if (results && results.length >= 2) {
          const incrResult = results[0];
          const ttlResult = results[1];
          
          const count = (incrResult && incrResult[1] !== undefined) ? (incrResult[1] as number) : 1;
          let ttl = (ttlResult && ttlResult[1] !== undefined) ? (ttlResult[1] as number) : -1;
          
          if (count === 1 || ttl === -1 || ttl === -2) {
            const expireSeconds = Math.ceil(windowMs / 1000);
            await redis.expire(redisKey, expireSeconds);
            ttl = expireSeconds;
          }
          
          const resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
          const allowed = count <= limit;
          const remaining = Math.max(0, limit - count);
          
          return { allowed, remaining, resetTime };
        }
      } catch (_err) {
        // Redis rate-limit fallback to memory
      }
    }
  }

  // Fallback to in-memory rate limiting
  const now = Date.now();
  const record = rateLimitStore[key];
  if (!record || now > record.resetTime) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + windowMs
    };
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
  }
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
}

import { AsyncLocalStorage } from "async_hooks";

export interface ApiBenchmarkLog {
  timestamp: string;
  method: string;
  path: string;
  latency: number;
  dbLatency?: number;
  status: number;
  ip: string;
  isSeed?: boolean;
  errorMessage?: string;
  errorStack?: string;
}

export const dbLatencyTracker = new AsyncLocalStorage<{ totalDbLatency: number }>();
export const benchmarkLogs: ApiBenchmarkLog[] = [];

export function addBenchmarkLog(
  method: string,
  path: string,
  latency: number,
  status: number,
  ip: string,
  dbLatency?: number,
  errorMessage?: string,
  errorStack?: string
) {
  const finalDbLatency = dbLatency !== undefined 
    ? dbLatency 
    : (dbLatencyTracker.getStore()?.totalDbLatency || 0);

  const log: ApiBenchmarkLog = {
    timestamp: new Date().toISOString(),
    method,
    path,
    latency,
    dbLatency: finalDbLatency,
    status,
    ip,
    isSeed: false,
    errorMessage,
    errorStack
  };
  benchmarkLogs.push(log);
  if (benchmarkLogs.length > 1000) {
    benchmarkLogs.shift();
  }
}

// Seed realistic benchmarks for initial rendering - populates historical telemetry so charts are immediately readable
export const seedBenchmarks = () => {
  if (benchmarkLogs.length > 0) return;
  const now = Date.now();
  // Seed about 150 logs over the last 60 minutes
  for (let i = 0; i < 150; i++) {
    const ageMs = Math.random() * 3600 * 1000; // up to 1 hour old
    const timestamp = new Date(now - ageMs).toISOString();
    const paths = [
      "/api/auth/login",
      "/api/cashier/scan",
      "/api/admin/stats",
      "/api/admin/sys-health",
      "/api/employee/me",
      "/api/manager/roster"
    ];
    const methods = ["GET", "POST", "GET", "GET", "GET", "GET"];
    const pathIdx = Math.floor(Math.random() * paths.length);
    const method = methods[pathIdx];
    const path = paths[pathIdx];
    
    // Realistic latency ranges
    let latency = 15 + Math.floor(Math.random() * 35);
    if (path.includes("sys-health") || path.includes("stats")) {
      latency = 45 + Math.floor(Math.random() * 75);
    }
    // Random latency spikes
    if (Math.random() < 0.08) {
      latency += 120 + Math.floor(Math.random() * 180);
    }

    const dbLatency = Math.max(2, Math.round(latency * (0.15 + Math.random() * 0.35)));

    const status = Math.random() < 0.02 ? 500 : 200;
    const ip = `192.168.1.${10 + Math.floor(Math.random() * 50)}`;

    benchmarkLogs.push({
      timestamp,
      method,
      path,
      latency,
      dbLatency,
      status,
      ip,
      isSeed: true,
      errorMessage: status >= 500 ? "[Synthetic Telemetry Baseline] Simulated 500 server error" : undefined
    });
  }
  // Sort by timestamp ascending
  benchmarkLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};
seedBenchmarks();

// Helper for formatted responses definitions (moved early for security block returns)
export const jsonResponse = (status: number, data: any, cookies?: any, headers?: Record<string, string>): ApiResponse => ({
  status,
  body: data,
  cookies,
  headers
});

export const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('='));
    }
  });
  return cookies;
};

export function getTodayDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeStr(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  const secs = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
}

import { Person } from "../../types.js";

export interface ApiContext {
  method: string;
  path: string;
  body: any;
  headers: any;
  queryParams: any;
  authUser: Person | null;
  requireRole: (roles: ("admin" | "manager" | "cashier" | "employee")[]) => boolean;
  getSettingValue: (key: string, defaultValue: string) => Promise<string>;
  logToAudit: (action: string, entity_type?: string, entity_id?: string | number | null, old_value?: any, new_value?: any) => Promise<void>;
}
