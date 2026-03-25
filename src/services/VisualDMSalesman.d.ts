/**
 * Visual DM Salesman Service
 * AI-powered sales assistant that engages customers via direct messages
 * with visual product presentations and intelligent objection handling
 */
import { EventEmitter } from 'events';
export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    images: string[];
    category: string;
    tags: string[];
    inStock: boolean;
    variants?: ProductVariant[];
    metadata?: Record<string, any>;
}
export interface ProductVariant {
    id: string;
    name: string;
    price: number;
    attributes: Record<string, string>;
    inStock: boolean;
}
export interface ProductCatalog {
    products: Product[];
    categories: string[];
    getProduct(id: string): Product | undefined;
    searchProducts(query: string): Product[];
    getProductsByCategory(category: string): Product[];
}
export interface ConversationMessage {
    id: string;
    role: 'customer' | 'agent' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}
export interface Conversation {
    id: string;
    customerId: string;
    customerName?: string;
    messages: ConversationMessage[];
    startedAt: Date;
    lastActivityAt: Date;
    stage: SalesFunnelStage;
    metadata?: Record<string, any>;
}
export type SalesFunnelStage = 'awareness' | 'interest' | 'consideration' | 'intent' | 'purchase' | 'closed_won' | 'closed_lost';
export interface PurchaseIntent {
    detected: boolean;
    confidence: number;
    signals: IntentSignal[];
    suggestedProducts: string[];
    estimatedValue: number;
    stage: SalesFunnelStage;
}
export interface IntentSignal {
    type: 'keyword' | 'question' | 'comparison' | 'price_inquiry' | 'urgency' | 'objection';
    text: string;
    strength: number;
}
export interface VisualPresentation {
    type: 'single' | 'carousel' | 'comparison' | 'bundle';
    products: Product[];
    title?: string;
    description?: string;
    callToAction?: string;
    discount?: DiscountOffer;
}
export interface DiscountOffer {
    type: 'percentage' | 'fixed' | 'free_shipping';
    value: number;
    code?: string;
    expiresAt?: Date;
    minPurchase?: number;
}
export interface ObjectionResponse {
    objectionType: string;
    response: string;
    followUp?: string;
    alternativeProducts?: string[];
}
export interface ConversionMetrics {
    conversationId: string;
    customerId: string;
    startTime: Date;
    endTime?: Date;
    messagesCount: number;
    productsViewed: string[];
    productsRecommended: string[];
    converted: boolean;
    purchaseValue?: number;
    timeToConversion?: number;
    objectionsCounted: number;
    objectionsOvercome: number;
}
export interface EngagementResult {
    response: string;
    visualPresentation?: VisualPresentation;
    intent: PurchaseIntent;
    suggestedActions: string[];
    metrics: Partial<ConversionMetrics>;
}
export declare class IntentAnalyzer {
    private buyingKeywords;
    private comparisonKeywords;
    private urgencyKeywords;
    private objectionKeywords;
    analyze(conversation: Conversation): Promise<PurchaseIntent>;
    private determineStage;
}
export declare class ProductMatcher {
    match(conversation: Conversation, catalog: ProductCatalog, intent: PurchaseIntent): Promise<Product[]>;
    private extractKeywords;
}
export declare class VisualPresenter {
    createPresentation(products: Product[], type?: VisualPresentation['type'], options?: {
        title?: string;
        discount?: DiscountOffer;
    }): Promise<VisualPresentation>;
    private createSinglePresentation;
    private createCarouselPresentation;
    private createComparisonPresentation;
    private createBundlePresentation;
    private applyDiscount;
    generateCarouselImage(products: Product[]): Promise<string>;
}
export declare class ObjectionHandler {
    private objectionResponses;
    handle(objection: string, conversation: Conversation, products: Product[]): Promise<ObjectionResponse>;
    private classifyObjection;
}
export declare class ConversationTracker extends EventEmitter {
    private conversations;
    private metrics;
    startConversation(customerId: string, customerName?: string): Promise<Conversation>;
    addMessage(conversationId: string, role: ConversationMessage['role'], content: string, metadata?: Record<string, any>): Promise<ConversationMessage>;
    updateStage(conversationId: string, stage: SalesFunnelStage): Promise<void>;
    trackProductView(conversationId: string, productId: string): Promise<void>;
    trackProductRecommendation(conversationId: string, productIds: string[]): Promise<void>;
    trackObjection(conversationId: string, overcome: boolean): Promise<void>;
    getConversation(conversationId: string): Conversation | undefined;
    getMetrics(conversationId: string): ConversionMetrics | undefined;
    getAllMetrics(): ConversionMetrics[];
    getConversionRate(): number;
}
export declare class PersonalizationEngine {
    analyzeCustomerStyle(conversation: Conversation): Promise<CustomerStyle>;
    personalizeMessage(message: string, style: CustomerStyle): Promise<string>;
}
export interface CustomerStyle {
    communicationStyle: 'detailed' | 'concise';
    formality: 'formal' | 'casual';
    usesEmojis: boolean;
    asksQuestions: boolean;
    responsePreference: 'detailed' | 'brief';
}
export declare class VisualDMSalesman extends EventEmitter {
    private intentAnalyzer;
    private productMatcher;
    private visualPresenter;
    private objectionHandler;
    private conversationTracker;
    private personalizationEngine;
    constructor();
    private setupEventHandlers;
    /**
     * Main engagement method - processes customer message and generates response
     */
    engage(conversation: Conversation, catalog: ProductCatalog, latestMessage?: string): Promise<EngagementResult>;
    /**
     * Start a new sales conversation
     */
    startConversation(customerId: string, customerName?: string, initialMessage?: string): Promise<Conversation>;
    /**
     * Get conversation by ID
     */
    getConversation(conversationId: string): Conversation | undefined;
    /**
     * Get overall conversion metrics
     */
    getConversionRate(): number;
    /**
     * Get all conversation metrics
     */
    getAllMetrics(): ConversionMetrics[];
    private generateResponse;
    private getSuggestedActions;
}
export declare function createVisualDMSalesman(): VisualDMSalesman;
//# sourceMappingURL=VisualDMSalesman.d.ts.map