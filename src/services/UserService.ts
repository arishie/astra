import * as crypto from 'crypto';
import { Database } from '../database/Database.js';
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

export class UserService {
    private db: Database;
    private encryptionKey: Buffer;

    constructor() {
        this.db = Database.getInstance();
        this.encryptionKey = this.getEncryptionKey();
    }

    private getEncryptionKey(): Buffer {
        const masterKey = process.env.MASTER_ENCRYPTION_KEY;
        if (!masterKey || masterKey.length < 32) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('CRITICAL: MASTER_ENCRYPTION_KEY must be set in production (minimum 32 characters)');
            }
            console.warn('[UserService] ⚠️ MASTER_ENCRYPTION_KEY not set. Using development key. DO NOT USE IN PRODUCTION.');
            return crypto.scryptSync('astra-dev-key', 'user-service-salt', 32);
        }
        return crypto.scryptSync(masterKey, 'user-service-salt', 32);
    }

    private encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return JSON.stringify({
            iv: iv.toString('hex'),
            data: encrypted,
            tag: authTag.toString('hex'),
        });
    }

    private decrypt(encrypted: string): string {
        const { iv, data, tag } = JSON.parse(encrypted);
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            this.encryptionKey,
            Buffer.from(iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    async createOrUpdateUser(oauthData: OAuthUserData): Promise<User> {
        const result = await this.db.query<any>(
            `INSERT INTO users (email, name, avatar_url, oauth_provider, oauth_id, last_login_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (oauth_provider, oauth_id)
             DO UPDATE SET
                 email = EXCLUDED.email,
                 name = COALESCE(EXCLUDED.name, users.name),
                 avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
                 last_login_at = NOW(),
                 updated_at = NOW()
             RETURNING *`,
            [
                oauthData.email,
                oauthData.name || null,
                oauthData.avatarUrl || null,
                oauthData.provider,
                oauthData.providerId,
            ]
        );

        return this.mapRowToUser(result.rows[0]);
    }

    async getUserById(userId: string): Promise<User | null> {
        const result = await this.db.query<any>(
            'SELECT * FROM users WHERE id = $1 AND is_active = true',
            [userId]
        );

        if (result.rows.length === 0) return null;
        return this.mapRowToUser(result.rows[0]);
    }

    async getUserByEmail(email: string): Promise<User | null> {
        const result = await this.db.query<any>(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (result.rows.length === 0) return null;
        return this.mapRowToUser(result.rows[0]);
    }

    async getUserByPlatformId(platform: string, platformUserId: string): Promise<User | null> {
        const result = await this.db.query<any>(
            `SELECT u.* FROM users u
             JOIN user_platforms up ON u.id = up.user_id
             WHERE up.platform = $1 AND up.platform_user_id = $2 AND u.is_active = true`,
            [platform, platformUserId]
        );

        if (result.rows.length === 0) return null;
        return this.mapRowToUser(result.rows[0]);
    }

    async updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'settings'>>): Promise<User | null> {
        const setClauses: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            setClauses.push(`name = $${paramIndex++}`);
            params.push(updates.name);
        }

        if (updates.settings !== undefined) {
            setClauses.push(`settings = $${paramIndex++}`);
            params.push(JSON.stringify(updates.settings));
        }

        if (setClauses.length === 0) return this.getUserById(userId);

        params.push(userId);

        const result = await this.db.query<any>(
            `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW()
             WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return null;
        return this.mapRowToUser(result.rows[0]);
    }

    async deleteUser(userId: string): Promise<boolean> {
        const result = await this.db.query(
            'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
            [userId]
        );
        return (result.rowCount || 0) > 0;
    }

    async storeApiKey(
        userId: string,
        provider: string,
        name: string,
        apiKey: string,
        options: { modelId?: string; baseUrl?: string; tier?: number } = {}
    ): Promise<UserApiKey> {
        const encryptedKey = this.encrypt(apiKey);

        const result = await this.db.query<any>(
            `INSERT INTO user_api_keys (user_id, provider, name, encrypted_key, model_id, base_url, tier)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, provider, name)
             DO UPDATE SET
                 encrypted_key = EXCLUDED.encrypted_key,
                 model_id = COALESCE(EXCLUDED.model_id, user_api_keys.model_id),
                 base_url = COALESCE(EXCLUDED.base_url, user_api_keys.base_url),
                 tier = COALESCE(EXCLUDED.tier, user_api_keys.tier),
                 updated_at = NOW()
             RETURNING *`,
            [
                userId,
                provider,
                name,
                encryptedKey,
                options.modelId || null,
                options.baseUrl || null,
                options.tier || 1,
            ]
        );

        return this.mapRowToApiKey(result.rows[0]);
    }

    async getApiKey(userId: string, provider: string, name?: string): Promise<string | null> {
        let query = 'SELECT encrypted_key FROM user_api_keys WHERE user_id = $1 AND provider = $2 AND is_active = true';
        const params: any[] = [userId, provider];

        if (name) {
            query += ' AND name = $3';
            params.push(name);
        } else {
            query += ' ORDER BY created_at DESC LIMIT 1';
        }

        const result = await this.db.query<any>(query, params);

        if (result.rows.length === 0) return null;

        try {
            return this.decrypt(result.rows[0].encrypted_key);
        } catch {
            console.error('[UserService] Failed to decrypt API key');
            return null;
        }
    }

    async listApiKeys(userId: string): Promise<UserApiKey[]> {
        const result = await this.db.query<any>(
            `SELECT id, user_id, provider, name, model_id, base_url, tier, is_active, is_validated, last_used_at, created_at
             FROM user_api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );

        return result.rows.map(this.mapRowToApiKey);
    }

    async deleteApiKey(userId: string, keyId: string): Promise<boolean> {
        const result = await this.db.query(
            'DELETE FROM user_api_keys WHERE id = $1 AND user_id = $2',
            [keyId, userId]
        );
        return (result.rowCount || 0) > 0;
    }

    async updateApiKeyValidation(keyId: string, isValid: boolean, userId?: string): Promise<boolean> {
        // If userId provided, enforce ownership check for security
        if (userId) {
            const result = await this.db.query(
                'UPDATE user_api_keys SET is_validated = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
                [isValid, keyId, userId]
            );
            return (result.rowCount || 0) > 0;
        }
        // System-level update (internal use only)
        await this.db.query(
            'UPDATE user_api_keys SET is_validated = $1, updated_at = NOW() WHERE id = $2',
            [isValid, keyId]
        );
        return true;
    }

    async markApiKeyUsed(keyId: string): Promise<void> {
        await this.db.query(
            'UPDATE user_api_keys SET last_used_at = NOW() WHERE id = $1',
            [keyId]
        );
    }

    async connectPlatform(
        userId: string,
        platform: string,
        platformUserId: string,
        options: { username?: string; mode?: string; sessionData?: any } = {}
    ): Promise<UserPlatform> {
        const encryptedSession = options.sessionData
            ? this.encrypt(JSON.stringify(options.sessionData))
            : null;

        const result = await this.db.query<any>(
            `INSERT INTO user_platforms (user_id, platform, platform_user_id, platform_username, session_data_encrypted, mode)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (platform, platform_user_id)
             DO UPDATE SET
                 user_id = EXCLUDED.user_id,
                 platform_username = COALESCE(EXCLUDED.platform_username, user_platforms.platform_username),
                 session_data_encrypted = COALESCE(EXCLUDED.session_data_encrypted, user_platforms.session_data_encrypted),
                 mode = COALESCE(EXCLUDED.mode, user_platforms.mode),
                 is_active = true
             RETURNING *`,
            [
                userId,
                platform,
                platformUserId,
                options.username || null,
                encryptedSession,
                options.mode || 'default',
            ]
        );

        return this.mapRowToPlatform(result.rows[0]);
    }

    async getPlatformSession(userId: string, platform: string): Promise<any | null> {
        const result = await this.db.query<any>(
            'SELECT session_data_encrypted FROM user_platforms WHERE user_id = $1 AND platform = $2 AND is_active = true',
            [userId, platform]
        );

        if (result.rows.length === 0 || !result.rows[0].session_data_encrypted) return null;

        try {
            return JSON.parse(this.decrypt(result.rows[0].session_data_encrypted));
        } catch {
            console.error('[UserService] Failed to decrypt platform session');
            return null;
        }
    }

    async updatePlatformSession(userId: string, platform: string, sessionData: any): Promise<void> {
        const encryptedSession = this.encrypt(JSON.stringify(sessionData));

        await this.db.query(
            `UPDATE user_platforms SET session_data_encrypted = $1
             WHERE user_id = $2 AND platform = $3`,
            [encryptedSession, userId, platform]
        );
    }

    async listUserPlatforms(userId: string): Promise<UserPlatform[]> {
        const result = await this.db.query<any>(
            `SELECT id, user_id, platform, platform_user_id, platform_username, mode, is_active, connected_at, last_message_at
             FROM user_platforms WHERE user_id = $1 ORDER BY connected_at DESC`,
            [userId]
        );

        return result.rows.map(this.mapRowToPlatform);
    }

    async disconnectPlatform(userId: string, platform: string): Promise<boolean> {
        const result = await this.db.query(
            'UPDATE user_platforms SET is_active = false WHERE user_id = $1 AND platform = $2',
            [userId, platform]
        );
        return (result.rowCount || 0) > 0;
    }

    async updateLastMessage(platform: string, platformUserId: string): Promise<void> {
        await this.db.query(
            'UPDATE user_platforms SET last_message_at = NOW() WHERE platform = $1 AND platform_user_id = $2',
            [platform, platformUserId]
        );
    }

    private mapRowToUser(row: any): User {
        return {
            id: row.id,
            email: row.email,
            name: row.name,
            avatarUrl: row.avatar_url,
            oauthProvider: row.oauth_provider,
            oauthId: row.oauth_id,
            isActive: row.is_active,
            isAdmin: row.is_admin,
            settings: row.settings || {},
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
        };
    }

    private mapRowToApiKey(row: any): UserApiKey {
        return {
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            name: row.name,
            modelId: row.model_id,
            baseUrl: row.base_url,
            tier: row.tier,
            isActive: row.is_active,
            isValidated: row.is_validated,
            lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
            createdAt: new Date(row.created_at),
        };
    }

    private mapRowToPlatform(row: any): UserPlatform {
        return {
            id: row.id,
            userId: row.user_id,
            platform: row.platform,
            platformUserId: row.platform_user_id,
            platformUsername: row.platform_username,
            mode: row.mode,
            isActive: row.is_active,
            connectedAt: new Date(row.connected_at),
            lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
        };
    }
}
