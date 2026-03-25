import { EventEmitter } from 'events';
import { UserService } from '../services/UserService.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { type BaseBridge, type BridgeMessage, type BridgeConfig, type BridgeStatus, type Platform } from './BaseBridge.js';
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
export declare class BridgeManager extends EventEmitter {
    private bridges;
    private bridgeFactories;
    private userService;
    private rateLimiter;
    private config;
    private healthCheckTimer?;
    private globalMessageHandler?;
    constructor(userService: UserService, rateLimiter: RateLimiter, config?: BridgeManagerConfig);
    registerBridgeFactory(platform: Platform, factory: BridgeFactory): void;
    setGlobalMessageHandler(handler: (userId: string, message: BridgeMessage) => Promise<void>): void;
    connectUser(userId: string, platform: Platform, credentials: Record<string, any>, options?: {
        mode?: string;
    }): Promise<BridgeStatus>;
    disconnectUser(userId: string, platform: Platform): Promise<boolean>;
    disconnectAllUserBridges(userId: string): Promise<void>;
    sendMessage(userId: string, platform: Platform, to: string, content: string): Promise<boolean>;
    getBridge(userId: string, platform: Platform): BaseBridge | null;
    getUserBridges(userId: string): UserBridgeInfo[];
    getBridgeStatus(userId: string, platform: Platform): BridgeStatus | null;
    getAllConnectedUsers(): Map<string, Platform[]>;
    getStats(): {
        totalUsers: number;
        totalBridges: number;
        byPlatform: Record<Platform, number>;
    };
    startHealthCheck(): void;
    stopHealthCheck(): void;
    private performHealthCheck;
    private handleIncomingMessage;
    private sanitizeCredentials;
    shutdown(): Promise<void>;
}
export {};
//# sourceMappingURL=BridgeManager.d.ts.map