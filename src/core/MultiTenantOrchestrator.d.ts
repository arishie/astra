import { EventEmitter } from 'events';
import { AuthLevel } from '../gateway/Gateway.js';
import { LanceManager } from '../memory/LanceManager.js';
import { ModelRouter } from '../llm/ModelRouter.js';
import { UserService } from '../services/UserService.js';
import { BridgeManager } from '../bridge/BridgeManager.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import type { BridgeMessage } from '../bridge/BaseBridge.js';
/**
 * Per-user context containing isolated resources.
 * Each user gets their own memory, model config, and state.
 */
export interface UserContext {
    userId: string;
    email: string;
    authLevel: AuthLevel;
    memory: LanceManager;
    modelRouter: ModelRouter;
    pendingActions: Map<string, any>;
    lastActivity: Date;
    createdAt: Date;
}
/**
 * Configuration for the multi-tenant orchestrator.
 */
export interface MultiTenantConfig {
    maxUsersInMemory?: number;
    userContextTTL?: number;
    cleanupInterval?: number;
}
/**
 * Multi-tenant orchestrator that manages per-user instances.
 *
 * Key security features:
 * - Complete isolation between users (memory, models, state)
 * - JWT-based authentication required for all operations
 * - No hardcoded credentials
 * - Rate limiting per user
 * - Audit logging
 */
export declare class MultiTenantOrchestrator extends EventEmitter {
    private gateway;
    private capabilities;
    private userService;
    private bridgeManager;
    private rateLimiter;
    private userContexts;
    private sharedMemory;
    private config;
    private cleanupTimer?;
    private systemToken;
    constructor(userService: UserService, bridgeManager: BridgeManager, rateLimiter: RateLimiter, config?: MultiTenantConfig);
    /**
     * Initialize the orchestrator.
     * Must be called before processing any requests.
     */
    initialize(): Promise<void>;
    /**
     * Initialize system token for internal operations.
     */
    private initializeSystemAuth;
    /**
     * Get or create a user context.
     * Each user gets completely isolated resources.
     */
    getUserContext(userId: string, accessToken?: string): Promise<UserContext | null>;
    /**
     * Create a new isolated user context.
     */
    private createUserContext;
    /**
     * Load user's API keys into their model router.
     */
    private loadUserModels;
    /**
     * Handle incoming message from a platform for a specific user.
     */
    handleUserMessage(userId: string, message: BridgeMessage): Promise<void>;
    /**
     * Process a message within a user's context.
     */
    private processUserMessage;
    /**
     * Handle slash commands for a user.
     */
    private handleCommand;
    /**
     * Get help text for available commands.
     */
    private getHelpText;
    /**
     * Send an error message to a user.
     */
    private sendErrorToUser;
    /**
     * Evict the oldest (least recently active) context.
     */
    private evictOldestContext;
    /**
     * Clean up a user's context and free resources.
     */
    private destroyUserContext;
    /**
     * Start periodic cleanup of inactive contexts.
     */
    private startContextCleanup;
    /**
     * Get orchestrator statistics.
     */
    getStats(): {
        activeContexts: number;
        maxContexts: number;
        bridgeStats: any;
    };
    /**
     * Shutdown the orchestrator gracefully.
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=MultiTenantOrchestrator.d.ts.map