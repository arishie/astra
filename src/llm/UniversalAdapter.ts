import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { type ModelConfig } from './ModelRegistry.js';
import { type LanguageModel } from 'ai';

export class UniversalAdapter {
    
    public static createModel(config: ModelConfig): LanguageModel {
        if (!config.apiKey && config.providerType !== 'openai-compatible') {
             // OpenAI compatible might rely on internal routing or no auth for local, 
             // but usually requires a dummy key.
             console.warn(`[UniversalAdapter] Warning: API Key missing for ${config.name}`);
        }

        switch (config.providerType) {
            case 'google':
                const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
                return google(config.modelId);

            case 'anthropic':
                // @ts-ignore - Vercel AI SDK types can be strict with exactOptionalPropertyTypes
                const anthropic = createAnthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
                return anthropic(config.modelId);

            case 'openai':
                // @ts-ignore
                const openai = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
                return openai(config.modelId);
            
            case 'openai-compatible':
                // Generic handler for Ollama, vLLM, Groq, etc.
                // @ts-ignore
                const generic = createOpenAI({ 
                    apiKey: config.apiKey || 'dummy', // Many local servers need a non-empty string
                    baseURL: config.baseUrl 
                });
                return generic(config.modelId);

            default:
                throw new Error(`Unsupported provider type: ${config.providerType}`);
        }
    }

    /**
     * Translates system prompts to be optimized for specific providers.
     */
    public static translateSystemPrompt(originalPrompt: string, providerType: string): string {
        if (providerType === 'anthropic') {
            // Claude prefers XML structured instructions
            return `
<system_instructions>
    ${originalPrompt}
</system_instructions>
<role_definition>
    You are a precise and helpful AI assistant.
</role_definition>
            `.trim();
        }
        
        // Default (OpenAI/Google/Others prefer standard markdown/text)
        return originalPrompt;
    }
}
