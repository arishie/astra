import { EventEmitter } from 'events';
import { UserService } from '../services/UserService.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import {
    type BaseBridge,
    type BridgeMessage,
    type BridgeConfig,
    type BridgeStatus,
    type Platform,
    type MessageHandler,
} from './BaseBridge.js';

export interface BridgeManagerConfig {
    maxBridgesPerUser?: number;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    healthCheckInterval?: number;
}

export interface UserBridgeInfo {
    platform: Platform;
    userId: string;
    status: BridgeStatus;
    connectedAt: Date;
}

type BridgeFactory = (config: BridgeConfig) => Promise<BaseBridge>;

export class BridgeManager extends EventEmitter {
    private bridges: Map<string, Map<Platform, BaseBridge>> = new Map();
    private bridgeFactories: Map<Platform, BridgeFactory> = new Map();
    private userService: UserService;
    private rateLimiter: RateLimiter;
    private config: Required<BridgeManagerConfig>;
    private healthCheckTimer?: NodeJS.Timeout;
    private globalMessageHandler?: (userId: string, message: BridgeMessage) => Promise<void>;

    constructor(
        userService: UserService,
        rateLimiter: RateLimiter,
        config: BridgeManagerConfig = {}
    ) {
        super();
        this.userService = userService;
        this.rateLimiter = rateLimiter;
        this.config = {
            maxBridgesPerUser: config.maxBridgesPerUser ?? 10,
            reconnectAttempts: config.reconnectAttempts ?? 3,
            reconnectDelay: config.reconnectDelay ?? 5000,
            healthCheckInterval: config.healthCheckInterval ?? 30000,
        };
    }

    registerBridgeFactory(platform: Platform, factory: BridgeFactory): void {
        this.bridgeFactories.set(platform, factory);
        console.log(`[BridgeManager] Registered factory for platform: ${platform}`);
    }

    setGlobalMessageHandler(handler: (userId: string, message: BridgeMessage) => Promise<void>): void {
        this.globalMessageHandler = handler;
    }

    async connectUser(
        userId: string,
        platform: Platform,
        credentials: Record<string, any>,
        options: { mode?: string } = {}
    ): Promise<BridgeStatus> {
        const limitResult = await this.rateLimiter.checkLimit(userId, 'browse');
        if (!limitResult.allowed) {
            throw new Error(`Rate limit exceeded. Retry after ${limitResult.retryAfter} seconds.`);
        }

        const factory = this.bridgeFactories.get(platform);
        if (!factory) {
            throw new Error(`No bridge factory registered for platform: ${platform}`);
        }

        if (!this.bridges.has(userId)) {
            this.bridges.set(userId, new Map());
        }

        const userBridges = this.bridges.get(userId)!;

        if (userBridges.has(platform)) {
            const existing = userBridges.get(platform)!;
            if (existing.isConnected()) {
                return existing.getStatus();
            }
            await this.disconnectUser(userId, platform);
        }

        if (userBridges.size >= this.config.maxBridgesPerUser) {
            throw new Error(`Maximum bridges per user (${this.config.maxBridgesPerUser}) reached.`);
        }

        const bridgeConfig: BridgeConfig = {
            userId,
            platform,
            credentials,
            mode: options.mode,
        };

        try {
            const bridge = await factory(bridgeConfig);

            bridge.setMessageHandler(async (message: BridgeMessage) => {
                await this.handleIncomingMessage(userId, message);
            });

            await bridge.start();

            userBridges.set(platform, bridge);

            await this.userService.connectPlatform(
                userId,
                platform,
                credentials.platformUserId || userId,
                {
                    mode: options.mode,
                    sessionData: this.sanitizeCredentials(credentials),
                }
            );

            this.emit('bridge:connected', { userId, platform, status: bridge.getStatus() });

            console.log(`[BridgeManager] User ${userId} connected to ${platform}`);
            return bridge.getStatus();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[BridgeManager] Failed to connect ${userId} to ${platform}:`, errorMessage);

            this.emit('bridge:error', { userId, platform, error: errorMessage });

            return {
                connected: false,
                platform,
                userId,
                error: errorMessage,
            };
        }
    }

    async disconnectUser(userId: string, platform: Platform): Promise<boolean> {
        const userBridges = this.bridges.get(userId);
        if (!userBridges) return false;

        const bridge = userBridges.get(platform);
        if (!bridge) return false;

        try {
            await bridge.stop();
            userBridges.delete(platform);

            if (userBridges.size === 0) {
                this.bridges.delete(userId);
            }

            await this.userService.disconnectPlatform(userId, platform);

            this.emit('bridge:disconnected', { userId, platform });

            console.log(`[BridgeManager] User ${userId} disconnected from ${platform}`);
            return true;
        } catch (error) {
            console.error(`[BridgeManager] Error disconnecting ${userId} from ${platform}:`, error);
            return false;
        }
    }

    async disconnectAllUserBridges(userId: string): Promise<void> {
        const userBridges = this.bridges.get(userId);
        if (!userBridges) return;

        const platforms = Array.from(userBridges.keys());
        await Promise.all(platforms.map((platform) => this.disconnectUser(userId, platform)));
    }

    async sendMessage(
        userId: string,
        platform: Platform,
        to: string,
        content: string
    ): Promise<boolean> {
        const bridge = this.getBridge(userId, platform);
        if (!bridge || !bridge.isConnected()) {
            console.warn(`[BridgeManager] No active bridge for ${userId} on ${platform}`);
            return false;
        }

        const limitResult = await this.rateLimiter.checkLimit(userId, 'chat');
        if (!limitResult.allowed) {
            console.warn(`[BridgeManager] Rate limit exceeded for ${userId}`);
            return false;
        }

        try {
            await bridge.sendMessage(to, content);
            await this.userService.updateLastMessage(platform, to);
            return true;
        } catch (error) {
            console.error(`[BridgeManager] Failed to send message:`, error);
            return false;
        }
    }

    getBridge(userId: string, platform: Platform): BaseBridge | null {
        return this.bridges.get(userId)?.get(platform) ?? null;
    }

    getUserBridges(userId: string): UserBridgeInfo[] {
        const userBridges = this.bridges.get(userId);
        if (!userBridges) return [];

        return Array.from(userBridges.entries()).map(([platform, bridge]) => ({
            platform,
            userId,
            status: bridge.getStatus(),
            connectedAt: bridge.getStatus().lastActivity || new Date(),
        }));
    }

    getBridgeStatus(userId: string, platform: Platform): BridgeStatus | null {
        return this.getBridge(userId, platform)?.getStatus() ?? null;
    }

    getAllConnectedUsers(): Map<string, Platform[]> {
        const result = new Map<string, Platform[]>();
        for (const [userId, bridges] of this.bridges.entries()) {
            const platforms = Array.from(bridges.keys()).filter(
                (platform) => bridges.get(platform)?.isConnected()
            );
            if (platforms.length > 0) {
                result.set(userId, platforms);
            }
        }
        return result;
    }

    getStats(): {
        totalUsers: number;
        totalBridges: number;
        byPlatform: Record<Platform, number>;
    } {
        let totalBridges = 0;
        const byPlatform: Partial<Record<Platform, number>> = {};

        for (const userBridges of this.bridges.values()) {
            totalBridges += userBridges.size;
            for (const platform of userBridges.keys()) {
                byPlatform[platform] = (byPlatform[platform] || 0) + 1;
            }
        }

        return {
            totalUsers: this.bridges.size,
            totalBridges,
            byPlatform: byPlatform as Record<Platform, number>,
        };
    }

    startHealthCheck(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);

        console.log(`[BridgeManager] Health check started (interval: ${this.config.healthCheckInterval}ms)`);
    }

    stopHealthCheck(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }
    }

    private async performHealthCheck(): Promise<void> {
        const disconnectedBridges: Array<{ userId: string; platform: Platform }> = [];

        for (const [userId, userBridges] of this.bridges.entries()) {
            for (const [platform, bridge] of userBridges.entries()) {
                if (!bridge.isConnected()) {
                    disconnectedBridges.push({ userId, platform });
                }
            }
        }

        for (const { userId, platform } of disconnectedBridges) {
            this.emit('bridge:unhealthy', { userId, platform });
        }
    }

    private async handleIncomingMessage(userId: string, message: BridgeMessage): Promise<void> {
        message.userId = userId;
        message.timestamp = message.timestamp || new Date();

        this.emit('message:received', { userId, message });

        if (this.globalMessageHandler) {
            try {
                await this.globalMessageHandler(userId, message);
            } catch (error) {
                console.error(`[BridgeManager] Error in global message handler:`, error);
                this.emit('message:error', { userId, message, error });
            }
        }
    }

    private sanitizeCredentials(credentials: Record<string, any>): Record<string, any> {
        const sanitized: Record<string, any> = {};
        const sensitiveKeys = ['password', 'apiKey', 'token', 'secret', 'key'];

        for (const [key, value] of Object.entries(credentials)) {
            const isSensitive = sensitiveKeys.some((sk) =>
                key.toLowerCase().includes(sk.toLowerCase())
            );

            if (isSensitive) {
                sanitized[key] = value ? '[REDACTED]' : null;
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    async shutdown(): Promise<void> {
        console.log('[BridgeManager] Shutting down all bridges...');
        this.stopHealthCheck();

        const shutdownPromises: Promise<void>[] = [];

        for (const userId of this.bridges.keys()) {
            shutdownPromises.push(this.disconnectAllUserBridges(userId));
        }

        await Promise.all(shutdownPromises);
        this.bridges.clear();
        console.log('[BridgeManager] All bridges shut down.');
    }
}
