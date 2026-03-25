import { type ModelConfig } from './ModelRegistry.js';
import { type LanguageModel } from 'ai';
export declare class UniversalAdapter {
    static createModel(config: ModelConfig): LanguageModel;
    /**
     * Translates system prompts to be optimized for specific providers.
     */
    static translateSystemPrompt(originalPrompt: string, providerType: string): string;
}
//# sourceMappingURL=UniversalAdapter.d.ts.map