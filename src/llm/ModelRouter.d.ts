import { ModelRegistry } from './ModelRegistry.js';
export declare enum BrainRole {
    THINKER = "thinker",
    CODER = "coder",
    CHAT = "chat",
    AUDITOR = "auditor"
}
export declare class ModelRouter {
    private registry;
    private roleMap;
    private activeModelName;
    constructor();
    getRegistry(): ModelRegistry;
    setActiveModel(modelName: string): void;
    /**
     * Selects the best model based on task complexity (Tier) and availability.
     */
    private selectModelForTier;
    generateResponse(query: string, context: string, role?: BrainRole): Promise<string>;
    private executeWithFailover;
    private findFailoverModel;
}
//# sourceMappingURL=ModelRouter.d.ts.map