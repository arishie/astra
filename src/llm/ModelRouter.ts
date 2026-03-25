import { generateText } from 'ai';
import { ModelRegistry, type ModelConfig } from './ModelRegistry.js';
import { UniversalAdapter } from './UniversalAdapter.js';
import { TaskClassifier, TaskTier } from '../core/TaskClassifier.js';

export enum BrainRole {
    THINKER = 'thinker',
    CODER = 'coder',
    CHAT = 'chat',
    AUDITOR = 'auditor'
}

export class ModelRouter {
    private registry: ModelRegistry;
    private roleMap: Map<BrainRole, string> = new Map();
    private activeModelName: string = 'gemini-1.5-flash';

    constructor() {
        this.registry = new ModelRegistry();
        // Initialize defaults
        this.roleMap.set(BrainRole.CHAT, 'gemini-1.5-flash');
    }

    public getRegistry(): ModelRegistry {
        return this.registry;
    }

    public setActiveModel(modelName: string) {
        if (!this.registry.getConfig(modelName)) {
            throw new Error(`Model '${modelName}' is not registered.`);
        }
        this.activeModelName = modelName;
        // Also update standard roles to this preference unless strictly overridden
        this.roleMap.set(BrainRole.CHAT, modelName);
        this.roleMap.set(BrainRole.CODER, modelName);
    }

    /**
     * Selects the best model based on task complexity (Tier) and availability.
     */
    private selectModelForTier(tier: TaskTier): ModelConfig {
        const allModels = this.registry.listModels();
        let candidateName = this.activeModelName;
        
        // Find best fit in registry
        for (const name of allModels) {
            const cfg = this.registry.getConfig(name);
            if (cfg && cfg.tier === tier) {
                candidateName = name;
                break;
            }
        }
        
        // Fallback logic
        return this.registry.getConfig(candidateName) || this.registry.getConfig('gemini-1.5-flash')!;
    }

    public async generateResponse(query: string, context: string, role: BrainRole = BrainRole.CHAT): Promise<string> {
        // 1. Analyze Complexity
        const tier = TaskClassifier.classify(query);
        console.log(`[ModelRouter] Task Analysis: Tier ${tier} (Role: ${role})`);

        // 2. Select Model (Dynamic or Role-based)
        let config: ModelConfig;
        
        if (this.roleMap.has(role)) {
            // Explicit role assignment takes precedence
            config = this.registry.getConfig(this.roleMap.get(role)!)!;
        } else {
            // Dynamic selection
            config = this.selectModelForTier(tier);
        }

        if (!config) {
             // Ultimate fallback
             config = this.registry.getConfig(this.registry.listModels()[0]!)!;
        }

        return this.executeWithFailover(query, context, config);
    }

    private async executeWithFailover(query: string, context: string, config: ModelConfig): Promise<string> {
        const maxRetries = 2;
        let attempt = 0;
        let currentConfig = config;

        while (attempt <= maxRetries) {
            try {
                console.log(`[ModelRouter] 🧠 Routing to: ${currentConfig.name} (${currentConfig.modelId})`);
                
                const model = UniversalAdapter.createModel(currentConfig);
                const rawSystemPrompt = `
                You are Astra, an advanced AI assistant. 
                You have access to the user's local documents via RAG.
                
                CONTEXT FROM LOCAL FILES:
                ${context}
                
                INSTRUCTIONS:
                1. Answer the user's query based on the context provided.
                2. Be concise and professional.
                `;

                const systemPrompt = UniversalAdapter.translateSystemPrompt(rawSystemPrompt, currentConfig.providerType);

                const { text } = await generateText({
                    model: model,
                    system: systemPrompt,
                    prompt: query,
                });

                return text;

            } catch (e: any) {
                console.warn(`[ModelRouter] ⚠️ Failure on ${currentConfig.name}: ${e.message}`);
                attempt++;
                
                if (attempt <= maxRetries) {
                    // Failover Strategy: Downgrade or Switch Provider
                    console.log(`[ModelRouter] 🔄 Failover initiated...`);
                    const nextModel = this.findFailoverModel(currentConfig);
                    if (nextModel) {
                        currentConfig = nextModel;
                    } else {
                        throw new Error("No failover models available.");
                    }
                }
            }
        }
        throw new Error("All model attempts failed.");
    }

    private findFailoverModel(failedConfig: ModelConfig): ModelConfig | undefined {
        const all = this.registry.listModels();
        // Try to find a model from a DIFFERENT provider
        for (const name of all) {
            const candidate = this.registry.getConfig(name);
            if (candidate && candidate.providerType !== failedConfig.providerType) {
                return candidate;
            }
        }
        // If no different provider, just pick any other
        for (const name of all) {
            if (name !== failedConfig.name) return this.registry.getConfig(name);
        }
        return undefined;
    }
}
