import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Penetration Testing Patterns
 *
 * These tests simulate common attack vectors to ensure
 * the application properly defends against them.
 */

describe('Penetration Testing - Injection Attacks', () => {
    describe('NoSQL Injection Prevention', () => {
        function sanitizeMongoQuery(input: any): any {
            if (typeof input === 'string') {
                return input;
            }

            if (typeof input === 'object' && input !== null) {
                // Reject objects that look like MongoDB operators
                const keys = Object.keys(input);
                for (const key of keys) {
                    if (key.startsWith('$')) {
                        throw new Error('Invalid query: MongoDB operators not allowed');
                    }
                }
            }

            return input;
        }

        const nosqlInjectionPayloads = [
            { $gt: '' },
            { $ne: null },
            { $regex: '.*' },
            { $where: 'function() { return true; }' },
            { $or: [{ password: { $exists: true } }] },
        ];

        nosqlInjectionPayloads.forEach((payload, index) => {
            it(`should reject NoSQL injection payload ${index + 1}`, () => {
                expect(() => sanitizeMongoQuery(payload)).toThrow('MongoDB operators not allowed');
            });
        });

        it('should allow normal string inputs', () => {
            expect(sanitizeMongoQuery('user@example.com')).toBe('user@example.com');
            expect(sanitizeMongoQuery('password123')).toBe('password123');
        });
    });

    describe('LDAP Injection Prevention', () => {
        function escapeLDAP(input: string): string {
            return input
                .replace(/\\/g, '\\5c')
                .replace(/\*/g, '\\2a')
                .replace(/\(/g, '\\28')
                .replace(/\)/g, '\\29')
                .replace(/\x00/g, '\\00');
        }

        function buildLDAPQuery(username: string): string {
            const escaped = escapeLDAP(username);
            return `(&(uid=${escaped})(objectClass=user))`;
        }

        it('should escape LDAP special characters', () => {
            expect(buildLDAPQuery('user*')).toBe('(&(uid=user\\2a)(objectClass=user))');
            expect(buildLDAPQuery('user)(uid=*))(|(uid=')).toContain('\\28');
            expect(buildLDAPQuery('user\\admin')).toContain('\\5c');
        });

        it('should prevent LDAP injection attacks', () => {
            const malicious = '*)(uid=*))(|(uid=*';
            const query = buildLDAPQuery(malicious);

            // Should not allow wildcard search
            expect(query).not.toBe('(&(uid=*)(uid=*))(|(uid=*)(objectClass=user))');
            // Should have escaped characters
            expect(query).toContain('\\2a'); // Escaped *
            expect(query).toContain('\\28'); // Escaped (
            expect(query).toContain('\\29'); // Escaped )
        });
    });

    describe('XML/XXE Injection Prevention', () => {
        function isXXEAttempt(xml: string): boolean {
            const xxePatterns = [
                /<!ENTITY/i,
                /<!DOCTYPE[^>]*\[/i,
                /SYSTEM\s+["'][^"']*["']/i,
                /PUBLIC\s+["'][^"']*["']/i,
                /file:\/\//i,
                /expect:\/\//i,
                /php:\/\//i,
            ];

            return xxePatterns.some((pattern) => pattern.test(xml));
        }

        const xxePayloads = [
            '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
            '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/xxe">]><foo>&xxe;</foo>',
            '<!DOCTYPE foo [<!ELEMENT foo ANY><!ENTITY xxe SYSTEM "expect://id">]>',
            '<?xml version="1.0"?><!DOCTYPE data [<!ENTITY file SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">]>',
        ];

        xxePayloads.forEach((payload, index) => {
            it(`should detect XXE payload ${index + 1}`, () => {
                expect(isXXEAttempt(payload)).toBe(true);
            });
        });

        it('should allow normal XML', () => {
            expect(isXXEAttempt('<user><name>John</name></user>')).toBe(false);
            expect(isXXEAttempt('<?xml version="1.0"?><data>content</data>')).toBe(false);
        });
    });

    describe('Template Injection Prevention', () => {
        function containsTemplateInjection(input: string): boolean {
            const patterns = [
                /\{\{.*\}\}/,           // Mustache/Handlebars
                /\$\{.*\}/,             // ES6 template literals
                /<%(.*?)%>/,            // EJS/ERB
                /\{#.*#\}/,             // Jinja2 comments
                /\{\%.*\%\}/,           // Jinja2/Django
                /\[\[.*\]\]/,           // Pebble
            ];

            return patterns.some((pattern) => pattern.test(input));
        }

        const stiPayloads = [
            '{{constructor.constructor("return process")().exit()}}',
            '${7*7}',
            '<%= system("id") %>',
            '{{config.items()}}',
            '{%import os%}{{os.popen("id").read()}}',
            '[[${7*7}]]',
        ];

        stiPayloads.forEach((payload, index) => {
            it(`should detect template injection payload ${index + 1}`, () => {
                expect(containsTemplateInjection(payload)).toBe(true);
            });
        });

        it('should allow normal text with braces', () => {
            expect(containsTemplateInjection('Hello {name}')).toBe(false);
            expect(containsTemplateInjection('Price: $100')).toBe(false);
        });
    });
});

describe('Penetration Testing - Authentication Bypass', () => {
    describe('JWT Algorithm Confusion Prevention', () => {
        interface JWTHeader {
            alg: string;
            typ: string;
        }

        function validateJWTAlgorithm(header: JWTHeader): { valid: boolean; error?: string } {
            const allowedAlgorithms = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'];

            // CRITICAL: Reject 'none' algorithm
            if (header.alg.toLowerCase() === 'none') {
                return { valid: false, error: 'Algorithm "none" is not allowed' };
            }

            // Reject unknown algorithms
            if (!allowedAlgorithms.includes(header.alg)) {
                return { valid: false, error: `Algorithm "${header.alg}" is not supported` };
            }

            return { valid: true };
        }

        it('should reject "none" algorithm', () => {
            const result = validateJWTAlgorithm({ alg: 'none', typ: 'JWT' });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('none');
        });

        it('should reject "None" (case variation)', () => {
            const result = validateJWTAlgorithm({ alg: 'None', typ: 'JWT' });
            expect(result.valid).toBe(false);
        });

        it('should reject "NONE" (uppercase)', () => {
            const result = validateJWTAlgorithm({ alg: 'NONE', typ: 'JWT' });
            expect(result.valid).toBe(false);
        });

        it('should reject unknown algorithms', () => {
            const result = validateJWTAlgorithm({ alg: 'HS1', typ: 'JWT' });
            expect(result.valid).toBe(false);
        });

        it('should accept valid algorithms', () => {
            expect(validateJWTAlgorithm({ alg: 'HS256', typ: 'JWT' }).valid).toBe(true);
            expect(validateJWTAlgorithm({ alg: 'RS256', typ: 'JWT' }).valid).toBe(true);
        });
    });

    describe('Session Fixation Prevention', () => {
        class SecureSessionManager {
            private sessions: Map<string, { userId: string; createdAt: number }> = new Map();

            createSession(userId: string): string {
                // Always generate new session ID
                const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                this.sessions.set(sessionId, { userId, createdAt: Date.now() });
                return sessionId;
            }

            regenerateSession(oldSessionId: string): string | null {
                const session = this.sessions.get(oldSessionId);
                if (!session) return null;

                // Delete old session
                this.sessions.delete(oldSessionId);

                // Create new session with same user
                return this.createSession(session.userId);
            }

            getSession(sessionId: string): { userId: string } | null {
                const session = this.sessions.get(sessionId);
                return session ? { userId: session.userId } : null;
            }
        }

        it('should generate new session ID on login', () => {
            const manager = new SecureSessionManager();
            const session1 = manager.createSession('user-1');
            const session2 = manager.createSession('user-1');

            // Each login should get unique session
            expect(session1).not.toBe(session2);
        });

        it('should invalidate old session on regeneration', () => {
            const manager = new SecureSessionManager();
            const oldSession = manager.createSession('user-1');
            const newSession = manager.regenerateSession(oldSession);

            // Old session should be invalid
            expect(manager.getSession(oldSession)).toBeNull();

            // New session should be valid
            expect(manager.getSession(newSession!)).not.toBeNull();
            expect(manager.getSession(newSession!)?.userId).toBe('user-1');
        });

        it('should not accept pre-set session IDs', () => {
            const manager = new SecureSessionManager();

            // Attacker tries to use pre-set session ID
            const attackerSession = 'attacker_controlled_session_id';
            expect(manager.getSession(attackerSession)).toBeNull();

            // Only sessions created by the manager should work
            const legitimateSession = manager.createSession('user-1');
            expect(manager.getSession(legitimateSession)).not.toBeNull();
        });
    });

    describe('OAuth State Parameter Validation', () => {
        class OAuthStateManager {
            private states: Map<string, { provider: string; expiresAt: number }> = new Map();
            private readonly stateTTL = 10 * 60 * 1000; // 10 minutes

            generateState(provider: string): string {
                const state = `state_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
                this.states.set(state, {
                    provider,
                    expiresAt: Date.now() + this.stateTTL,
                });
                return state;
            }

            validateState(state: string): { valid: boolean; provider?: string; error?: string } {
                const stored = this.states.get(state);

                if (!stored) {
                    return { valid: false, error: 'Invalid state parameter' };
                }

                // Delete to prevent replay
                this.states.delete(state);

                if (Date.now() > stored.expiresAt) {
                    return { valid: false, error: 'State expired' };
                }

                return { valid: true, provider: stored.provider };
            }
        }

        let stateManager: OAuthStateManager;

        beforeEach(() => {
            stateManager = new OAuthStateManager();
        });

        it('should validate legitimate state', () => {
            const state = stateManager.generateState('google');
            const result = stateManager.validateState(state);
            expect(result.valid).toBe(true);
            expect(result.provider).toBe('google');
        });

        it('should reject unknown state (CSRF prevention)', () => {
            const result = stateManager.validateState('attacker_state');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid state parameter');
        });

        it('should prevent state replay attacks', () => {
            const state = stateManager.generateState('google');

            // First use should succeed
            expect(stateManager.validateState(state).valid).toBe(true);

            // Second use should fail (replay attack)
            expect(stateManager.validateState(state).valid).toBe(false);
        });

        it('should generate unique states', () => {
            const states = new Set<string>();
            for (let i = 0; i < 100; i++) {
                states.add(stateManager.generateState('google'));
            }
            expect(states.size).toBe(100);
        });
    });
});

describe('Penetration Testing - Access Control', () => {
    describe('IDOR Prevention', () => {
        interface Resource {
            id: string;
            ownerId: string;
            data: string;
        }

        const resources: Resource[] = [
            { id: 'res-1', ownerId: 'user-a', data: 'User A secret' },
            { id: 'res-2', ownerId: 'user-b', data: 'User B secret' },
        ];

        function getResource(
            resourceId: string,
            requestingUserId: string
        ): { data: Resource } | { error: string } {
            const resource = resources.find((r) => r.id === resourceId);

            if (!resource) {
                return { error: 'Resource not found' };
            }

            // IDOR check: verify ownership
            if (resource.ownerId !== requestingUserId) {
                return { error: 'Access denied' };
            }

            return { data: resource };
        }

        it('should allow owner to access their resource', () => {
            const result = getResource('res-1', 'user-a');
            expect('data' in result).toBe(true);
            expect((result as any).data.data).toBe('User A secret');
        });

        it('should prevent accessing another user\'s resource', () => {
            const result = getResource('res-1', 'user-b');
            expect('error' in result).toBe(true);
            expect((result as any).error).toBe('Access denied');
        });

        it('should return not found for non-existent resources', () => {
            const result = getResource('res-999', 'user-a');
            expect('error' in result).toBe(true);
            expect((result as any).error).toBe('Resource not found');
        });
    });

    describe('Privilege Escalation via Parameter Tampering', () => {
        interface UpdateUserRequest {
            name?: string;
            email?: string;
            isAdmin?: boolean;
            role?: string;
        }

        const PROTECTED_FIELDS = ['isAdmin', 'role', 'permissions', 'authLevel'];

        function sanitizeUpdateRequest(
            request: UpdateUserRequest,
            isAdmin: boolean
        ): UpdateUserRequest {
            const sanitized: UpdateUserRequest = {};

            for (const [key, value] of Object.entries(request)) {
                // Non-admins cannot modify protected fields
                if (!isAdmin && PROTECTED_FIELDS.includes(key)) {
                    continue; // Skip protected field
                }
                (sanitized as any)[key] = value;
            }

            return sanitized;
        }

        it('should strip admin fields from non-admin requests', () => {
            const request = {
                name: 'New Name',
                isAdmin: true,
                role: 'admin',
            };

            const sanitized = sanitizeUpdateRequest(request, false);
            expect(sanitized.name).toBe('New Name');
            expect(sanitized.isAdmin).toBeUndefined();
            expect(sanitized.role).toBeUndefined();
        });

        it('should allow admin to set admin fields', () => {
            const request = {
                name: 'New Name',
                isAdmin: true,
                role: 'admin',
            };

            const sanitized = sanitizeUpdateRequest(request, true);
            expect(sanitized.isAdmin).toBe(true);
            expect(sanitized.role).toBe('admin');
        });

        it('should allow non-admin to update safe fields', () => {
            const request = {
                name: 'New Name',
                email: 'new@example.com',
            };

            const sanitized = sanitizeUpdateRequest(request, false);
            expect(sanitized.name).toBe('New Name');
            expect(sanitized.email).toBe('new@example.com');
        });
    });

    describe('Path Traversal in File Operations', () => {
        function isPathSafe(basePath: string, requestedPath: string): boolean {
            const path = require('path');

            // Reject obvious traversal patterns before resolving
            if (requestedPath.includes('..') ||
                requestedPath.startsWith('/') ||
                requestedPath.includes('\\') ||
                requestedPath.includes('%2f') ||
                requestedPath.includes('%2F')) {
                return false;
            }

            const resolved = path.resolve(basePath, requestedPath);
            const normalized = path.normalize(resolved);

            // Check if resolved path is within base path
            return normalized.startsWith(path.normalize(basePath));
        }

        function securePath(basePath: string, requestedPath: string): string | null {
            if (!isPathSafe(basePath, requestedPath)) {
                return null;
            }

            const path = require('path');
            return path.resolve(basePath, requestedPath);
        }

        const basePath = '/app/user-files';

        it('should allow paths within base directory', () => {
            expect(securePath(basePath, 'document.txt')).not.toBeNull();
            expect(securePath(basePath, 'subdir/file.txt')).not.toBeNull();
        });

        it('should block path traversal attempts', () => {
            expect(securePath(basePath, '../../../etc/passwd')).toBeNull();
            expect(securePath(basePath, '..\\..\\..\\windows\\system32')).toBeNull();
            expect(securePath(basePath, 'subdir/../../etc/passwd')).toBeNull();
        });

        it('should block encoded path traversal', () => {
            // These patterns should be blocked even before URL decoding
            expect(securePath(basePath, '..%2f..%2fetc/passwd')).toBeNull();
        });

        it('should handle absolute paths', () => {
            expect(securePath(basePath, '/etc/passwd')).toBeNull();
            expect(securePath(basePath, 'C:\\Windows\\System32')).toBeNull();
        });
    });
});

describe('Penetration Testing - Information Disclosure', () => {
    describe('Error Message Sanitization', () => {
        class SafeError extends Error {
            public readonly userMessage: string;
            public readonly internalDetails: string;

            constructor(userMessage: string, internalDetails: string) {
                super(userMessage);
                this.userMessage = userMessage;
                this.internalDetails = internalDetails;
            }
        }

        function handleError(error: Error): { message: string; code: number } {
            // Never expose internal error details to users
            if (error instanceof SafeError) {
                console.error(`[Internal] ${error.internalDetails}`);
                return { message: error.userMessage, code: 500 };
            }

            // Generic errors - use safe message
            console.error(`[Internal] ${error.message}`);
            return { message: 'An unexpected error occurred', code: 500 };
        }

        it('should hide database connection details', () => {
            const dbError = new Error('Connection refused to postgres://admin:secret@db.internal:5432/production');
            const response = handleError(dbError);

            expect(response.message).not.toContain('postgres');
            expect(response.message).not.toContain('admin');
            expect(response.message).not.toContain('secret');
            expect(response.message).not.toContain('db.internal');
        });

        it('should hide stack traces', () => {
            const error = new Error('Something failed');
            error.stack = 'Error: Something failed\n    at /app/src/secret/path.ts:42:13';

            const response = handleError(error);
            expect(response.message).not.toContain('/app/src');
            expect(response.message).not.toContain('path.ts');
        });

        it('should use safe error for known errors', () => {
            const error = new SafeError(
                'Invalid credentials',
                'User user@example.com attempted login with wrong password from IP 192.168.1.1'
            );

            const response = handleError(error);
            expect(response.message).toBe('Invalid credentials');
            expect(response.message).not.toContain('192.168.1.1');
            expect(response.message).not.toContain('user@example.com');
        });
    });

    describe('Header Information Disclosure', () => {
        function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
            const dangerousHeaders = [
                'x-powered-by',
                'server',
                'x-aspnet-version',
                'x-aspnetmvc-version',
            ];

            const sanitized: Record<string, string> = {};

            for (const [key, value] of Object.entries(headers)) {
                if (!dangerousHeaders.includes(key.toLowerCase())) {
                    sanitized[key] = value;
                }
            }

            return sanitized;
        }

        it('should remove X-Powered-By header', () => {
            const headers = {
                'Content-Type': 'application/json',
                'X-Powered-By': 'Express',
            };

            const sanitized = sanitizeHeaders(headers);
            expect(sanitized['X-Powered-By']).toBeUndefined();
        });

        it('should remove Server header', () => {
            const headers = {
                'Content-Type': 'application/json',
                'Server': 'nginx/1.19.0',
            };

            const sanitized = sanitizeHeaders(headers);
            expect(sanitized['Server']).toBeUndefined();
        });

        it('should preserve safe headers', () => {
            const headers = {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            };

            const sanitized = sanitizeHeaders(headers);
            expect(sanitized['Content-Type']).toBe('application/json');
            expect(sanitized['Cache-Control']).toBe('no-store');
        });
    });

    describe('Sensitive Data in Logs', () => {
        function sanitizeForLogging(data: Record<string, any>): Record<string, any> {
            const sensitiveFields = [
                'password',
                'token',
                'apiKey',
                'secret',
                'creditCard',
                'ssn',
                'accessToken',
                'refreshToken',
            ];

            const sanitized: Record<string, any> = {};

            for (const [key, value] of Object.entries(data)) {
                const isSensitive = sensitiveFields.some(
                    (field) => key.toLowerCase().includes(field.toLowerCase())
                );

                if (isSensitive) {
                    sanitized[key] = '[REDACTED]';
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = sanitizeForLogging(value);
                } else {
                    sanitized[key] = value;
                }
            }

            return sanitized;
        }

        it('should redact password fields', () => {
            const data = { username: 'john', password: 'secret123' };
            const sanitized = sanitizeForLogging(data);

            expect(sanitized.username).toBe('john');
            expect(sanitized.password).toBe('[REDACTED]');
        });

        it('should redact token fields', () => {
            const data = {
                userId: '123',
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: 'refresh_abc123',
            };
            const sanitized = sanitizeForLogging(data);

            expect(sanitized.userId).toBe('123');
            expect(sanitized.accessToken).toBe('[REDACTED]');
            expect(sanitized.refreshToken).toBe('[REDACTED]');
        });

        it('should redact nested sensitive fields', () => {
            const data = {
                user: {
                    name: 'John',
                    credentials: {
                        apiKey: 'sk-1234567890',
                    },
                },
            };
            const sanitized = sanitizeForLogging(data);

            expect(sanitized.user.name).toBe('John');
            expect(sanitized.user.credentials.apiKey).toBe('[REDACTED]');
        });

        it('should handle variations of sensitive field names', () => {
            const data = {
                userPassword: 'secret',
                apikey: 'key123',      // Without underscore for matching
                AccessToken: 'token',
            };
            const sanitized = sanitizeForLogging(data);

            expect(sanitized.userPassword).toBe('[REDACTED]');
            expect(sanitized.apikey).toBe('[REDACTED]');
            expect(sanitized.AccessToken).toBe('[REDACTED]');
        });
    });
});
