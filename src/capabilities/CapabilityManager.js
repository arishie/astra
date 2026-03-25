import { Gateway, AuthLevel } from '../gateway/Gateway.js';
import { SandboxManager, SandboxMode } from '../security/SandboxManager.js';
import * as path from 'path';
import * as fs from 'fs';
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
    gateway;
    sandbox;
    whitelist;
    workspaceRoot;
    constructor(gateway, workspaceRoot) {
        this.gateway = gateway;
        this.sandbox = new SandboxManager(SandboxMode.DOCKER);
        this.workspaceRoot = workspaceRoot || path.resolve('./workspace');
        this.whitelist = new Map();
        this.initializeWhitelist();
        this.ensureWorkspaceExists();
    }
    initializeWhitelist() {
        const defaultCommands = [
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
    ensureWorkspaceExists() {
        if (!fs.existsSync(this.workspaceRoot)) {
            fs.mkdirSync(this.workspaceRoot, { recursive: true });
        }
    }
    parseCommand(commandString) {
        const tokens = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        for (let i = 0; i < commandString.length; i++) {
            const char = commandString[i];
            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
            }
            else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
            }
            else if (!inQuotes && char === ' ') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            }
            else {
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
    containsDangerousPatterns(value) {
        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(value)) {
                return true;
            }
        }
        return false;
    }
    validateCommand(parsed) {
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
    sanitizePath(filePath) {
        const resolved = path.resolve(this.workspaceRoot, filePath);
        if (!resolved.startsWith(this.workspaceRoot)) {
            throw new Error('Path traversal detected');
        }
        return resolved;
    }
    async executeCommand(command, authToken, userId) {
        const parsed = this.parseCommand(command);
        console.log(`[CapabilityManager] Validating command: ${parsed.base} with ${parsed.args.length} args`);
        const validation = this.validateCommand(parsed);
        if (!validation.valid) {
            throw new Error(`[CapabilityManager] ${validation.error}`);
        }
        const entry = this.whitelist.get(parsed.base);
        if (entry.requiresElevation) {
            const hasAccess = await this.gateway.checkAccess(authToken, AuthLevel.HIGH_SECURITY);
            if (!hasAccess) {
                const elevation = await this.gateway.requestElevation(authToken, `Execute command: ${parsed.base}`);
                if (!elevation || elevation.requiresApproval) {
                    throw new Error('[CapabilityManager] HIGH_SECURITY authorization required. Elevation pending.');
                }
            }
        }
        else {
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
        }
        catch (e) {
            console.error(`[CapabilityManager] Execution failed: ${e.message}`);
            throw new Error(`Execution failed: ${e.message}`);
        }
    }
    async writeToFile(filePath, content, authToken) {
        const hasAccess = await this.gateway.checkAccess(authToken, AuthLevel.HIGH_SECURITY);
        if (!hasAccess) {
            const elevation = await this.gateway.requestElevation(authToken, `Write file: ${filePath}`);
            if (!elevation || elevation.requiresApproval) {
                throw new Error('[CapabilityManager] HIGH_SECURITY authorization required for file writes');
            }
        }
        let sanitizedPath;
        try {
            sanitizedPath = this.sanitizePath(filePath);
        }
        catch (e) {
            throw new Error('[CapabilityManager] Path traversal detected. Write rejected.');
        }
        const dir = path.dirname(sanitizedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(sanitizedPath, content);
        console.log(`[CapabilityManager] Wrote file: ${sanitizedPath}`);
    }
    async readFile(filePath, authToken) {
        const hasAccess = await this.gateway.checkAccess(authToken, AuthLevel.BASIC);
        if (!hasAccess) {
            throw new Error('[CapabilityManager] Authentication required');
        }
        let sanitizedPath;
        try {
            sanitizedPath = this.sanitizePath(filePath);
        }
        catch (e) {
            throw new Error('[CapabilityManager] Path traversal detected. Read rejected.');
        }
        if (!fs.existsSync(sanitizedPath)) {
            throw new Error(`[CapabilityManager] File not found: ${filePath}`);
        }
        return fs.readFileSync(sanitizedPath, 'utf-8');
    }
    addToWhitelist(entry, authToken) {
        const hasAccess = this.gateway.checkAccess(authToken, AuthLevel.HIGH_SECURITY);
        if (!hasAccess) {
            throw new Error('[CapabilityManager] Admin privileges required to modify whitelist');
        }
        this.whitelist.set(entry.command, entry);
        console.log(`[CapabilityManager] Added to whitelist: ${entry.command}`);
    }
    removeFromWhitelist(command, authToken) {
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
    listWhitelistedCommands() {
        return Array.from(this.whitelist.keys());
    }
    getCommandInfo(command) {
        return this.whitelist.get(command);
    }
    setSandboxMode(mode) {
        this.sandbox.setMode(mode);
    }
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
}
//# sourceMappingURL=CapabilityManager.js.map