import type { OAuthUserData } from '../auth/OAuthProvider.js';
export interface User {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    oauthProvider: string;
    oauthId: string;
    isActive: boolean;
    isAdmin: boolean;
    settings: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}
export interface UserApiKey {
    id: string;
    userId: string;
    provider: string;
    name: string;
    modelId?: string;
    baseUrl?: string;
    tier: number;
    isActive: boolean;
    isValidated: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
}
export interface UserPlatform {
    id: string;
    userId: string;
    platform: string;
    platformUserId: string;
    platformUsername?: string;
    mode: string;
    isActive: boolean;
    connectedAt: Date;
    lastMessageAt?: Date;
}
export declare class UserService {
    private db;
    private encryptionKey;
    constructor();
    private getEncryptionKey;
    private encrypt;
    private decrypt;
    createOrUpdateUser(oauthData: OAuthUserData): Promise<User>;
    getUserById(userId: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByPlatformId(platform: string, platformUserId: string): Promise<User | null>;
    updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'settings'>>): Promise<User | null>;
    deleteUser(userId: string): Promise<boolean>;
    storeApiKey(userId: string, provider: string, name: string, apiKey: string, options?: {
        modelId?: string;
        baseUrl?: string;
        tier?: number;
    }): Promise<UserApiKey>;
    getApiKey(userId: string, provider: string, name?: string): Promise<string | null>;
    listApiKeys(userId: string): Promise<UserApiKey[]>;
    deleteApiKey(userId: string, keyId: string): Promise<boolean>;
    updateApiKeyValidation(keyId: string, isValid: boolean, userId?: string): Promise<boolean>;
    markApiKeyUsed(keyId: string): Promise<void>;
    connectPlatform(userId: string, platform: string, platformUserId: string, options?: {
        username?: string;
        mode?: string;
        sessionData?: any;
    }): Promise<UserPlatform>;
    getPlatformSession(userId: string, platform: string): Promise<any | null>;
    updatePlatformSession(userId: string, platform: string, sessionData: any): Promise<void>;
    listUserPlatforms(userId: string): Promise<UserPlatform[]>;
    disconnectPlatform(userId: string, platform: string): Promise<boolean>;
    updateLastMessage(platform: string, platformUserId: string): Promise<void>;
    private mapRowToUser;
    private mapRowToApiKey;
    private mapRowToPlatform;
}
//# sourceMappingURL=UserService.d.ts.map