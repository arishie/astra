import { Gateway } from '../gateway/Gateway.js';
import { SandboxMode } from '../security/SandboxManager.js';
interface CommandWhitelistEntry {
    command: string;
    allowedArgs?: RegExp[];
    blockedArgs?: RegExp[];
    requiresElevation: boolean;
    maxArgs?: number;
}
export declare class CapabilityManager {
    private gateway;
    private sandbox;
    private whitelist;
    private workspaceRoot;
    constructor(gateway: Gateway, workspaceRoot?: string);
    private initializeWhitelist;
    private ensureWorkspaceExists;
    private parseCommand;
    private containsDangerousPatterns;
    private validateCommand;
    private sanitizePath;
    executeCommand(command: string, authToken: string, userId?: string): Promise<string>;
    writeToFile(filePath: string, content: string, authToken: string): Promise<void>;
    readFile(filePath: string, authToken: string): Promise<string>;
    addToWhitelist(entry: CommandWhitelistEntry, authToken: string): void;
    removeFromWhitelist(command: string, authToken: string): boolean;
    listWhitelistedCommands(): string[];
    getCommandInfo(command: string): CommandWhitelistEntry | undefined;
    setSandboxMode(mode: SandboxMode): void;
    getWorkspaceRoot(): string;
}
export {};
//# sourceMappingURL=CapabilityManager.d.ts.map