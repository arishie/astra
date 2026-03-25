import express from 'express';
import { BridgeManager } from '../bridge/BridgeManager.js';
import { MultiTenantOrchestrator } from '../core/MultiTenantOrchestrator.js';
import { LanceManager } from '../memory/LanceManager.js';
export interface ServerConfig {
    port?: number;
    corsOrigins?: string[];
    enableHelmet?: boolean;
    enableCompression?: boolean;
}
export declare class AstraServer {
    private app;
    private config;
    private db;
    private rateLimiter;
    private bridgeManager;
    private userService;
    private orchestrator;
    private memoryManager;
    constructor(config?: ServerConfig);
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    start(): Promise<void>;
    stop(): Promise<void>;
    getExpressApp(): express.Application;
    getBridgeManager(): BridgeManager;
    getOrchestrator(): MultiTenantOrchestrator;
    getMemoryManager(): LanceManager;
    setOrchestratorHandler(handler: (userId: string, message: string, context: any) => Promise<string>): void;
    setMemoryManager(manager: any): void;
}
export default AstraServer;
//# sourceMappingURL=server.d.ts.map