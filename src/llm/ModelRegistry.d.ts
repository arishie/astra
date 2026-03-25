export interface ModelConfig {
    name: string;
    providerType: 'openai' | 'anthropic' | 'google' | 'openai-compatible';
    modelId: string;
    baseUrl?: string;
    apiKey: string;
    tier?: 1 | 2 | 3;
    isLocal?: boolean;
}
export declare class ModelRegistry {
    private configs;
    private userId;
    private encryptionKey;
    constructor(userId?: string);
    private deriveEncryptionKey;
    private encrypt;
    private decrypt;
    registerModel(config: ModelConfig): void;
    getConfig(name: string): ModelConfig | undefined;
    getConfigMasked(name: string): Omit<ModelConfig, 'apiKey'> & {
        apiKeyMasked: string;
    } | undefined;
    listModels(): string[];
    removeModel(name: string): boolean;
    hasModel(name: string): boolean;
    updateApiKey(name: string, newApiKey: string): boolean;
    validateApiKey(name: string): Promise<{
        valid: boolean;
        error?: string;
    }>;
    private validateOpenAIKey;
    private validateAnthropicKey;
    private validateGoogleKey;
    private validateOpenAICompatibleKey;
    exportForUser(): Array<Omit<ModelConfig, 'apiKey'> & {
        hasApiKey: boolean;
    }>;
}
//# sourceMappingURL=ModelRegistry.d.ts.map