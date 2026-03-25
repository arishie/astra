import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Platform, BridgeConfig, BridgeMessage, BridgeStatus } from '../../src/bridge/BaseBridge.js';

class MockBridge {
    readonly platform: Platform;
    readonly userId: string;
    private connected: boolean = false;
    private messageHandler: ((msg: BridgeMessage) => Promise<void>) | null = null;
    private errorMessage?: string;
    private lastActivity?: Date;

    constructor(config: BridgeConfig) {
        this.platform = config.platform;
        this.userId = config.userId;
    }

    async start(): Promise<void> {
        this.connected = true;
        this.lastActivity = new Date();
    }

    async stop(): Promise<void> {
        this.connected = false;
    }

    async sendMessage(to: string, content: string): Promise<void> {
        if (!this.connected) {
            throw new Error('Bridge not connected');
        }
        this.lastActivity = new Date();
    }

    setMessageHandler(handler: (msg: BridgeMessage) => Promise<void>): void {
        this.messageHandler = handler;
    }

    async simulateIncomingMessage(message: Omit<BridgeMessage, 'platform' | 'userId'>): Promise<void> {
        if (this.messageHandler) {
            await this.messageHandler({
                ...message,
                platform: this.platform,
                userId: this.userId,
            });
        }
    }

    getStatus(): BridgeStatus {
        return {
            connected: this.connected,
            platform: this.platform,
            userId: this.userId,
            lastActivity: this.lastActivity,
            error: this.errorMessage,
        };
    }

    isConnected(): boolean {
        return this.connected;
    }

    setError(error: string): void {
        this.errorMessage = error;
        this.connected = false;
    }
}

describe('Bridge Base Functionality', () => {
    let bridge: MockBridge;

    beforeEach(() => {
        bridge = new MockBridge({
            userId: 'user123',
            platform: 'whatsapp',
            credentials: {},
        });
    });

    describe('Connection Management', () => {
        it('should start disconnected', () => {
            expect(bridge.isConnected()).toBe(false);
        });

        it('should connect successfully', async () => {
            await bridge.start();
            expect(bridge.isConnected()).toBe(true);
        });

        it('should disconnect successfully', async () => {
            await bridge.start();
            await bridge.stop();
            expect(bridge.isConnected()).toBe(false);
        });

        it('should update last activity on start', async () => {
            await bridge.start();
            const status = bridge.getStatus();
            expect(status.lastActivity).toBeDefined();
        });
    });

    describe('Message Handling', () => {
        it('should set message handler', async () => {
            const handler = vi.fn();
            bridge.setMessageHandler(handler);
            await bridge.start();
            await bridge.simulateIncomingMessage({
                sender: 'sender123',
                content: 'Hello',
            });
            expect(handler).toHaveBeenCalledOnce();
        });

        it('should include platform and userId in messages', async () => {
            const handler = vi.fn();
            bridge.setMessageHandler(handler);
            await bridge.start();
            await bridge.simulateIncomingMessage({
                sender: 'sender123',
                content: 'Test message',
            });
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    platform: 'whatsapp',
                    userId: 'user123',
                    sender: 'sender123',
                    content: 'Test message',
                })
            );
        });

        it('should throw when sending without connection', async () => {
            await expect(bridge.sendMessage('recipient', 'message')).rejects.toThrow(
                'Bridge not connected'
            );
        });

        it('should send message when connected', async () => {
            await bridge.start();
            await expect(bridge.sendMessage('recipient', 'message')).resolves.not.toThrow();
        });
    });

    describe('Status Reporting', () => {
        it('should report disconnected status', () => {
            const status = bridge.getStatus();
            expect(status.connected).toBe(false);
            expect(status.platform).toBe('whatsapp');
            expect(status.userId).toBe('user123');
        });

        it('should report connected status', async () => {
            await bridge.start();
            const status = bridge.getStatus();
            expect(status.connected).toBe(true);
        });

        it('should report error status', () => {
            bridge.setError('Connection failed');
            const status = bridge.getStatus();
            expect(status.connected).toBe(false);
            expect(status.error).toBe('Connection failed');
        });
    });
});

describe('BridgeManager', () => {
    class MockBridgeManager {
        private bridges: Map<string, Map<Platform, MockBridge>> = new Map();
        private factories: Map<Platform, (config: BridgeConfig) => Promise<MockBridge>> = new Map();

        registerFactory(platform: Platform, factory: (config: BridgeConfig) => Promise<MockBridge>): void {
            this.factories.set(platform, factory);
        }

        async connectUser(userId: string, platform: Platform, credentials: any): Promise<BridgeStatus> {
            const factory = this.factories.get(platform);
            if (!factory) {
                throw new Error(`No factory for platform: ${platform}`);
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
            }

            const bridge = await factory({
                userId,
                platform,
                credentials,
            });

            await bridge.start();
            userBridges.set(platform, bridge);

            return bridge.getStatus();
        }

        async disconnectUser(userId: string, platform: Platform): Promise<boolean> {
            const userBridges = this.bridges.get(userId);
            if (!userBridges) return false;

            const bridge = userBridges.get(platform);
            if (!bridge) return false;

            await bridge.stop();
            userBridges.delete(platform);

            return true;
        }

        getBridge(userId: string, platform: Platform): MockBridge | null {
            return this.bridges.get(userId)?.get(platform) || null;
        }

        getStats(): { totalUsers: number; totalBridges: number } {
            let totalBridges = 0;
            for (const userBridges of this.bridges.values()) {
                totalBridges += userBridges.size;
            }
            return {
                totalUsers: this.bridges.size,
                totalBridges,
            };
        }
    }

    let manager: MockBridgeManager;

    beforeEach(() => {
        manager = new MockBridgeManager();
        manager.registerFactory('whatsapp', async (config) => new MockBridge(config));
        manager.registerFactory('telegram', async (config) => new MockBridge(config));
    });

    describe('User Connection', () => {
        it('should connect user to platform', async () => {
            const status = await manager.connectUser('user1', 'whatsapp', {});
            expect(status.connected).toBe(true);
            expect(status.platform).toBe('whatsapp');
        });

        it('should connect user to multiple platforms', async () => {
            await manager.connectUser('user1', 'whatsapp', {});
            await manager.connectUser('user1', 'telegram', {});

            expect(manager.getBridge('user1', 'whatsapp')).toBeTruthy();
            expect(manager.getBridge('user1', 'telegram')).toBeTruthy();
        });

        it('should return existing connection if already connected', async () => {
            await manager.connectUser('user1', 'whatsapp', {});
            const status2 = await manager.connectUser('user1', 'whatsapp', {});
            expect(status2.connected).toBe(true);
        });

        it('should throw for unregistered platform', async () => {
            await expect(
                manager.connectUser('user1', 'signal' as Platform, {})
            ).rejects.toThrow('No factory');
        });
    });

    describe('User Disconnection', () => {
        it('should disconnect user from platform', async () => {
            await manager.connectUser('user1', 'whatsapp', {});
            const result = await manager.disconnectUser('user1', 'whatsapp');
            expect(result).toBe(true);
            expect(manager.getBridge('user1', 'whatsapp')).toBeNull();
        });

        it('should return false for non-existent connection', async () => {
            const result = await manager.disconnectUser('user1', 'whatsapp');
            expect(result).toBe(false);
        });
    });

    describe('Statistics', () => {
        it('should track user and bridge counts', async () => {
            await manager.connectUser('user1', 'whatsapp', {});
            await manager.connectUser('user1', 'telegram', {});
            await manager.connectUser('user2', 'whatsapp', {});

            const stats = manager.getStats();
            expect(stats.totalUsers).toBe(2);
            expect(stats.totalBridges).toBe(3);
        });
    });
});

describe('WhatsApp Mode Selection', () => {
    enum WhatsAppMode {
        BAILEYS = 'baileys',
        BUSINESS_API = 'business',
    }

    function validateWhatsAppConfig(mode: WhatsAppMode, credentials: any): { valid: boolean; error?: string } {
        if (mode === WhatsAppMode.BUSINESS_API) {
            if (!credentials.businessToken) {
                return { valid: false, error: 'Business token required for Business API mode' };
            }
            if (!credentials.phoneNumberId) {
                return { valid: false, error: 'Phone number ID required for Business API mode' };
            }
        }
        return { valid: true };
    }

    it('should validate Business API credentials', () => {
        const result = validateWhatsAppConfig(WhatsAppMode.BUSINESS_API, {
            businessToken: 'token123',
            phoneNumberId: '123456789',
        });
        expect(result.valid).toBe(true);
    });

    it('should reject Business API without token', () => {
        const result = validateWhatsAppConfig(WhatsAppMode.BUSINESS_API, {
            phoneNumberId: '123456789',
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Business token');
    });

    it('should reject Business API without phone number ID', () => {
        const result = validateWhatsAppConfig(WhatsAppMode.BUSINESS_API, {
            businessToken: 'token123',
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Phone number ID');
    });

    it('should accept Baileys mode without credentials', () => {
        const result = validateWhatsAppConfig(WhatsAppMode.BAILEYS, {});
        expect(result.valid).toBe(true);
    });
});
