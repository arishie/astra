/**
 * ScreenshotUnderstanding - AI Vision for Screenshots
 *
 * VIRAL FEATURE: Send any screenshot to your WhatsApp/Telegram bot,
 * Astra understands it and helps you.
 *
 * Examples:
 * - Screenshot of error message → Explains error and suggests fix
 * - Screenshot of email → Summarizes and drafts reply
 * - Screenshot of receipt → Extracts info for expense tracking
 * - Screenshot of code → Explains, debugs, or improves it
 * - Screenshot of schedule → Converts to calendar events
 * - Screenshot of product → Finds best price online
 * - Screenshot of food → Estimates calories and nutrition
 * - Screenshot of plant → Identifies species and care tips
 * - Screenshot of math problem → Solves it step by step
 * - Screenshot of foreign text → Translates it
 */
import { EventEmitter } from 'events';
export interface Screenshot {
    id: string;
    userId: string;
    platform: 'whatsapp' | 'telegram' | 'discord';
    imagePath: string;
    mimeType: string;
    width?: number;
    height?: number;
    timestamp: Date;
    caption?: string;
}
export interface VisionAnalysis {
    type: ScreenshotType;
    confidence: number;
    description: string;
    extractedText?: string;
    entities: ExtractedEntities;
    suggestedActions: SuggestedAction[];
}
export type ScreenshotType = 'error_message' | 'code' | 'email' | 'receipt' | 'schedule' | 'product' | 'food' | 'document' | 'social_media' | 'chat' | 'map' | 'math' | 'foreign_text' | 'plant' | 'ui_screen' | 'other';
export interface ExtractedEntities {
    text?: string[];
    numbers?: number[];
    dates?: Date[];
    prices?: {
        amount: number;
        currency: string;
    }[];
    emails?: string[];
    urls?: string[];
    phoneNumbers?: string[];
    addresses?: string[];
    products?: {
        name: string;
        price?: string;
    }[];
    people?: string[];
    code?: {
        language: string;
        snippet: string;
    }[];
}
export interface SuggestedAction {
    label: string;
    action: string;
    data: Record<string, any>;
    priority: number;
}
export interface VisionResponse {
    analysis: VisionAnalysis;
    response: string;
    actions: SuggestedAction[];
}
export declare class ScreenshotUnderstanding extends EventEmitter {
    private openaiApiKey?;
    private anthropicApiKey?;
    private googleApiKey?;
    constructor(options?: {
        openaiApiKey?: string;
        anthropicApiKey?: string;
        googleApiKey?: string;
    });
    /**
     * Analyze a screenshot and provide intelligent response
     */
    analyze(screenshot: Screenshot): Promise<VisionResponse>;
    /**
     * Call vision model to analyze image
     */
    private analyzeWithVision;
    /**
     * Analyze with OpenAI GPT-4 Vision
     */
    private analyzeWithOpenAI;
    /**
     * Analyze with Anthropic Claude Vision
     */
    private analyzeWithAnthropic;
    /**
     * Generate user-friendly response based on analysis
     */
    private generateResponse;
    /**
     * Explain common error messages
     */
    private explainError;
}
export default ScreenshotUnderstanding;
//# sourceMappingURL=ScreenshotUnderstanding.d.ts.map