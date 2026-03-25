import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'crypto';

describe('JWT Security', () => {
    const JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars';

    function createMockJWT(payload: object, secret: string, expiresIn: number = 3600): string {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const fullPayload = {
            ...payload,
            iat: now,
            exp: now + expiresIn,
        };
        const payloadStr = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
        const signature = crypto
            .createHmac('sha256', secret)
            .update(`${header}.${payloadStr}`)
            .digest('base64url');
        return `${header}.${payloadStr}.${signature}`;
    }

    function verifyMockJWT(token: string, secret: string): { valid: boolean; payload?: any; error?: string } {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return { valid: false, error: 'Invalid token format' };
            }

            const header = parts[0];
            const payload = parts[1];
            const signature = parts[2];

            if (!header || !payload || !signature) {
                return { valid: false, error: 'Invalid token format' };
            }

            const expectedSig = crypto
                .createHmac('sha256', secret)
                .update(`${header}.${payload}`)
                .digest('base64url');

            if (signature !== expectedSig) {
                return { valid: false, error: 'Invalid signature' };
            }

            const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());

            if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
                return { valid: false, error: 'Token expired' };
            }

            return { valid: true, payload: decodedPayload };
        } catch {
            return { valid: false, error: 'Failed to parse token' };
        }
    }

    it('should create valid JWT tokens', () => {
        const token = createMockJWT({ sub: 'user123', email: 'test@example.com' }, JWT_SECRET);
        const result = verifyMockJWT(token, JWT_SECRET);
        expect(result.valid).toBe(true);
        expect(result.payload?.sub).toBe('user123');
    });

    it('should reject tokens with wrong secret', () => {
        const token = createMockJWT({ sub: 'user123' }, JWT_SECRET);
        const result = verifyMockJWT(token, 'wrong-secret');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid signature');
    });

    it('should reject expired tokens', () => {
        const token = createMockJWT({ sub: 'user123' }, JWT_SECRET, -3600);
        const result = verifyMockJWT(token, JWT_SECRET);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Token expired');
    });

    it('should reject malformed tokens', () => {
        expect(verifyMockJWT('invalid', JWT_SECRET).valid).toBe(false);
        expect(verifyMockJWT('a.b', JWT_SECRET).valid).toBe(false);
        expect(verifyMockJWT('a.b.c.d', JWT_SECRET).valid).toBe(false);
    });

    it('should reject tampered tokens', () => {
        const token = createMockJWT({ sub: 'user123', role: 'user' }, JWT_SECRET);
        const parts = token.split('.');

        const tamperedPayload = Buffer.from(
            JSON.stringify({ sub: 'user123', role: 'admin', iat: Date.now() / 1000, exp: Date.now() / 1000 + 3600 })
        ).toString('base64url');

        const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
        const result = verifyMockJWT(tamperedToken, JWT_SECRET);
        expect(result.valid).toBe(false);
    });
});

describe('Password Hashing', () => {
    function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
        const actualSalt = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
        return { hash, salt: actualSalt };
    }

    function verifyPassword(password: string, hash: string, salt: string): boolean {
        const result = hashPassword(password, salt);
        return crypto.timingSafeEqual(Buffer.from(result.hash), Buffer.from(hash));
    }

    it('should hash passwords consistently with same salt', () => {
        const password = 'secure-password-123';
        const { hash: hash1, salt } = hashPassword(password);
        const { hash: hash2 } = hashPassword(password, salt);
        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes with different salts', () => {
        const password = 'secure-password-123';
        const { hash: hash1 } = hashPassword(password);
        const { hash: hash2 } = hashPassword(password);
        expect(hash1).not.toBe(hash2);
    });

    it('should verify correct passwords', () => {
        const password = 'my-secure-password';
        const { hash, salt } = hashPassword(password);
        expect(verifyPassword(password, hash, salt)).toBe(true);
    });

    it('should reject incorrect passwords', () => {
        const password = 'my-secure-password';
        const { hash, salt } = hashPassword(password);
        expect(verifyPassword('wrong-password', hash, salt)).toBe(false);
    });
});

describe('API Key Security', () => {
    function generateApiKey(): string {
        return `astra_${crypto.randomBytes(32).toString('hex')}`;
    }

    function hashApiKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    function maskApiKey(key: string): string {
        if (key.length < 12) return '****';
        return `${key.slice(0, 8)}...${key.slice(-4)}`;
    }

    it('should generate secure API keys', () => {
        const key = generateApiKey();
        expect(key).toMatch(/^astra_[a-f0-9]{64}$/);
    });

    it('should generate unique API keys', () => {
        const keys = new Set<string>();
        for (let i = 0; i < 100; i++) {
            keys.add(generateApiKey());
        }
        expect(keys.size).toBe(100);
    });

    it('should hash API keys consistently', () => {
        const key = generateApiKey();
        const hash1 = hashApiKey(key);
        const hash2 = hashApiKey(key);
        expect(hash1).toBe(hash2);
    });

    it('should mask API keys for display', () => {
        const key = 'astra_abcdef1234567890abcdef1234567890';
        const masked = maskApiKey(key);
        expect(masked).toBe('astra_ab...7890');
        expect(masked).not.toContain('cdef1234567890abcdef123456');
    });
});

describe('Encryption Security', () => {
    function encrypt(plaintext: string, key: Buffer): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return JSON.stringify({
            iv: iv.toString('hex'),
            data: encrypted,
            tag: authTag.toString('hex'),
        });
    }

    function decrypt(encrypted: string, key: Buffer): string {
        const { iv, data, tag } = JSON.parse(encrypted);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    const key = crypto.scryptSync('master-key', 'salt', 32);

    it('should encrypt and decrypt data correctly', () => {
        const original = 'sk-1234567890abcdef';
        const encrypted = encrypt(original, key);
        const decrypted = decrypt(encrypted, key);
        expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for same plaintext', () => {
        const original = 'same-data';
        const encrypted1 = encrypt(original, key);
        const encrypted2 = encrypt(original, key);
        expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail with wrong key', () => {
        const original = 'secret-data';
        const encrypted = encrypt(original, key);
        const wrongKey = crypto.scryptSync('wrong-key', 'salt', 32);
        expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('should fail with tampered data', () => {
        const original = 'secret-data';
        const encrypted = encrypt(original, key);
        const parsed = JSON.parse(encrypted);
        parsed.data = 'tampered' + parsed.data.slice(8);
        expect(() => decrypt(JSON.stringify(parsed), key)).toThrow();
    });

    it('should fail with tampered auth tag', () => {
        const original = 'secret-data';
        const encrypted = encrypt(original, key);
        const parsed = JSON.parse(encrypted);
        parsed.tag = crypto.randomBytes(16).toString('hex');
        expect(() => decrypt(JSON.stringify(parsed), key)).toThrow();
    });
});

describe('Rate Limiting Security', () => {
    class MockRateLimiter {
        private store: Map<string, { points: number; resetAt: number }> = new Map();
        private limits: Map<string, { points: number; duration: number }>;

        constructor() {
            this.limits = new Map([
                ['auth', { points: 5, duration: 300 }],
                ['api', { points: 100, duration: 60 }],
            ]);
        }

        check(key: string, operation: string): { allowed: boolean; remaining: number } {
            const limit = this.limits.get(operation);
            if (!limit) return { allowed: true, remaining: Infinity };

            const now = Date.now();
            const storeKey = `${operation}:${key}`;
            const existing = this.store.get(storeKey);

            if (!existing || now > existing.resetAt) {
                this.store.set(storeKey, {
                    points: limit.points - 1,
                    resetAt: now + limit.duration * 1000,
                });
                return { allowed: true, remaining: limit.points - 1 };
            }

            if (existing.points > 0) {
                existing.points--;
                return { allowed: true, remaining: existing.points };
            }

            return { allowed: false, remaining: 0 };
        }
    }

    it('should allow requests within limit', () => {
        const limiter = new MockRateLimiter();
        for (let i = 0; i < 5; i++) {
            const result = limiter.check('user1', 'auth');
            expect(result.allowed).toBe(true);
        }
    });

    it('should block requests exceeding limit', () => {
        const limiter = new MockRateLimiter();
        for (let i = 0; i < 5; i++) {
            limiter.check('user1', 'auth');
        }
        const result = limiter.check('user1', 'auth');
        expect(result.allowed).toBe(false);
    });

    it('should track limits per user', () => {
        const limiter = new MockRateLimiter();
        for (let i = 0; i < 5; i++) {
            limiter.check('user1', 'auth');
        }
        const result = limiter.check('user2', 'auth');
        expect(result.allowed).toBe(true);
    });

    it('should track limits per operation', () => {
        const limiter = new MockRateLimiter();
        for (let i = 0; i < 5; i++) {
            limiter.check('user1', 'auth');
        }
        const result = limiter.check('user1', 'api');
        expect(result.allowed).toBe(true);
    });
});
