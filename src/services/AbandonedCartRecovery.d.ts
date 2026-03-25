/**
 * Abandoned Cart Recovery Service
 * Visual-first cart recovery with personalized multi-touch sequences
 * Integrates with messaging platforms to re-engage customers
 */
import { EventEmitter } from 'events';
export interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    variant?: string;
    originalPrice?: number;
}
export interface AbandonedCart {
    id: string;
    customerId: string;
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
    platform: string;
    platformUserId: string;
    items: CartItem[];
    subtotal: number;
    currency: string;
    abandonedAt: Date;
    lastActivityAt: Date;
    recoveryStatus: RecoveryStatus;
    recoveryAttempts: RecoveryAttempt[];
    metadata?: Record<string, any>;
}
export type RecoveryStatus = 'pending' | 'in_progress' | 'recovered' | 'expired' | 'unsubscribed';
export interface RecoveryAttempt {
    id: string;
    cartId: string;
    sequenceStep: number;
    sentAt: Date;
    channel: string;
    messageType: string;
    discountOffered?: DiscountOffer;
    opened: boolean;
    clicked: boolean;
    converted: boolean;
    response?: string;
}
export interface DiscountOffer {
    type: 'percentage' | 'fixed' | 'free_shipping';
    value: number;
    code: string;
    expiresAt: Date;
    minPurchase?: number;
    maxDiscount?: number;
}
export interface RecoverySequence {
    id: string;
    name: string;
    steps: RecoveryStep[];
    isActive: boolean;
}
export interface RecoveryStep {
    stepNumber: number;
    delayMinutes: number;
    channel: 'email' | 'sms' | 'whatsapp' | 'telegram' | 'push';
    messageTemplate: string;
    includeVisual: boolean;
    discountStrategy?: DiscountStrategy;
}
export interface DiscountStrategy {
    type: 'none' | 'fixed' | 'escalating' | 'dynamic';
    baseValue?: number;
    maxValue?: number;
    escalationRate?: number;
}
export interface CustomerHistory {
    customerId: string;
    totalPurchases: number;
    totalSpent: number;
    averageOrderValue: number;
    lastPurchaseDate?: Date;
    abandonedCarts: number;
    recoveredCarts: number;
    preferredChannel?: string;
    timezone?: string;
}
export interface RecoveryMetrics {
    totalAbandoned: number;
    totalRecovered: number;
    recoveryRate: number;
    revenueRecovered: number;
    averageRecoveryTime: number;
    bestPerformingStep: number;
    bestPerformingChannel: string;
    discountUsageRate: number;
}
export interface VisualCartImage {
    url: string;
    base64?: string;
    width: number;
    height: number;
    format: 'png' | 'jpg' | 'webp';
}
export declare class CartTracker extends EventEmitter {
    private carts;
    private abandonmentThresholdMinutes;
    constructor(abandonmentThreshold?: number);
    /**
     * Track a cart update event
     */
    trackCartUpdate(cartId: string, customerId: string, items: CartItem[], metadata: {
        platform: string;
        platformUserId: string;
        customerEmail?: string;
        customerPhone?: string;
        customerName?: string;
    }): Promise<void>;
    /**
     * Mark cart as abandoned after threshold
     */
    checkForAbandonment(): Promise<AbandonedCart[]>;
    /**
     * Mark cart as recovered (purchase completed)
     */
    markRecovered(cartId: string, purchaseValue?: number): Promise<void>;
    /**
     * Get cart by ID
     */
    getCart(cartId: string): AbandonedCart | undefined;
    /**
     * Get all abandoned carts pending recovery
     */
    getAbandonedCarts(): AbandonedCart[];
    /**
     * Handle webhook from e-commerce platform
     */
    handleWebhook(event: {
        type: 'cart.created' | 'cart.updated' | 'checkout.started' | 'checkout.completed' | 'cart.abandoned';
        data: any;
    }): Promise<void>;
}
export declare class RecoverySequencer {
    private sequences;
    private activeRecoveries;
    constructor();
    private initializeDefaultSequence;
    /**
     * Start recovery sequence for a cart
     */
    startSequence(cart: AbandonedCart, sequenceId?: string): Promise<void>;
    /**
     * Cancel recovery sequence
     */
    cancelSequence(cartId: string): Promise<void>;
    /**
     * Execute a recovery step
     */
    private executeStep;
    /**
     * Get next scheduled step for a cart
     */
    getNextStep(cart: AbandonedCart, sequenceId?: string): RecoveryStep | null;
    /**
     * Add or update a sequence
     */
    addSequence(sequence: RecoverySequence): void;
    /**
     * Get sequence by ID
     */
    getSequence(sequenceId: string): RecoverySequence | undefined;
    /**
     * Get optimal timing based on customer timezone
     */
    getOptimalSendTime(scheduledTime: Date, customerTimezone?: string): Date;
}
export declare class VisualCartRenderer {
    /**
     * Generate visual representation of abandoned cart
     */
    renderCart(cart: AbandonedCart): Promise<VisualCartImage>;
    /**
     * Generate visual with discount badge
     */
    renderCartWithDiscount(cart: AbandonedCart, discount: DiscountOffer): Promise<VisualCartImage>;
    private calculateDiscountedTotal;
    private escapeHtml;
}
export declare class DiscountEngine {
    private baseDiscountPercentage;
    private maxDiscountPercentage;
    /**
     * Calculate personalized discount based on cart and customer history
     */
    calculateDiscount(cart: AbandonedCart, customerHistory: CustomerHistory, step: RecoveryStep): Promise<DiscountOffer | null>;
    /**
     * Calculate dynamic discount based on multiple factors
     */
    private calculateDynamicDiscount;
    private generateDiscountCode;
    /**
     * Validate a discount code
     */
    validateDiscount(code: string, cartValue: number, discount: DiscountOffer): Promise<{
        valid: boolean;
        reason?: string;
    }>;
}
export declare class MessageTemplateBuilder {
    private templates;
    constructor();
    private initializeTemplates;
    /**
     * Build message from template
     */
    build(templateId: string, cart: AbandonedCart, discount?: DiscountOffer, extra?: Record<string, any>): string;
    private buildDefault;
    /**
     * Add custom template
     */
    addTemplate(id: string, builder: (data: TemplateData) => string): void;
    /**
     * Adapt message for specific platform
     */
    adaptForPlatform(message: string, platform: string): string;
}
interface TemplateData {
    customerName?: string;
    itemsSummary: string;
    total: string;
    itemCount: number;
    discountCode?: string;
    discountValue?: number;
    socialProofText?: string;
    lowStockItems?: string;
    [key: string]: any;
}
export declare class AnalyticsTracker extends EventEmitter {
    private metrics;
    private stepPerformance;
    private channelPerformance;
    private recoveryTimes;
    private discountsUsed;
    private discountsOffered;
    /**
     * Track cart abandonment
     */
    trackAbandonment(cart: AbandonedCart): void;
    /**
     * Track recovery attempt sent
     */
    trackAttemptSent(attempt: RecoveryAttempt): void;
    /**
     * Track successful recovery
     */
    trackRecovery(cart: AbandonedCart, purchaseValue: number, recoveringAttempt: RecoveryAttempt): void;
    private updateRecoveryRate;
    private calculateAverageRecoveryTime;
    private updateBestPerformers;
    private updateDiscountUsageRate;
    /**
     * Get current metrics
     */
    getMetrics(): RecoveryMetrics;
    /**
     * Get step-by-step analytics
     */
    getStepAnalytics(): Map<number, {
        sent: number;
        converted: number;
        rate: number;
    }>;
    /**
     * Get channel analytics
     */
    getChannelAnalytics(): Map<string, {
        sent: number;
        converted: number;
        rate: number;
    }>;
}
export declare class AbandonedCartRecovery extends EventEmitter {
    private cartTracker;
    private recoverySequencer;
    private visualRenderer;
    private discountEngine;
    private templateBuilder;
    private analyticsTracker;
    private customerHistories;
    private checkInterval?;
    constructor(options?: {
        abandonmentThresholdMinutes?: number;
        checkIntervalMinutes?: number;
    });
    private setupEventHandlers;
    /**
     * Track cart abandonment via webhook
     */
    trackAbandonment(event: {
        type: 'cart.created' | 'cart.updated' | 'checkout.started' | 'checkout.completed' | 'cart.abandoned';
        data: any;
    }): Promise<void>;
    /**
     * Manually trigger recovery for a cart
     */
    triggerRecovery(cartId: string): Promise<void>;
    /**
     * Start recovery sequence
     */
    private startRecovery;
    /**
     * Execute a recovery step
     */
    private executeRecoveryStep;
    /**
     * Handle successful recovery
     */
    private handleRecovery;
    /**
     * Check for abandoned carts periodically
     */
    private checkForAbandonedCarts;
    /**
     * Get or create customer history
     */
    private getOrCreateCustomerHistory;
    /**
     * Update customer history
     */
    updateCustomerHistory(customerId: string, history: Partial<CustomerHistory>): void;
    /**
     * Get recovery metrics
     */
    getMetrics(): RecoveryMetrics;
    /**
     * Get step analytics
     */
    getStepAnalytics(): Map<number, {
        sent: number;
        converted: number;
        rate: number;
    }>;
    /**
     * Get channel analytics
     */
    getChannelAnalytics(): Map<string, {
        sent: number;
        converted: number;
        rate: number;
    }>;
    /**
     * Add custom recovery sequence
     */
    addSequence(sequence: RecoverySequence): void;
    /**
     * Add custom message template
     */
    addTemplate(id: string, builder: (data: TemplateData) => string): void;
    /**
     * Stop recovery service
     */
    stop(): void;
}
export declare function createAbandonedCartRecovery(options?: {
    abandonmentThresholdMinutes?: number;
    checkIntervalMinutes?: number;
}): AbandonedCartRecovery;
export {};
//# sourceMappingURL=AbandonedCartRecovery.d.ts.map