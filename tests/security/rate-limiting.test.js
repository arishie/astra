import { describe, it, expect, beforeEach, vi } from 'vitest';
/**
 * Rate Limiting Security Tests
 *
 * These tests verify that rate limiting properly protects against
 * abuse and ensures fair resource allocation across users.
 */
describe('Rate Limiting Security', () => {
    describe('Token Bucket Algorithm', () => {
        class TokenBucket {
            tokens;
            lastRefill;
            maxTokens;
            refillRate; // tokens per second
            constructor(maxTokens, refillRate) {
                this.maxTokens = maxTokens;
                this.tokens = maxTokens;
                this.refillRate = refillRate;
                this.lastRefill = Date.now();
            }
            refill() {
                const now = Date.now();
                const elapsed = (now - this.lastRefill) / 1000;
                const tokensToAdd = elapsed * this.refillRate;
                this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
                this.lastRefill = now;
            }
            consume(tokens = 1) {
                this.refill();
                if (this.tokens >= tokens) {
                    this.tokens -= tokens;
                    return true;
                }
                return false;
            }
            getTokens() {
                this.refill();
                return this.tokens;
            }
        }
        it('should allow requests when tokens available', () => {
            const bucket = new TokenBucket(10, 1);
            expect(bucket.consume(1)).toBe(true);
            expect(bucket.consume(1)).toBe(true);
        });
        it('should block requests when tokens exhausted', () => {
            const bucket = new TokenBucket(2, 0.001); // Very slow refill
            expect(bucket.consume(1)).toBe(true);
            expect(bucket.consume(1)).toBe(true);
            expect(bucket.consume(1)).toBe(false);
        });
        it('should handle burst requests up to max tokens', () => {
            const bucket = new TokenBucket(100, 1);
            for (let i = 0; i < 100; i++) {
                expect(bucket.consume(1)).toBe(true);
            }
            expect(bucket.consume(1)).toBe(false);
        });
        it('should handle variable cost operations', () => {
            const bucket = new TokenBucket(10, 1);
            expect(bucket.consume(5)).toBe(true); // Cost 5
            expect(bucket.consume(5)).toBe(true); // Cost 5
            expect(bucket.consume(1)).toBe(false); // No tokens left
        });
        it('should reject requests that exceed available tokens', () => {
            const bucket = new TokenBucket(5, 1);
            expect(bucket.consume(10)).toBe(false); // Can't consume more than available
        });
    });
    describe('Sliding Window Rate Limiter', () => {
        class SlidingWindowLimiter {
            requests = new Map();
            windowMs;
            maxRequests;
            constructor(windowMs, maxRequests) {
                this.windowMs = windowMs;
                this.maxRequests = maxRequests;
            }
            isAllowed(key) {
                const now = Date.now();
                const windowStart = now - this.windowMs;
                let timestamps = this.requests.get(key) || [];
                // Remove old timestamps
                timestamps = timestamps.filter((t) => t > windowStart);
                if (timestamps.length >= this.maxRequests) {
                    this.requests.set(key, timestamps);
                    return false;
                }
                timestamps.push(now);
                this.requests.set(key, timestamps);
                return true;
            }
            getRemaining(key) {
                const now = Date.now();
                const windowStart = now - this.windowMs;
                const timestamps = this.requests.get(key) || [];
                const validTimestamps = timestamps.filter((t) => t > windowStart);
                return Math.max(0, this.maxRequests - validTimestamps.length);
            }
            reset(key) {
                this.requests.delete(key);
            }
        }
        let limiter;
        beforeEach(() => {
            limiter = new SlidingWindowLimiter(60000, 10); // 10 requests per minute
        });
        it('should allow requests within limit', () => {
            for (let i = 0; i < 10; i++) {
                expect(limiter.isAllowed('user-1')).toBe(true);
            }
        });
        it('should block requests exceeding limit', () => {
            for (let i = 0; i < 10; i++) {
                limiter.isAllowed('user-1');
            }
            expect(limiter.isAllowed('user-1')).toBe(false);
        });
        it('should track users independently', () => {
            // Exhaust user-1
            for (let i = 0; i < 10; i++) {
                limiter.isAllowed('user-1');
            }
            expect(limiter.isAllowed('user-1')).toBe(false);
            // user-2 should be unaffected
            expect(limiter.isAllowed('user-2')).toBe(true);
        });
        it('should report remaining requests accurately', () => {
            expect(limiter.getRemaining('user-1')).toBe(10);
            limiter.isAllowed('user-1');
            expect(limiter.getRemaining('user-1')).toBe(9);
        });
        it('should allow reset of user limits', () => {
            for (let i = 0; i < 10; i++) {
                limiter.isAllowed('user-1');
            }
            expect(limiter.isAllowed('user-1')).toBe(false);
            limiter.reset('user-1');
            expect(limiter.isAllowed('user-1')).toBe(true);
        });
    });
    describe('Operation-Specific Limits', () => {
        const LIMITS = {
            chat: { points: 60, duration: 60 },
            hive: { points: 10, duration: 3600 },
            ingest: { points: 50, duration: 86400 },
            auth: { points: 5, duration: 300, blockDuration: 900 },
        };
        class OperationLimiter {
            store = new Map();
            check(userId, operation) {
                const config = LIMITS[operation];
                if (!config)
                    return { allowed: true, remaining: Infinity };
                const key = `${operation}:${userId}`;
                const now = Date.now();
                const existing = this.store.get(key);
                if (!existing || now > existing.resetAt) {
                    this.store.set(key, {
                        points: config.points - 1,
                        resetAt: now + config.duration * 1000,
                    });
                    return { allowed: true, remaining: config.points - 1 };
                }
                if (existing.points > 0) {
                    existing.points--;
                    return { allowed: true, remaining: existing.points };
                }
                return { allowed: false, remaining: 0 };
            }
        }
        let limiter;
        beforeEach(() => {
            limiter = new OperationLimiter();
        });
        it('should apply different limits per operation', () => {
            // Chat has 60 requests/minute
            for (let i = 0; i < 60; i++) {
                expect(limiter.check('user-1', 'chat').allowed).toBe(true);
            }
            expect(limiter.check('user-1', 'chat').allowed).toBe(false);
            // But hive still has quota
            expect(limiter.check('user-1', 'hive').allowed).toBe(true);
        });
        it('should have stricter limits for expensive operations', () => {
            // Hive only allows 10 per hour
            for (let i = 0; i < 10; i++) {
                expect(limiter.check('user-1', 'hive').allowed).toBe(true);
            }
            expect(limiter.check('user-1', 'hive').allowed).toBe(false);
        });
        it('should have very strict limits for auth operations', () => {
            // Auth only allows 5 attempts per 5 minutes
            for (let i = 0; i < 5; i++) {
                expect(limiter.check('user-1', 'auth').allowed).toBe(true);
            }
            expect(limiter.check('user-1', 'auth').allowed).toBe(false);
        });
        it('should allow unknown operations', () => {
            expect(limiter.check('user-1', 'unknown').allowed).toBe(true);
            expect(limiter.check('user-1', 'unknown').remaining).toBe(Infinity);
        });
    });
    describe('DDoS Protection Patterns', () => {
        class DDoSProtector {
            ipRequests = new Map();
            blockedIPs = new Set();
            windowMs = 1000; // 1 second
            maxRequestsPerSecond = 100;
            blockDurationMs = 60000; // 1 minute
            checkIP(ip) {
                if (this.blockedIPs.has(ip)) {
                    return { allowed: false, reason: 'IP blocked' };
                }
                const now = Date.now();
                const existing = this.ipRequests.get(ip);
                if (!existing || now - existing.firstSeen > this.windowMs) {
                    this.ipRequests.set(ip, { count: 1, firstSeen: now });
                    return { allowed: true };
                }
                existing.count++;
                if (existing.count > this.maxRequestsPerSecond) {
                    this.blockIP(ip);
                    return { allowed: false, reason: 'Rate limit exceeded - IP blocked' };
                }
                return { allowed: true };
            }
            blockIP(ip) {
                this.blockedIPs.add(ip);
                setTimeout(() => {
                    this.blockedIPs.delete(ip);
                }, this.blockDurationMs);
            }
            isBlocked(ip) {
                return this.blockedIPs.has(ip);
            }
        }
        let protector;
        beforeEach(() => {
            protector = new DDoSProtector();
        });
        it('should allow normal traffic', () => {
            for (let i = 0; i < 50; i++) {
                expect(protector.checkIP('192.168.1.1').allowed).toBe(true);
            }
        });
        it('should block IPs exceeding rate limit', () => {
            for (let i = 0; i < 100; i++) {
                protector.checkIP('192.168.1.1');
            }
            const result = protector.checkIP('192.168.1.1');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('blocked');
        });
        it('should not affect other IPs when one is blocked', () => {
            // Block IP 1
            for (let i = 0; i < 150; i++) {
                protector.checkIP('192.168.1.1');
            }
            expect(protector.isBlocked('192.168.1.1')).toBe(true);
            // IP 2 should still work
            expect(protector.checkIP('192.168.1.2').allowed).toBe(true);
        });
        it('should continue blocking after initial block', () => {
            // Trigger block
            for (let i = 0; i < 150; i++) {
                protector.checkIP('192.168.1.1');
            }
            // Subsequent requests should also be blocked
            expect(protector.checkIP('192.168.1.1').allowed).toBe(false);
            expect(protector.checkIP('192.168.1.1').allowed).toBe(false);
        });
    });
    describe('Fail-Closed Behavior', () => {
        class SafeRateLimiter {
            redis = null;
            memoryFallback = new Map();
            setRedis(connected) {
                this.redis = { isConnected: connected };
            }
            check(userId) {
                // If Redis is down, use memory fallback (fail closed, not open)
                if (!this.redis || !this.redis.isConnected) {
                    const count = this.memoryFallback.get(userId) || 0;
                    if (count >= 10) {
                        // Conservative limit when in fallback mode
                        return { allowed: false, usingFallback: true };
                    }
                    this.memoryFallback.set(userId, count + 1);
                    return { allowed: true, usingFallback: true };
                }
                // Normal Redis-based limiting
                return { allowed: true, usingFallback: false };
            }
        }
        let limiter;
        beforeEach(() => {
            limiter = new SafeRateLimiter();
        });
        it('should use Redis when available', () => {
            limiter.setRedis(true);
            const result = limiter.check('user-1');
            expect(result.usingFallback).toBe(false);
        });
        it('should fall back to memory when Redis unavailable', () => {
            limiter.setRedis(false);
            const result = limiter.check('user-1');
            expect(result.usingFallback).toBe(true);
        });
        it('should still enforce limits in fallback mode', () => {
            limiter.setRedis(false);
            // Should allow up to limit
            for (let i = 0; i < 10; i++) {
                expect(limiter.check('user-1').allowed).toBe(true);
            }
            // Should block after limit
            expect(limiter.check('user-1').allowed).toBe(false);
        });
        it('should NOT fail open (allow unlimited) when Redis down', () => {
            limiter.setRedis(false);
            // Simulate many requests
            let blockedCount = 0;
            for (let i = 0; i < 100; i++) {
                if (!limiter.check('user-1').allowed) {
                    blockedCount++;
                }
            }
            // Should have blocked most requests
            expect(blockedCount).toBeGreaterThan(80);
        });
    });
});
describe('Abuse Prevention', () => {
    describe('Account Enumeration Prevention', () => {
        const users = new Set(['user1@example.com', 'user2@example.com']);
        function checkUserExists(email) {
            // Always return same message and similar timing
            // to prevent account enumeration
            const baseDelay = 100;
            const jitter = Math.random() * 50;
            // Don't reveal whether user exists
            return {
                message: 'If an account exists, a reset email has been sent.',
                delay: baseDelay + jitter,
            };
        }
        it('should return same message for existing users', () => {
            const result = checkUserExists('user1@example.com');
            expect(result.message).toBe('If an account exists, a reset email has been sent.');
        });
        it('should return same message for non-existing users', () => {
            const result = checkUserExists('nonexistent@example.com');
            expect(result.message).toBe('If an account exists, a reset email has been sent.');
        });
        it('should have similar response times', () => {
            const existingResult = checkUserExists('user1@example.com');
            const nonExistingResult = checkUserExists('nonexistent@example.com');
            // Both should have delays in similar range
            expect(existingResult.delay).toBeGreaterThan(90);
            expect(existingResult.delay).toBeLessThan(160);
            expect(nonExistingResult.delay).toBeGreaterThan(90);
            expect(nonExistingResult.delay).toBeLessThan(160);
        });
    });
    describe('Brute Force Protection', () => {
        class BruteForceProtector {
            attempts = new Map();
            maxAttempts = 5;
            lockoutDuration = 15 * 60 * 1000; // 15 minutes
            recordAttempt(identifier, success) {
                const now = Date.now();
                const existing = this.attempts.get(identifier) || { count: 0 };
                // Check if currently locked
                if (existing.lockedUntil && now < existing.lockedUntil) {
                    return { locked: true, attemptsRemaining: 0 };
                }
                // Reset if lock expired
                if (existing.lockedUntil && now >= existing.lockedUntil) {
                    existing.count = 0;
                    existing.lockedUntil = undefined;
                }
                if (success) {
                    // Reset on success
                    this.attempts.delete(identifier);
                    return { locked: false, attemptsRemaining: this.maxAttempts };
                }
                existing.count++;
                if (existing.count >= this.maxAttempts) {
                    existing.lockedUntil = now + this.lockoutDuration;
                    this.attempts.set(identifier, existing);
                    return { locked: true, attemptsRemaining: 0 };
                }
                this.attempts.set(identifier, existing);
                return { locked: false, attemptsRemaining: this.maxAttempts - existing.count };
            }
            isLocked(identifier) {
                const existing = this.attempts.get(identifier);
                if (!existing?.lockedUntil)
                    return false;
                return Date.now() < existing.lockedUntil;
            }
        }
        let protector;
        beforeEach(() => {
            protector = new BruteForceProtector();
        });
        it('should allow attempts within limit', () => {
            for (let i = 0; i < 4; i++) {
                const result = protector.recordAttempt('user@example.com', false);
                expect(result.locked).toBe(false);
            }
        });
        it('should lock after max failed attempts', () => {
            for (let i = 0; i < 5; i++) {
                protector.recordAttempt('user@example.com', false);
            }
            expect(protector.isLocked('user@example.com')).toBe(true);
        });
        it('should reset count on successful login', () => {
            // 4 failed attempts
            for (let i = 0; i < 4; i++) {
                protector.recordAttempt('user@example.com', false);
            }
            // Successful login
            const result = protector.recordAttempt('user@example.com', true);
            expect(result.locked).toBe(false);
            expect(result.attemptsRemaining).toBe(5);
            // Should have full attempts again
            expect(protector.isLocked('user@example.com')).toBe(false);
        });
        it('should track attempts per identifier', () => {
            // Lock user1
            for (let i = 0; i < 5; i++) {
                protector.recordAttempt('user1@example.com', false);
            }
            expect(protector.isLocked('user1@example.com')).toBe(true);
            // user2 should not be affected
            expect(protector.isLocked('user2@example.com')).toBe(false);
        });
    });
    describe('Request Signature Validation', () => {
        function createHmac(data, secret) {
            // Simplified HMAC for testing (in real code use crypto.createHmac)
            let hash = 0;
            const combined = data + secret;
            for (let i = 0; i < combined.length; i++) {
                const char = combined.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16).padStart(8, '0');
        }
        function signRequest(payload, secret, timestamp) {
            const data = JSON.stringify(payload) + timestamp.toString();
            return createHmac(data, secret);
        }
        function verifyRequest(payload, signature, timestamp, secret) {
            // Check timestamp freshness (5 minute window)
            const now = Date.now();
            if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
                return { valid: false, error: 'Request expired' };
            }
            const expectedSignature = signRequest(payload, secret, timestamp);
            if (signature !== expectedSignature) {
                return { valid: false, error: 'Invalid signature' };
            }
            return { valid: true };
        }
        const SECRET = 'webhook-secret-key';
        it('should accept valid signatures', () => {
            const payload = { event: 'message', data: 'hello' };
            const timestamp = Date.now();
            const signature = signRequest(payload, SECRET, timestamp);
            const result = verifyRequest(payload, signature, timestamp, SECRET);
            expect(result.valid).toBe(true);
        });
        it('should reject invalid signatures', () => {
            const payload = { event: 'message', data: 'hello' };
            const timestamp = Date.now();
            const result = verifyRequest(payload, 'invalid-signature', timestamp, SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid signature');
        });
        it('should reject expired requests', () => {
            const payload = { event: 'message', data: 'hello' };
            const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
            const signature = signRequest(payload, SECRET, oldTimestamp);
            const result = verifyRequest(payload, signature, oldTimestamp, SECRET);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Request expired');
        });
        it('should reject tampered payloads', () => {
            const originalPayload = { event: 'message', data: 'hello' };
            const timestamp = Date.now();
            const signature = signRequest(originalPayload, SECRET, timestamp);
            const tamperedPayload = { event: 'message', data: 'hacked' };
            const result = verifyRequest(tamperedPayload, signature, timestamp, SECRET);
            expect(result.valid).toBe(false);
        });
        it('should reject requests with wrong secret', () => {
            const payload = { event: 'message', data: 'hello' };
            const timestamp = Date.now();
            const signature = signRequest(payload, 'wrong-secret', timestamp);
            const result = verifyRequest(payload, signature, timestamp, SECRET);
            expect(result.valid).toBe(false);
        });
    });
});
//# sourceMappingURL=rate-limiting.test.js.map