import Redis, { RedisOptions } from "ioredis";
import zlib from "zlib";
import dotenv from "dotenv";

dotenv.config();

interface CacheItem {
  value: any;
  expiry: number;
  createdAt: number;
  hits: number;
  tags?: string[];
  compressed?: boolean;
}

export interface SetOptions {
  ttlSeconds?: number;
  tags?: string[];
  compress?: boolean;
  compressThresholdBytes?: number; // default 1024 bytes (1 KB)
}

export interface GetOptions {
  refreshTtlSeconds?: number; // Slide-on-read TTL extension
}

export interface LockOptions {
  ttlMs?: number; // default 5000ms
  retryCount?: number; // default 2
  retryDelayMs?: number; // default 100ms
}

export class CacheLayer {
  private store: Map<string, CacheItem> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private localLocks: Map<string, { token: string; expiry: number }> = new Map();
  private maxL1Items: number = 1000;
  private redisClient: Redis | null = null;
  private isRedisConnected: boolean = false;
  private redisErrorMsg: string | null = null;
  private pingLatencyMs: number | null = null;
  
  // Metrics
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private flushCount: number = 0;
  private compressedCount: number = 0;
  private totalBytesSaved: number = 0;
  private locksAcquired: number = 0;
  private lastFlushTime: string = new Date().toISOString();
  
  private inFlightPromises: Map<string, Promise<any>> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initRedis();
    this.startHealthCheck();
  }

  private initRedis(): void {
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

    // 1. Process REDIS_URL if provided
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

    // 2. Process REDIS_HOST if no valid URL found
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

    // If neither URL nor Host is configured, silently keep in-memory cache
    if (!targetUrl && !targetHost) {
      return;
    }

    try {
      const options: RedisOptions = {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        retryStrategy(times) {
          if (times > 3) return null; // Stop retrying after 3 attempts
          return Math.min(times * 200, 1000);
        },
        enableOfflineQueue: false,
        connectTimeout: 2000
      };

      if (targetUrl) {
        this.redisClient = new Redis(targetUrl, options);
      } else if (targetHost) {
        this.redisClient = new Redis({
          host: targetHost,
          port: targetPort,
          password: rawPassword || undefined,
          ...options
        });
      }

      if (this.redisClient) {
        this.redisClient.on("connect", () => {
          this.isRedisConnected = true;
          this.redisErrorMsg = null;
          console.log(`[Redis] Client connected.`);
        });

        this.redisClient.on("ready", () => {
          this.isRedisConnected = true;
          this.redisErrorMsg = null;
          console.log(`[Redis] Ready to accept commands.`);
        });

        this.redisClient.on("close", () => {
          this.isRedisConnected = false;
        });

        this.redisClient.on("reconnecting", () => {
          console.log(`[Redis] Reconnecting to server...`);
        });

        this.redisClient.on("error", (err: any) => {
          this.isRedisConnected = false;
          this.redisErrorMsg = err?.message || String(err);
        });

        this.redisClient.connect().catch((err) => {
          this.isRedisConnected = false;
          this.redisErrorMsg = err?.message || String(err);
        });
      }
    } catch (err: any) {
      this.isRedisConnected = false;
      this.redisErrorMsg = err.message;
    }
  }

  private startHealthCheck(): void {
    // Periodically ping Redis every 30s to keep connection warm and record latency
    this.healthCheckTimer = setInterval(async () => {
      if (this.isRedisConnected && this.redisClient) {
        try {
          const start = Date.now();
          await this.redisClient.ping();
          this.pingLatencyMs = Date.now() - start;
        } catch {
          this.pingLatencyMs = null;
        }
      } else {
        this.pingLatencyMs = null;
      }
    }, 30000);

    // Unref timer so it doesn't prevent Node process termination
    if (this.healthCheckTimer.unref) {
      this.healthCheckTimer.unref();
    }
  }

  // --- COMPRESSION HELPERS ---
  private compressPayload(dataStr: string): string {
    const buffer = zlib.deflateSync(Buffer.from(dataStr, "utf-8"));
    return `__COMPRESSED_ZLIB__:${buffer.toString("base64")}`;
  }

  private decompressPayload(compressedStr: string): string {
    if (!compressedStr.startsWith("__COMPRESSED_ZLIB__:")) {
      return compressedStr;
    }
    const base64Data = compressedStr.replace("__COMPRESSED_ZLIB__:", "");
    const buffer = Buffer.from(base64Data, "base64");
    const decompressed = zlib.inflateSync(buffer);
    return decompressed.toString("utf-8");
  }

  // --- TAG INDEXING HELPERS ---
  private addKeyToTags(key: string, tags?: string[]): void {
    if (!tags || tags.length === 0) return;
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeKeyFromTags(key: string, tags?: string[]): void {
    if (!tags || tags.length === 0) return;
    for (const tag of tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(key);
        if (set.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }

  /**
   * Synchronous L1 lookup with optional TTL slide-on-read refresh
   */
  public get(key: string, options?: GetOptions): any {
    const item = this.store.get(key);
    const now = Date.now();
    if (!item) {
      this.misses++;
      return null;
    }
    if (now > item.expiry) {
      this.store.delete(key);
      this.removeKeyFromTags(key, item.tags);
      this.misses++;
      return null;
    }

    item.hits++;
    this.hits++;

    // Slide-on-read TTL Refresh if requested
    if (options?.refreshTtlSeconds && options.refreshTtlSeconds > 0) {
      item.expiry = now + options.refreshTtlSeconds * 1000;
      if (this.isRedisConnected && this.redisClient) {
        this.redisClient.expire(key, options.refreshTtlSeconds).catch(() => {});
      }
    }

    // Re-insert key to refresh LRU order
    this.store.delete(key);
    this.store.set(key, item);
    return item.value;
  }

  /**
   * Asynchronous L1 + L2 lookup (checks L1 memory, falls back to Redis if connected)
   */
  public async getAsync(key: string, options?: GetOptions): Promise<any> {
    const l1Val = this.get(key, options);
    if (l1Val !== null) {
      return l1Val;
    }

    if (this.isRedisConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          const decompressed = this.decompressPayload(raw);
          const parsed = JSON.parse(decompressed);
          let ttl = await this.redisClient.ttl(key);

          if (options?.refreshTtlSeconds && options.refreshTtlSeconds > 0) {
            ttl = options.refreshTtlSeconds;
            this.redisClient.expire(key, ttl).catch(() => {});
          }

          if (ttl > 0) {
            this.setLocal(key, parsed, ttl);
          }
          this.hits++;
          return parsed;
        }
      } catch {
        // Fallback gracefully on error
      }
    }

    return null;
  }

  /**
   * Touch key to extend TTL in L1 and L2 without payload re-serialization
   */
  public touch(key: string, ttlSeconds: number): boolean {
    const item = this.store.get(key);
    const now = Date.now();
    let touched = false;

    if (item && now <= item.expiry) {
      item.expiry = now + ttlSeconds * 1000;
      touched = true;
    }

    if (this.isRedisConnected && this.redisClient) {
      this.redisClient.expire(key, ttlSeconds).catch(() => {});
      touched = true;
    }

    return touched;
  }

  /**
   * Batch L1 + L2 Lookup
   */
  public async mget(keys: string[], options?: GetOptions): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const missingKeys: string[] = [];

    for (const key of keys) {
      const val = this.get(key, options);
      if (val !== null) {
        result[key] = val;
      } else {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0 && this.isRedisConnected && this.redisClient) {
      try {
        const pipeline = this.redisClient.pipeline();
        for (const k of missingKeys) {
          pipeline.get(k);
          pipeline.ttl(k);
        }

        const responses = await pipeline.exec();
        if (responses) {
          for (let i = 0; i < missingKeys.length; i++) {
            const key = missingKeys[i];
            const getRes = responses[i * 2];
            const ttlRes = responses[i * 2 + 1];

            if (getRes && !getRes[0] && getRes[1]) {
              const rawStr = getRes[1] as string;
              const decompressed = this.decompressPayload(rawStr);
              const parsed = JSON.parse(decompressed);
              const ttl = (ttlRes && !ttlRes[0] ? (ttlRes[1] as number) : 60);

              result[key] = parsed;
              if (ttl > 0) {
                this.setLocal(key, parsed, ttl);
              }
              this.hits++;
            }
          }
        }
      } catch {
        // Fallback gracefully on error
      }
    }

    return result;
  }

  /**
   * Cache Stampede Mutex Protection:
   * Prevents multiple concurrent DB calls for the same key when cache misses.
   */
  public async getOrSetAsync<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 60,
    options?: SetOptions & GetOptions
  ): Promise<T> {
    const cached = await this.getAsync(key, options);
    if (cached !== null) {
      return cached;
    }

    // Single-flight request deduplication
    if (this.inFlightPromises.has(key)) {
      return this.inFlightPromises.get(key)!;
    }

    const promise = (async () => {
      try {
        const freshData = await fetchFn();
        this.set(key, freshData, ttlSeconds, options);
        return freshData;
      } finally {
        this.inFlightPromises.delete(key);
      }
    })();

    this.inFlightPromises.set(key, promise);
    return promise;
  }

  /**
   * Read-Through Cache Alias
   */
  public async readThrough<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: SetOptions & GetOptions
  ): Promise<T> {
    const ttl = options?.ttlSeconds ?? 60;
    return this.getOrSetAsync(key, fetchFn, ttl, options);
  }

  /**
   * Synchronous L1 write + Async Redis propagation with Compression & Tagging
   */
  public set(key: string, value: any, ttlSeconds: number = 60, options?: SetOptions): void {
    const tags = options?.tags;
    this.setLocal(key, value, ttlSeconds, tags);

    if (this.isRedisConnected && this.redisClient) {
      try {
        let serialized = JSON.stringify(value);
        const threshold = options?.compressThresholdBytes ?? 1024;
        const shouldCompress = options?.compress !== false && serialized.length >= threshold;

        if (shouldCompress) {
          const rawLen = serialized.length;
          serialized = this.compressPayload(serialized);
          const compLen = serialized.length;
          this.compressedCount++;
          if (rawLen > compLen) {
            this.totalBytesSaved += (rawLen - compLen);
          }
        }

        this.redisClient.setex(key, ttlSeconds, serialized).catch(() => {});
      } catch {
        // Ignore serialization or async execution errors
      }
    }
  }

  /**
   * Batch Set (Pipelined L2 Write)
   */
  public mset(
    items: Array<{ key: string; value: any; ttlSeconds?: number; tags?: string[] }>,
    defaultTtlSeconds: number = 60
  ): void {
    if (items.length === 0) return;

    if (this.isRedisConnected && this.redisClient) {
      try {
        const pipeline = this.redisClient.pipeline();
        for (const item of items) {
          const ttl = item.ttlSeconds ?? defaultTtlSeconds;
          this.setLocal(item.key, item.value, ttl, item.tags);

          let serialized = JSON.stringify(item.value);
          if (serialized.length >= 1024) {
            serialized = this.compressPayload(serialized);
          }
          pipeline.setex(item.key, ttl, serialized);
        }
        pipeline.exec().catch(() => {});
      } catch {
        // Fallback gracefully
      }
    } else {
      for (const item of items) {
        this.setLocal(item.key, item.value, item.ttlSeconds ?? defaultTtlSeconds, item.tags);
      }
    }
  }

  private setLocal(key: string, value: any, ttlSeconds: number, tags?: string[]): void {
    const now = Date.now();
    const expiry = now + ttlSeconds * 1000;

    // LRU eviction if maximum L1 items reached
    if (this.store.size >= this.maxL1Items && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        const oldItem = this.store.get(oldestKey);
        if (oldItem) {
          this.removeKeyFromTags(oldestKey, oldItem.tags);
        }
        this.store.delete(oldestKey);
        this.evictions++;
      }
    }

    const existing = this.store.get(key);
    if (existing) {
      this.removeKeyFromTags(key, existing.tags);
    }

    this.addKeyToTags(key, tags);

    this.store.delete(key);
    this.store.set(key, {
      value,
      expiry,
      createdAt: now,
      hits: 0,
      tags
    });
  }

  /**
   * Delete key from L1 & L2
   */
  public delete(key: string): void {
    const item = this.store.get(key);
    if (item) {
      this.removeKeyFromTags(key, item.tags);
      this.store.delete(key);
    }
    if (this.isRedisConnected && this.redisClient) {
      this.redisClient.del(key).catch(() => {});
    }
  }

  /**
   * Batch Delete (Pipelined)
   */
  public mdelete(keys: string[]): void {
    if (keys.length === 0) return;

    for (const key of keys) {
      const item = this.store.get(key);
      if (item) {
        this.removeKeyFromTags(key, item.tags);
        this.store.delete(key);
      }
    }

    if (this.isRedisConnected && this.redisClient) {
      this.redisClient.del(...keys).catch(() => {});
    }
  }

  /**
   * Invalidate by Tag
   */
  public invalidateTag(tag: string): void {
    const keysSet = this.tagIndex.get(tag);
    if (!keysSet || keysSet.size === 0) return;

    const keys = Array.from(keysSet);
    this.mdelete(keys);
    this.tagIndex.delete(tag);
  }

  /**
   * Invalidate by Multiple Tags
   */
  public invalidateTags(tags: string[]): void {
    for (const tag of tags) {
      this.invalidateTag(tag);
    }
  }

  /**
   * Invalidate by string prefix or substring pattern
   */
  public invalidatePattern(pattern: string): void {
    for (const [key, item] of Array.from(this.store.entries())) {
      if (key.includes(pattern)) {
        this.removeKeyFromTags(key, item.tags);
        this.store.delete(key);
      }
    }
    if (this.isRedisConnected && this.redisClient) {
      this.redisClient.keys(`*${pattern}*`).then((keys) => {
        if (keys && keys.length > 0) {
          this.redisClient?.del(...keys).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  /**
   * Cache Warmup
   */
  public warmup(
    entries: Array<{ key: string; value: any; ttlSeconds?: number; tags?: string[] }>
  ): void {
    this.mset(entries);
  }

  /**
   * Async Cache Warmup with fetch functions
   */
  public async warmupFn(
    keyFetches: Array<{ key: string; fetchFn: () => Promise<any>; ttlSeconds?: number; tags?: string[] }>
  ): Promise<void> {
    const results = await Promise.allSettled(
      keyFetches.map(async (item) => {
        const value = await item.fetchFn();
        return {
          key: item.key,
          value,
          ttlSeconds: item.ttlSeconds,
          tags: item.tags
        };
      })
    );

    const validEntries: Array<{ key: string; value: any; ttlSeconds?: number; tags?: string[] }> = [];
    for (const res of results) {
      if (res.status === "fulfilled") {
        validEntries.push(res.value);
      }
    }

    this.warmup(validEntries);
  }

  /**
   * Distributed Lock / Mutex Acquisition
   */
  public async acquireLock(resourceKey: string, options?: LockOptions): Promise<string | null> {
    const lockKey = `lock:${resourceKey}`;
    const ttlMs = options?.ttlMs ?? 5000;
    const retryCount = options?.retryCount ?? 2;
    const retryDelayMs = options?.retryDelayMs ?? 100;
    const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      if (this.isRedisConnected && this.redisClient) {
        try {
          const acquired = await this.redisClient.set(lockKey, token, "PX", ttlMs, "NX");
          if (acquired === "OK") {
            this.locksAcquired++;
            return token;
          }
        } catch {
          // Fallback to local memory lock
        }
      } else {
        // Fallback local memory lock
        const now = Date.now();
        const existing = this.localLocks.get(lockKey);
        if (!existing || now > existing.expiry) {
          this.localLocks.set(lockKey, { token, expiry: now + ttlMs });
          this.locksAcquired++;
          return token;
        }
      }

      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    return null;
  }

  /**
   * Distributed Lock Release
   */
  public async releaseLock(resourceKey: string, token: string): Promise<boolean> {
    const lockKey = `lock:${resourceKey}`;

    if (this.isRedisConnected && this.redisClient) {
      try {
        // Atomic lua script check token match before del
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const res = await this.redisClient.eval(script, 1, lockKey, token);
        return res === 1;
      } catch {
        // Fallback to local memory
      }
    }

    const existing = this.localLocks.get(lockKey);
    if (existing && existing.token === token) {
      this.localLocks.delete(lockKey);
      return true;
    }

    return false;
  }

  /**
   * Clear both L1 memory & L2 Redis cache
   */
  public clear(): void {
    this.store.clear();
    this.tagIndex.clear();
    this.localLocks.clear();
    this.flushCount++;
    this.lastFlushTime = new Date().toISOString();

    if (this.isRedisConnected && this.redisClient) {
      this.redisClient.flushdb().catch(() => {});
    }
  }

  public getRedisClient(): Redis | null {
    return this.redisClient;
  }

  public getIsRedisConnected(): boolean {
    if (this.redisClient && (this.redisClient.status === "ready" || this.redisClient.status === "connect")) {
      return true;
    }
    return this.isRedisConnected;
  }

  public getStats() {
    const now = Date.now();
    let activeKeysCount = 0;
    const keysSummary: Array<{ key: string; ageSeconds: number; hits: number; ttlRemaining: number; tags?: string[] }> = [];

    for (const [k, item] of this.store.entries()) {
      if (now <= item.expiry) {
        activeKeysCount++;
        keysSummary.push({
          key: k,
          ageSeconds: Math.round((now - item.createdAt) / 1000),
          hits: item.hits,
          ttlRemaining: Math.max(0, Math.round((item.expiry - now) / 1000)),
          tags: item.tags
        });
      }
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? Math.round((this.hits / totalRequests) * 1000) / 10 : 100;

    return {
      activeKeysCount,
      maxL1Capacity: this.maxL1Items,
      totalKeysStored: this.store.size,
      activeTagsCount: this.tagIndex.size,
      activeLocksCount: this.localLocks.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate,
      compressedCount: this.compressedCount,
      totalBytesSaved: this.totalBytesSaved,
      locksAcquired: this.locksAcquired,
      flushCount: this.flushCount,
      lastFlushTime: this.lastFlushTime,
      redis: {
        connected: this.isRedisConnected,
        error: this.redisErrorMsg,
        pingLatencyMs: this.pingLatencyMs,
        mode: this.isRedisConnected ? "L1 Memory (LRU) + L2 Redis" : "L1 In-Memory Only (LRU)"
      },
      keysSummary: keysSummary.slice(0, 20)
    };
  }
}

export const cacheLayer = new CacheLayer();
