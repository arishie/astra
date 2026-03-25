import { Gateway, AuthLevel } from '../gateway/Gateway.js';
import { SandboxManager, SandboxMode } from '../security/SandboxManager.js';
import * as path from 'path';
import * as fs from 'fs';

interface ParsedCommand {
    base: string;
    args: string[];
    raw: string;
}

interface CommandWhitelistEntry {
    command: string;
    allowedArgs?: RegExp[];
    blockedArgs?: RegExp[];
    requiresElevation: boolean;
    maxArgs?: number;
}

const DANGEROUS_PATTERNS = [
    /[;&|`$(){}[\]<>\\]/,
    /\.\.\//,
    /^-/,
    /\n|\r/,
    /\x00/,
];

const DANGEROUS_PATH_PATTERNS = [
    /^\//,
    /^~\//,
    /\.\.\//,
    /\/etc\//,
    /\/root\//,
    /\/home\//,
    /\/var\//,
    /\/usr\//,
    /\/bin\//,
    /\/sbin\//,
    /\/proc\//,
    /\/sys\//,
    /\/dev\//,
];

export class CapabilityManager {
    private gateway: Gateway;
    private sandbox: SandboxManager;
    private whitelist: Map<string, CommandWhitelistEntry>;
    private workspaceRoot: string;

    constructor(gateway: Gateway, workspaceRoot?: string) {
        this.gateway = gateway;
        this.sandbox = new SandboxManager(SandboxMode.DOCKER);
        this.workspaceRoot = workspaceRoot || path.resolve('./workspace');
        this.whitelist = new Map();

        this.initializeWhitelist();
        this.ensureWorkspaceExists();
    }

    private initializeWhitelist() {
        const defaultCommands: CommandWhitelistEntry[] = [
            {
                command: 'ls',
                allowedArgs: [/^[a-zA-Z0-9_\-./]+$/],
                blockedArgs: DANGEROUS_PATH_PATTERNS,
                requiresElevation: false,
                maxArgs: 3,
            },
            {
                command: 'date',
                allowedArgs: [/^[+%a-zA-Z\-]+$/],
                requiresElevation: false,
                maxArgs: 1,
            },
            {
                command: 'whoami',
                requiresElevation: false,
                maxArgs: 0,
            },
            {
                command: 'pwd',
                requiresElevation: false,
                maxArgs: 0,
            },
            {
                command: 'echo',
                allowedArgs: [/^[a-zA-Z0-9_\-.\s]+$/],
                requiresElevation: false,
                maxArgs: 10,
            },
            {
                command: 'cat',
                allowedArgs: [/^[a-zA-Z0-9_\-./]+$/],
                blockedArgs: DANGEROUS_PATH_PATTERNS,
                requiresElevation: false,
                maxArgs: 1,
            },
            {
                command: 'head',
                allowedArgs: [/^[a-zA-Z0-9_\-./]+$/, /^-n$/, /^\d+$/],
                blockedArgs: DANGEROUS_PATH_PATTERNS,
                requiresElevation: false,
                maxArgs: 3,
            },
            {
                command: 'tail',
                allowedArgs: [/^[a-zA-Z0-9_\-./]+$/, /^-n$/, /^\d+$/],
                blockedArgs: DANGEROUS_PATH_PATTERNS,
                requiresElevation: false,
                maxArgs: 3,
            },
            {
                command: 'wc',
                allowedArgs: [/^-[lcw]+$/, /^[a-zA-Z0-9_\-./]+$/],
                blockedArgs: DANGEROUS_PATH_PATTERNS,
                requiresElevation: false,
                maxArgs: 2,
            },
            {
                command: 'git',
                allowedArgs: [/^(status|log|diff|branch|show|blame)$/, /^[a-zA-Z0-9_\-./]+$/],
                requiresElevation: false,
                maxArgs: 5,
            },
            {
                command: 'npm',
                allowedArgs: [/^(run|test|list|outdated|audit)$/, /^[a-zA-Z0-9_\-:]+$/],
                requiresElevation: true,
                maxArgs: 3,
            },
            {
                command: 'python3',
                allowedArgs: [/^[a-zA-Z0-9_\-./]+\.py$/],
                blockedArgs: [/^-c$/, /^-m$/],
                requiresElevation: true,
                maxArgs: 2,
            },
            {
                command: 'node',
                allowedArgs: [/^[a-zA-Z0-9_\-./]+\.js$/],
                blockedArgs: [/^-e$/, /^--eval$/],
                requiresElevation: true,
                maxArgs: 2,
            },
        ];

        for (const entry of defaultCommands) {
            this.whitelist.set(entry.command, entry);
        }
    }

    private ensureWorkspaceExists() {
        if (!fs.existsSync(this.workspaceRoot)) {
            fs.mkdirSync(this.workspaceRoot, { recursive: true });
        }
    }

    private parseCommand(commandString: string): ParsedCommand {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < commandString.length; i++) {
            const char = commandString[i];

            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
            } else if (!inQuotes && char === ' ') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current) {
            tokens.push(current);
        }

        return {
            base: tokens[0] || '',
            args: tokens.slice(1),
            raw: commandString,
        };
    }

    private containsDangerousPatterns(value: string): boolean {
        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(value)) {
                return true;
            }
        }
        return false;
    }

    private validateCommand(parsed: ParsedCommand): { valid: boolean; error?: string } {
        const entry = this.whitelist.get(parsed.base);

        if (!entry) {
            return { valid: false, error: `Command '${parsed.base}' is not whitelisted` };
        }

        if (entry.maxArgs !== undefined && parsed.args.length > entry.maxArgs) {
            return { valid: false, error: `Too many arguments for '${parsed.base}' (max: ${entry.maxArgs})` };
        }

        for (const arg of parsed.args) {
            if (this.containsDangerousPatterns(arg)) {
                return { valid: false, error: `Dangerous pattern detected in argument: ${arg}` };
            }

            if (entry.blockedArgs) {
                for (const blocked of entry.blockedArgs) {
                    if (blocked.test(arg)) {
                        return { valid: false, error: `Blocked argument pattern detected: ${arg}` };
                    }
                }
            }

            if (entry.allowedArgs) {
                let matchesAllowed = false;
                for (const allowed of entry.allowedArgs) {
                    if (allowed.test(arg)) {
                        matchesAllowed = true;
                        break;
                    }
                }
                if (!matchesAllowed) {
                    return { valid: false, error: `Argument '${arg}' does not match allowed patterns` };
                }
            }
        }

        return { valid: true };
    }

    private sanitizePath(filePath: string): string {
        const resolved = path.resolve(this.workspaceRoot, filePath);

        if (!resolved.startsWith(this.workspaceRoot)) {
            throw new Error('Path traversal detected');
        }

        return resolved;
    }

    public async executeCommand(command: string, authToken: string, userId?: string): Promise<string> {
        const parsed = this.parseCommand(command);

        console.log(`[CapabilityManager] Validating command: ${parsed.base} with ${parsed.args.length} args`);

        const validation = this.validateCommand(parsed);
        if (!validation.valid) {
            throw new Error(`[CapabilityManager] ${validation.error}`);
        }

        const entry = this.whitelist.get(parsed.base)!;

        if (entry.requiresElevation) {
            const hasAccess = await this.gateway.checkAccess(authToken, AuthLevel.HIGH_SECURITY);
            if (!hasAccess) {
                const elevation = await this.gateway.requestElevation(authToken, `Execute command: ${parsed.base}`);
                if (!elevation || elevation.requiresApproval) {
                    throw new Error('[CapabilityManager] HIGH_SECURITY authorization required. Elevation pending.');
                }
            }
        } else {
            const hasAccess = await this.gateway.checkAccess(authToken, AuthLevel.BASIC);
            if (!hasAccess) {
                throw new Error('[CapabilityManager] Authentication required');
            }
        }

        console.log(`[CapabilityManager] Executing in sandbox: "${command}"`);

        try {
            const sanitizedArgs = parsed.args.map(arg => {
                if (arg.includes('/') || arg.includes('.')) {
                    return this.sanitizePath(arg);
                }
                return arg;
            });

            const sanitizedCommand = [parsed.base, ...sanitizedArgs].join(' ');
            const output = await this.sandbox.execute(sanitizedCommand, userId);
            return output;
        } catch (e: any) {
            console.error(`[CapabilityManager] Execution failed: ${e.message}`);
            throw new Error(`Execution failed: ${e.message}`);
        }
    }

    public async writeToFile(filePath: string, content: string, authToken: string): Promise<void> {
        const hasAccess = await this.gateway.checkAccess(authToken, AuthLevel.HIGH_SECURITY);
        if (!hasAccess) {
            const elevation = await this.gateway.requestElevation(authToken, `Write file: ${filePath}`);
            if (!elevation || elevation.requiresApproval) {
                throw new Error('[CapabilityManager] HIGH_SECURITY authorization required for file writes');
            }
        }

        let sanitizedPath: string;
        try {
            sanitizedPath = this.sanitizePath(filePath);
        } catch (e) {
            throw new Error('[CapabilityManager] Path traversal detected. Write rejected.');
        }

        const dir = path.dirname(sanitizedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(sanitizedPath, content);
        console.log(`[CapabilityManager] Wrote file: ${sanitizedPath}`);
    }

    public async readFile(filePath: string, authToken: string): Promise<string> {
        const hasAccess = await this.gateway.checkAccess(authToken, AuthLevel.BASIC);
        if (!hasAccess) {
            throw new Error('[CapabilityManager] Authentication required');
        }

        let sanitizedPath: string;
        try {
            sanitizedPath = this.sanitizePath(filePath);
        } catch (e) {
            throw new Error('[CapabilityManager] Path traversal detected. Read rejected.');
        }

        if (!fs.existsSync(sanitizedPath)) {
            throw new Error(`[CapabilityManager] File not found: ${filePath}`);
        }

        return fs.readFileSync(sanitizedPath, 'utf-8');
    }

    public addToWhitelist(entry: CommandWhitelistEntry, authToken: string): void {
        const hasAccess = this.gateway.checkAccess(authToken, AuthLevel.HIGH_SECURITY);
        if (!hasAccess) {
            throw new Error('[CapabilityManager] Admin privileges required to modify whitelist');
        }
        this.whitelist.set(entry.command, entry);
        console.log(`[CapabilityManager] Added to whitelist: ${entry.command}`);
    }

    public removeFromWhitelist(command: string, authToken: string): boolean {
        const hasAccess = this.gateway.checkAccess(authToken, AuthLevel.HIGH_SECURITY);
        if (!hasAccess) {
            throw new Error('[CapabilityManager] Admin privileges required to modify whitelist');
        }
        const result = this.whitelist.delete(command);
        if (result) {
            console.log(`[CapabilityManager] Removed from whitelist: ${command}`);
        }
        return result;
    }

    public listWhitelistedCommands(): string[] {
        return Array.from(this.whitelist.keys());
    }

    public getCommandInfo(command: string): CommandWhitelistEntry | undefined {
        return this.whitelist.get(command);
    }

    public setSandboxMode(mode: SandboxMode): void {
        this.sandbox.setMode(mode);
    }

    public getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }
}
