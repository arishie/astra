import { createClient, type RedisClientType } from 'redis';

interface RateLimitConfig {
    points: number;
    duration: number;
    blockDuration?: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
    chat: { points: 60, duration: 60 },
    hive: { points: 10, duration: 3600 },
    visual: { points: 20, duration: 3600 },
    ingest: { points: 50, duration: 86400 },
    browse: { points: 30, duration: 3600 },
    tool_create: { points: 5, duration: 3600 },
    api_key: { points: 10, duration: 3600 },
    auth: { points: 10, duration: 300, blockDuration: 900 },
};

export class RateLimiter {
    private redis: RedisClientType | null = null;
    private memoryStore: Map<string, { points: number; resetAt: number }> = new Map();
    private limits: Record<string, RateLimitConfig>;
    private useMemory: boolean = true;

    constructor(customLimits?: Partial<Record<string, RateLimitConfig>>) {
        this.limits = { ...DEFAULT_LIMITS };
        if (customLimits) {
            for (const [key, value] of Object.entries(customLimits)) {
                if (value) {
                    this.limits[key] = value;
                }
            }
        }
    }

    async connect(): Promise<void> {
        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            console.warn('[RateLimiter] REDIS_URL not set. Using in-memory rate limiting (not suitable for production).');
            this.useMemory = true;
            return;
        }

        try {
            this.redis = createClient({ url: redisUrl });
            this.redis.on('error', (err) => {
                console.error('[RateLimiter] Redis error:', err);
            });

            await this.redis.connect();
            this.useMemory = false;
            console.log('[RateLimiter] Connected to Redis');
        } catch (error) {
            console.warn('[RateLimiter] Failed to connect to Redis. Using in-memory fallback.');
            this.useMemory = true;
        }
    }

    async disconnect(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
            this.redis = null;
        }
    }

    async checkLimit(
        userId: string,
        operation: string,
        cost: number = 1
    ): Promise<RateLimitResult> {
        const config = this.limits[operation];
        if (!config) {
            return { allowed: true, remaining: Infinity, resetAt: new Date() };
        }

        const key = `rl:${operation}:${userId}`;

        if (this.useMemory) {
            return this.checkMemoryLimit(key, config, cost);
        }

        return this.checkRedisLimit(key, config, cost);
    }

    private async checkMemoryLimit(
        key: string,
        config: RateLimitConfig,
        cost: number
    ): Promise<RateLimitResult> {
        const now = Date.now();
        const existing = this.memoryStore.get(key);

        if (!existing || now > existing.resetAt) {
            this.memoryStore.set(key, {
                points: config.points - cost,
                resetAt: now + config.duration * 1000,
            });

            return {
                allowed: true,
                remaining: config.points - cost,
                resetAt: new Date(now + config.duration * 1000),
            };
        }

        if (existing.points >= cost) {
            existing.points -= cost;

            return {
                allowed: true,
                remaining: existing.points,
                resetAt: new Date(existing.resetAt),
            };
        }

        return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(existing.resetAt),
            retryAfter: Math.ceil((existing.resetAt - now) / 1000),
        };
    }

    private async checkRedisLimit(
        key: string,
        config: RateLimitConfig,
        cost: number
    ): Promise<RateLimitResult> {
        if (!this.redis) {
            return this.checkMemoryLimit(key, config, cost);
        }

        const now = Date.now();
        const windowStart = now - config.duration * 1000;

        try {
            const multi = this.redis.multi();
            multi.zRemRangeByScore(key, '-inf', windowStart.toString());
            multi.zCard(key);
            multi.zAdd(key, { score: now, value: `${now}:${cost}` });
            multi.expire(key, config.duration);

            const results = await multi.exec();
            const currentCount = (results?.[1] as number) || 0;
            const totalCost = currentCount + cost;

            if (totalCost <= config.points) {
                return {
                    allowed: true,
                    remaining: config.points - totalCost,
                    resetAt: new Date(now + config.duration * 1000),
                };
            }

            await this.redis.zPopMax(key);

            const oldestEntry = await this.redis.zRange(key, 0, 0, { BY: 'SCORE' });
            let resetAt = now + config.duration * 1000;

            const firstEntry = oldestEntry[0];
            if (firstEntry) {
                const timestampPart = firstEntry.split(':')[0];
                if (timestampPart) {
                    const oldestTimestamp = parseInt(timestampPart, 10);
                    resetAt = oldestTimestamp + config.duration * 1000;
                }
            }

            return {
                allowed: false,
                remaining: 0,
                resetAt: new Date(resetAt),
                retryAfter: Math.ceil((resetAt - now) / 1000),
            };
        } catch (error) {
            console.error('[RateLimiter] Redis error, falling back to memory store:', error);
            // Fail closed: use memory-based rate limiting instead of allowing unlimited requests
            return this.checkMemoryLimit(key, config, cost);
        }
    }

    async consume(
        userId: string,
        operation: string,
        cost: number = 1
    ): Promise<RateLimitResult> {
        const result = await this.checkLimit(userId, operation, cost);

        if (!result.allowed && !this.useMemory && this.redis) {
            const blockKey = `rl:block:${operation}:${userId}`;
            const config = this.limits[operation];

            if (config?.blockDuration) {
                await this.redis.set(blockKey, '1', { EX: config.blockDuration });
            }
        }

        return result;
    }

    async isBlocked(userId: string, operation: string): Promise<boolean> {
        if (this.useMemory) {
            return false;
        }

        if (!this.redis) return false;

        const blockKey = `rl:block:${operation}:${userId}`;
        const blocked = await this.redis.get(blockKey);
        return blocked === '1';
    }

    async reset(userId: string, operation: string): Promise<void> {
        const key = `rl:${operation}:${userId}`;
        const blockKey = `rl:block:${operation}:${userId}`;

        if (this.useMemory) {
            this.memoryStore.delete(key);
            return;
        }

        if (this.redis) {
            await this.redis.del([key, blockKey]);
        }
    }

    async getUsage(userId: string, operation: string): Promise<{
        used: number;
        limit: number;
        resetAt: Date;
    }> {
        const config = this.limits[operation];
        if (!config) {
            return { used: 0, limit: Infinity, resetAt: new Date() };
        }

        const key = `rl:${operation}:${userId}`;

        if (this.useMemory) {
            const existing = this.memoryStore.get(key);
            if (!existing) {
                return { used: 0, limit: config.points, resetAt: new Date() };
            }
            return {
                used: config.points - existing.points,
                limit: config.points,
                resetAt: new Date(existing.resetAt),
            };
        }

        if (!this.redis) {
            return { used: 0, limit: config.points, resetAt: new Date() };
        }

        try {
            const count = await this.redis.zCard(key);
            const ttl = await this.redis.ttl(key);

            return {
                used: count,
                limit: config.points,
                resetAt: new Date(Date.now() + ttl * 1000),
            };
        } catch {
            return { used: 0, limit: config.points, resetAt: new Date() };
        }
    }

    getConfig(operation: string): RateLimitConfig | undefined {
        return this.limits[operation];
    }

    setConfig(operation: string, config: RateLimitConfig): void {
        this.limits[operation] = config;
    }

    cleanupMemory(): void {
        if (!this.useMemory) return;

        const now = Date.now();
        for (const [key, value] of this.memoryStore.entries()) {
            if (now > value.resetAt) {
                this.memoryStore.delete(key);
            }
        }
    }

    startCleanupInterval(intervalMs: number = 60000): NodeJS.Timeout {
        return setInterval(() => this.cleanupMemory(), intervalMs);
    }
}
