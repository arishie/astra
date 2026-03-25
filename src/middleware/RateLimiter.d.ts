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
export declare class RateLimiter {
    private redis;
    private memoryStore;
    private limits;
    private useMemory;
    constructor(customLimits?: Partial<Record<string, RateLimitConfig>>);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    checkLimit(userId: string, operation: string, cost?: number): Promise<RateLimitResult>;
    private checkMemoryLimit;
    private checkRedisLimit;
    consume(userId: string, operation: string, cost?: number): Promise<RateLimitResult>;
    isBlocked(userId: string, operation: string): Promise<boolean>;
    reset(userId: string, operation: string): Promise<void>;
    getUsage(userId: string, operation: string): Promise<{
        used: number;
        limit: number;
        resetAt: Date;
    }>;
    getConfig(operation: string): RateLimitConfig | undefined;
    setConfig(operation: string, config: RateLimitConfig): void;
    cleanupMemory(): void;
    startCleanupInterval(intervalMs?: number): NodeJS.Timeout;
}
export {};
//# sourceMappingURL=RateLimiter.d.ts.map