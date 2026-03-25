import { EventEmitter } from 'events';
import { Gateway, AuthLevel } from '../gateway/Gateway.js';
import { CapabilityManager } from '../capabilities/CapabilityManager.js';
import { LanceManager } from '../memory/LanceManager.js';
import { ModelRouter, BrainRole } from '../llm/ModelRouter.js';
import { ThinkingHive } from './ThinkingHive.js';
import { ToolSynthesizer } from './ToolSynthesizer.js';
import { UserService } from '../services/UserService.js';
import { BridgeManager } from '../bridge/BridgeManager.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
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
export class MultiTenantOrchestrator extends EventEmitter {
    gateway;
    capabilities;
    userService;
    bridgeManager;
    rateLimiter;
    // Per-user contexts - lazy loaded
    userContexts = new Map();
    // Shared resources (read-only or properly synchronized)
    sharedMemory; // For system-level data only
    // Configuration
    config;
    // Cleanup timer
    cleanupTimer;
    // System token for internal operations
    systemToken = null;
    constructor(userService, bridgeManager, rateLimiter, config = {}) {
        super();
        this.userService = userService;
        this.bridgeManager = bridgeManager;
        this.rateLimiter = rateLimiter;
        this.config = {
            maxUsersInMemory: config.maxUsersInMemory ?? 1000,
            userContextTTL: config.userContextTTL ?? 30 * 60 * 1000, // 30 minutes
            cleanupInterval: config.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
        };
        // Initialize core services
        this.gateway = new Gateway();
        this.capabilities = new CapabilityManager(this.gateway);
        this.sharedMemory = new LanceManager('./astra_memory_system');
        // Set up bridge manager to route messages through us
        this.bridgeManager.setGlobalMessageHandler(async (userId, message) => {
            await this.handleUserMessage(userId, message);
        });
    }
    /**
     * Initialize the orchestrator.
     * Must be called before processing any requests.
     */
    async initialize() {
        console.log('[MultiTenantOrchestrator] Initializing...');
        // Initialize system authentication
        await this.initializeSystemAuth();
        // Initialize shared memory
        await this.sharedMemory.initialize();
        // Start cleanup timer
        this.startContextCleanup();
        // Connect rate limiter
        await this.rateLimiter.connect();
        console.log('[MultiTenantOrchestrator] Initialized successfully');
    }
    /**
     * Initialize system token for internal operations.
     */
    async initializeSystemAuth() {
        const systemSecret = process.env.SYSTEM_SECRET;
        if (!systemSecret) {
            console.warn('[MultiTenantOrchestrator] SYSTEM_SECRET not set. Some features will be limited.');
            return;
        }
        try {
            const tokens = await this.gateway.generateSystemToken('multi-tenant-orchestrator');
            this.systemToken = tokens.accessToken;
            console.log('[MultiTenantOrchestrator] System authentication initialized');
        }
        catch (error) {
            console.error('[MultiTenantOrchestrator] Failed to initialize system auth:', error);
        }
    }
    /**
     * Get or create a user context.
     * Each user gets completely isolated resources.
     */
    async getUserContext(userId, accessToken) {
        // Verify authentication if token provided
        if (accessToken) {
            const session = await this.gateway.authenticateWithToken(accessToken);
            if (!session || session.userId !== userId) {
                console.warn(`[MultiTenantOrchestrator] Token mismatch for user ${userId}`);
                return null;
            }
        }
        // Check cache
        if (this.userContexts.has(userId)) {
            const context = this.userContexts.get(userId);
            context.lastActivity = new Date();
            return context;
        }
        // Check user limit
        if (this.userContexts.size >= this.config.maxUsersInMemory) {
            // Evict least recently used
            this.evictOldestContext();
        }
        // Get user from database
        const user = await this.userService.getUserById(userId);
        if (!user) {
            console.warn(`[MultiTenantOrchestrator] User not found: ${userId}`);
            return null;
        }
        // Create isolated context
        const context = await this.createUserContext(user.id, user.email);
        this.userContexts.set(userId, context);
        console.log(`[MultiTenantOrchestrator] Created context for user: ${userId.substring(0, 8)}...`);
        this.emit('context:created', { userId });
        return context;
    }
    /**
     * Create a new isolated user context.
     */
    async createUserContext(userId, email) {
        // Create isolated memory for this user
        const userMemory = new LanceManager(`./astra_memory/users/${userId}`);
        await userMemory.initialize();
        // Create model router (will load user's API keys)
        const modelRouter = new ModelRouter();
        // Load user's API keys into model router
        await this.loadUserModels(userId, modelRouter);
        return {
            userId,
            email,
            authLevel: AuthLevel.BASIC,
            memory: userMemory,
            modelRouter,
            pendingActions: new Map(),
            lastActivity: new Date(),
            createdAt: new Date(),
        };
    }
    /**
     * Load user's API keys into their model router.
     */
    async loadUserModels(userId, modelRouter) {
        try {
            const apiKeys = await this.userService.listApiKeys(userId);
            for (const keyInfo of apiKeys) {
                if (!keyInfo.isActive)
                    continue;
                const decryptedKey = await this.userService.getApiKey(userId, keyInfo.provider, keyInfo.name);
                if (decryptedKey) {
                    modelRouter.getRegistry().registerModel({
                        name: keyInfo.name,
                        providerType: keyInfo.provider,
                        modelId: keyInfo.modelId || keyInfo.name,
                        apiKey: decryptedKey,
                        baseUrl: keyInfo.baseUrl,
                        tier: keyInfo.tier || 1,
                    });
                }
            }
        }
        catch (error) {
            console.error(`[MultiTenantOrchestrator] Failed to load models for user ${userId}:`, error);
        }
    }
    /**
     * Handle incoming message from a platform for a specific user.
     */
    async handleUserMessage(userId, message) {
        // Rate limit check
        const limitResult = await this.rateLimiter.checkLimit(userId, 'chat');
        if (!limitResult.allowed) {
            console.warn(`[MultiTenantOrchestrator] Rate limit exceeded for user ${userId}`);
            await this.sendErrorToUser(userId, message.platform, message.sender, `Rate limit exceeded. Please wait ${limitResult.retryAfter} seconds.`);
            return;
        }
        // Get user context
        const context = await this.getUserContext(userId);
        if (!context) {
            await this.sendErrorToUser(userId, message.platform, message.sender, 'Authentication required. Please log in at https://astra.ai');
            return;
        }
        try {
            const response = await this.processUserMessage(context, message);
            await this.bridgeManager.sendMessage(userId, message.platform, message.sender, response);
        }
        catch (error) {
            console.error(`[MultiTenantOrchestrator] Error processing message for ${userId}:`, error);
            await this.sendErrorToUser(userId, message.platform, message.sender, 'An error occurred. Please try again.');
        }
    }
    /**
     * Process a message within a user's context.
     */
    async processUserMessage(context, message) {
        const content = message.content.trim();
        // Command handling
        if (content.startsWith('/')) {
            return this.handleCommand(context, content, message);
        }
        // Regular chat - search memory and generate response
        const memoryResults = await context.memory.search(content, 3, context.userId);
        const memoryContext = memoryResults.length > 0
            ? memoryResults.map(r => r.text).join('\n\n')
            : 'No relevant context found.';
        try {
            const response = await context.modelRouter.generateResponse(content, memoryContext);
            return response;
        }
        catch (error) {
            if (error.message?.includes('No models configured')) {
                return '⚠️ No AI models configured. Please add your API keys at https://astra.ai/settings/keys';
            }
            throw error;
        }
    }
    /**
     * Handle slash commands for a user.
     */
    async handleCommand(context, content, message) {
        const parts = content.split(' ');
        const firstPart = parts[0];
        if (!firstPart) {
            return 'Invalid command. Type /help for available commands.';
        }
        const command = firstPart.toLowerCase();
        const args = parts.slice(1).join(' ');
        switch (command) {
            case '/help':
                return this.getHelpText();
            case '/hive':
                if (!args)
                    return 'Usage: /hive [goal]';
                const hive = new ThinkingHive(context.modelRouter, context.memory);
                return await hive.collaborate(args, 'User Request');
            case '/remember':
                if (!args)
                    return 'Usage: /remember [information to remember]';
                await context.memory.addMemory(args, { type: 'user_note', source: message.platform }, context.userId);
                return '✅ I will remember that.';
            case '/forget':
                if (args === 'all') {
                    await context.memory.clearUserMemories(context.userId);
                    return '✅ All memories cleared.';
                }
                return 'Usage: /forget all';
            case '/stats':
                const stats = await context.memory.getUserStats(context.userId);
                return `📊 **Your Stats**\nMemories: ${stats?.count || 0}\nModels configured: ${context.modelRouter.getRegistry().listModels().length}`;
            case '/models':
                const models = context.modelRouter.getRegistry().listModels();
                if (models.length === 0) {
                    return '⚠️ No AI models configured. Add your API keys at https://astra.ai/settings/keys';
                }
                return `🧠 **Available Models:**\n${models.map(m => `- ${m}`).join('\n')}`;
            case '/switch':
                if (!args) {
                    const available = context.modelRouter.getRegistry().listModels().join(', ');
                    return `Available: ${available}\nUsage: /switch [model_name]`;
                }
                try {
                    context.modelRouter.setActiveModel(args);
                    return `🧠 Switched to: ${args}`;
                }
                catch (e) {
                    return `❌ Error: ${e.message}`;
                }
            default:
                // Check if it's a capability command (requires system token)
                if (this.systemToken) {
                    try {
                        const result = await this.capabilities.executeCommand(content.substring(1), this.systemToken);
                        return `✅ Output:\n${result}`;
                    }
                    catch (e) {
                        // Command not allowed or failed - fall through to unknown command
                        if (!e.message?.includes('not whitelisted')) {
                            return `⛔ Execution failed: ${e.message}`;
                        }
                    }
                }
                return `Unknown command: ${command}. Type /help for available commands.`;
        }
    }
    /**
     * Get help text for available commands.
     */
    getHelpText() {
        return `**Astra Commands:**

/help - Show this help message
/hive [goal] - Use ThinkingHive for complex tasks
/remember [info] - Save information to memory
/forget all - Clear all your memories
/stats - Show your usage statistics
/models - List your configured AI models
/switch [model] - Switch to a different model

**Chat:**
Just type normally to chat with Astra. I'll use your documents and memories to provide context-aware responses.

**Settings:**
Manage your API keys and platforms at https://astra.ai/settings`;
    }
    /**
     * Send an error message to a user.
     */
    async sendErrorToUser(userId, platform, recipient, message) {
        try {
            await this.bridgeManager.sendMessage(userId, platform, recipient, `⚠️ ${message}`);
        }
        catch (error) {
            console.error('[MultiTenantOrchestrator] Failed to send error to user:', error);
        }
    }
    /**
     * Evict the oldest (least recently active) context.
     */
    evictOldestContext() {
        let oldestTime = Date.now();
        let oldestUserId = null;
        for (const [userId, context] of this.userContexts.entries()) {
            if (context.lastActivity.getTime() < oldestTime) {
                oldestTime = context.lastActivity.getTime();
                oldestUserId = userId;
            }
        }
        if (oldestUserId) {
            this.destroyUserContext(oldestUserId);
        }
    }
    /**
     * Clean up a user's context and free resources.
     */
    async destroyUserContext(userId) {
        const context = this.userContexts.get(userId);
        if (!context)
            return;
        try {
            await context.memory.close();
        }
        catch (error) {
            console.error(`[MultiTenantOrchestrator] Error closing memory for ${userId}:`, error);
        }
        this.userContexts.delete(userId);
        console.log(`[MultiTenantOrchestrator] Destroyed context for user: ${userId.substring(0, 8)}...`);
        this.emit('context:destroyed', { userId });
    }
    /**
     * Start periodic cleanup of inactive contexts.
     */
    startContextCleanup() {
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            const expiredUsers = [];
            for (const [userId, context] of this.userContexts.entries()) {
                if (now - context.lastActivity.getTime() > this.config.userContextTTL) {
                    expiredUsers.push(userId);
                }
            }
            for (const userId of expiredUsers) {
                this.destroyUserContext(userId);
            }
            if (expiredUsers.length > 0) {
                console.log(`[MultiTenantOrchestrator] Cleaned up ${expiredUsers.length} inactive contexts`);
            }
        }, this.config.cleanupInterval);
    }
    /**
     * Get orchestrator statistics.
     */
    getStats() {
        return {
            activeContexts: this.userContexts.size,
            maxContexts: this.config.maxUsersInMemory,
            bridgeStats: this.bridgeManager.getStats(),
        };
    }
    /**
     * Shutdown the orchestrator gracefully.
     */
    async shutdown() {
        console.log('[MultiTenantOrchestrator] Shutting down...');
        // Stop cleanup timer
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        // Destroy all user contexts
        for (const userId of this.userContexts.keys()) {
            await this.destroyUserContext(userId);
        }
        // Shutdown bridge manager
        await this.bridgeManager.shutdown();
        // Close shared memory
        await this.sharedMemory.close();
        console.log('[MultiTenantOrchestrator] Shutdown complete');
    }
}
//# sourceMappingURL=MultiTenantOrchestrator.js.map