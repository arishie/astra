import * as crypto from 'crypto';
export class ModelRegistry {
    configs = new Map();
    userId;
    encryptionKey;
    constructor(userId = 'system') {
        this.userId = userId;
        this.encryptionKey = this.deriveEncryptionKey(userId);
        if (this.configs.size === 0) {
            this.registerModel({
                name: 'gemini-1.5-flash',
                providerType: 'google',
                modelId: 'gemini-1.5-flash',
                apiKey: '',
                tier: 1
            });
        }
    }
    deriveEncryptionKey(userId) {
        const masterKey = process.env.MASTER_ENCRYPTION_KEY;
        if (!masterKey || masterKey.length < 32) {
            console.warn('[ModelRegistry] MASTER_ENCRYPTION_KEY not set or too short. Using fallback for development.');
            const fallbackKey = crypto.scryptSync('astra-development-only-key', `salt:${userId}`, 32);
            return fallbackKey;
        }
        return crypto.scryptSync(masterKey, `user:${userId}`, 32);
    }
    encrypt(plaintext) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return {
            iv: iv.toString('hex'),
            data: encrypted,
            authTag: authTag.toString('hex')
        };
    }
    decrypt(encrypted) {
        const iv = Buffer.from(encrypted.iv, 'hex');
        const authTag = Buffer.from(encrypted.authTag, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    registerModel(config) {
        const secureConfig = { ...config };
        if (config.apiKey && config.apiKey.length > 0) {
            const encrypted = this.encrypt(config.apiKey);
            secureConfig.apiKey = `encrypted:${JSON.stringify(encrypted)}`;
        }
        this.configs.set(config.name, secureConfig);
        console.log(`[ModelRegistry] Registered model: ${config.name} (User: ${this.userId.substring(0, 8)}...)`);
    }
    getConfig(name) {
        const config = this.configs.get(name);
        if (!config)
            return undefined;
        const decryptedConfig = { ...config };
        if (config.apiKey && config.apiKey.startsWith('encrypted:')) {
            try {
                const encryptedData = JSON.parse(config.apiKey.substring(10));
                decryptedConfig.apiKey = this.decrypt(encryptedData);
            }
            catch (error) {
                console.error(`[ModelRegistry] Failed to decrypt API key for ${name}`);
                decryptedConfig.apiKey = '';
            }
        }
        return decryptedConfig;
    }
    getConfigMasked(name) {
        const config = this.configs.get(name);
        if (!config)
            return undefined;
        const { apiKey, ...rest } = config;
        let maskedKey = '';
        if (apiKey && !apiKey.startsWith('encrypted:') && apiKey.length > 8) {
            maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
        }
        else if (apiKey && apiKey.startsWith('encrypted:')) {
            maskedKey = '[encrypted]';
        }
        return {
            ...rest,
            apiKeyMasked: maskedKey
        };
    }
    listModels() {
        return Array.from(this.configs.keys());
    }
    removeModel(name) {
        return this.configs.delete(name);
    }
    hasModel(name) {
        return this.configs.has(name);
    }
    updateApiKey(name, newApiKey) {
        const config = this.configs.get(name);
        if (!config)
            return false;
        const encrypted = this.encrypt(newApiKey);
        config.apiKey = `encrypted:${JSON.stringify(encrypted)}`;
        this.configs.set(name, config);
        console.log(`[ModelRegistry] Updated API key for model: ${name}`);
        return true;
    }
    async validateApiKey(name) {
        const config = this.getConfig(name);
        if (!config) {
            return { valid: false, error: 'Model not found' };
        }
        if (!config.apiKey) {
            return { valid: false, error: 'No API key configured' };
        }
        try {
            switch (config.providerType) {
                case 'openai':
                    return await this.validateOpenAIKey(config);
                case 'anthropic':
                    return await this.validateAnthropicKey(config);
                case 'google':
                    return await this.validateGoogleKey(config);
                case 'openai-compatible':
                    return await this.validateOpenAICompatibleKey(config);
                default:
                    return { valid: false, error: 'Unknown provider type' };
            }
        }
        catch (error) {
            return { valid: false, error: `Validation error: ${error}` };
        }
    }
    async validateOpenAIKey(config) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${config.apiKey}` }
            });
            if (response.ok) {
                return { valid: true };
            }
            return { valid: false, error: `OpenAI API returned ${response.status}` };
        }
        catch (error) {
            return { valid: false, error: `Connection failed: ${error}` };
        }
    }
    async validateAnthropicKey(config) {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            });
            if (response.ok || response.status === 400) {
                return { valid: true };
            }
            if (response.status === 401) {
                return { valid: false, error: 'Invalid API key' };
            }
            return { valid: false, error: `Anthropic API returned ${response.status}` };
        }
        catch (error) {
            return { valid: false, error: `Connection failed: ${error}` };
        }
    }
    async validateGoogleKey(config) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`);
            if (response.ok) {
                return { valid: true };
            }
            return { valid: false, error: `Google AI API returned ${response.status}` };
        }
        catch (error) {
            return { valid: false, error: `Connection failed: ${error}` };
        }
    }
    async validateOpenAICompatibleKey(config) {
        if (!config.baseUrl) {
            return { valid: false, error: 'Base URL required for OpenAI-compatible providers' };
        }
        try {
            const response = await fetch(`${config.baseUrl}/models`, {
                headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
            });
            if (response.ok) {
                return { valid: true };
            }
            return { valid: false, error: `API returned ${response.status}` };
        }
        catch (error) {
            return { valid: false, error: `Connection failed: ${error}` };
        }
    }
    exportForUser() {
        const result = [];
        for (const [name, config] of this.configs) {
            const { apiKey, ...rest } = config;
            result.push({
                ...rest,
                hasApiKey: !!apiKey && apiKey.length > 0
            });
        }
        return result;
    }
}
//# sourceMappingURL=ModelRegistry.js.map