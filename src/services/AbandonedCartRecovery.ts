/**
 * Abandoned Cart Recovery Service
 * Visual-first cart recovery with personalized multi-touch sequences
 * Integrates with messaging platforms to re-engage customers
 */

import { EventEmitter } from 'events';

// ============================================================================
// Interfaces & Types
// ============================================================================

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

export type RecoveryStatus =
    | 'pending'           // Waiting for first recovery attempt
    | 'in_progress'       // Recovery sequence active
    | 'recovered'         // Customer completed purchase
    | 'expired'           // Recovery window closed
    | 'unsubscribed';     // Customer opted out

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
    delayMinutes: number;         // Delay from cart abandonment
    channel: 'email' | 'sms' | 'whatsapp' | 'telegram' | 'push';
    messageTemplate: string;
    includeVisual: boolean;
    discountStrategy?: DiscountStrategy;
}

export interface DiscountStrategy {
    type: 'none' | 'fixed' | 'escalating' | 'dynamic';
    baseValue?: number;
    maxValue?: number;
    escalationRate?: number;      // Increase per step
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

// ============================================================================
// Cart Tracker
// ============================================================================

export class CartTracker extends EventEmitter {
    private carts: Map<string, AbandonedCart> = new Map();
    private abandonmentThresholdMinutes: number = 30;

    constructor(abandonmentThreshold: number = 30) {
        super();
        this.abandonmentThresholdMinutes = abandonmentThreshold;
    }

    /**
     * Track a cart update event
     */
    async trackCartUpdate(
        cartId: string,
        customerId: string,
        items: CartItem[],
        metadata: {
            platform: string;
            platformUserId: string;
            customerEmail?: string;
            customerPhone?: string;
            customerName?: string;
        }
    ): Promise<void> {
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const cart: AbandonedCart = {
            id: cartId,
            customerId,
            customerEmail: metadata.customerEmail,
            customerPhone: metadata.customerPhone,
            customerName: metadata.customerName,
            platform: metadata.platform,
            platformUserId: metadata.platformUserId,
            items,
            subtotal,
            currency: 'USD',
            abandonedAt: new Date(),
            lastActivityAt: new Date(),
            recoveryStatus: 'pending',
            recoveryAttempts: []
        };

        this.carts.set(cartId, cart);
        this.emit('cart:updated', cart);
    }

    /**
     * Mark cart as abandoned after threshold
     */
    async checkForAbandonment(): Promise<AbandonedCart[]> {
        const now = Date.now();
        const threshold = this.abandonmentThresholdMinutes * 60 * 1000;
        const newlyAbandoned: AbandonedCart[] = [];

        for (const cart of this.carts.values()) {
            if (cart.recoveryStatus !== 'pending') continue;

            const timeSinceActivity = now - cart.lastActivityAt.getTime();
            if (timeSinceActivity >= threshold) {
                cart.recoveryStatus = 'in_progress';
                newlyAbandoned.push(cart);
                this.emit('cart:abandoned', cart);
            }
        }

        return newlyAbandoned;
    }

    /**
     * Mark cart as recovered (purchase completed)
     */
    async markRecovered(cartId: string, purchaseValue?: number): Promise<void> {
        const cart = this.carts.get(cartId);
        if (!cart) return;

        cart.recoveryStatus = 'recovered';
        this.emit('cart:recovered', { cart, purchaseValue });
    }

    /**
     * Get cart by ID
     */
    getCart(cartId: string): AbandonedCart | undefined {
        return this.carts.get(cartId);
    }

    /**
     * Get all abandoned carts pending recovery
     */
    getAbandonedCarts(): AbandonedCart[] {
        return Array.from(this.carts.values())
            .filter(c => c.recoveryStatus === 'in_progress');
    }

    /**
     * Handle webhook from e-commerce platform
     */
    async handleWebhook(event: {
        type: 'cart.created' | 'cart.updated' | 'checkout.started' | 'checkout.completed' | 'cart.abandoned';
        data: any;
    }): Promise<void> {
        switch (event.type) {
            case 'cart.created':
            case 'cart.updated':
                await this.trackCartUpdate(
                    event.data.cartId,
                    event.data.customerId,
                    event.data.items,
                    {
                        platform: event.data.platform || 'web',
                        platformUserId: event.data.platformUserId || event.data.customerId,
                        customerEmail: event.data.email,
                        customerPhone: event.data.phone,
                        customerName: event.data.name
                    }
                );
                break;

            case 'checkout.completed':
                await this.markRecovered(event.data.cartId, event.data.total);
                break;

            case 'cart.abandoned':
                const cart = this.carts.get(event.data.cartId);
                if (cart) {
                    cart.recoveryStatus = 'in_progress';
                    this.emit('cart:abandoned', cart);
                }
                break;
        }
    }
}

// ============================================================================
// Recovery Sequencer
// ============================================================================

export class RecoverySequencer {
    private sequences: Map<string, RecoverySequence> = new Map();
    private activeRecoveries: Map<string, NodeJS.Timeout[]> = new Map();

    constructor() {
        this.initializeDefaultSequence();
    }

    private initializeDefaultSequence(): void {
        const defaultSequence: RecoverySequence = {
            id: 'default',
            name: 'Standard Recovery',
            isActive: true,
            steps: [
                {
                    stepNumber: 1,
                    delayMinutes: 60,           // 1 hour
                    channel: 'whatsapp',
                    messageTemplate: 'reminder_gentle',
                    includeVisual: true,
                    discountStrategy: { type: 'none' }
                },
                {
                    stepNumber: 2,
                    delayMinutes: 60 * 24,      // 24 hours
                    channel: 'email',
                    messageTemplate: 'reminder_with_discount',
                    includeVisual: true,
                    discountStrategy: {
                        type: 'fixed',
                        baseValue: 10
                    }
                },
                {
                    stepNumber: 3,
                    delayMinutes: 60 * 72,      // 72 hours
                    channel: 'sms',
                    messageTemplate: 'last_chance',
                    includeVisual: false,
                    discountStrategy: {
                        type: 'escalating',
                        baseValue: 15,
                        maxValue: 25,
                        escalationRate: 5
                    }
                }
            ]
        };

        this.sequences.set('default', defaultSequence);
    }

    /**
     * Start recovery sequence for a cart
     */
    async startSequence(
        cart: AbandonedCart,
        sequenceId: string = 'default'
    ): Promise<void> {
        const sequence = this.sequences.get(sequenceId);
        if (!sequence || !sequence.isActive) {
            throw new Error(`Sequence ${sequenceId} not found or inactive`);
        }

        // Cancel any existing recovery for this cart
        await this.cancelSequence(cart.id);

        const timeouts: NodeJS.Timeout[] = [];
        const abandonedTime = cart.abandonedAt.getTime();

        for (const step of sequence.steps) {
            const executeAt = abandonedTime + (step.delayMinutes * 60 * 1000);
            const delay = executeAt - Date.now();

            if (delay > 0) {
                const timeout = setTimeout(() => {
                    this.executeStep(cart, step, sequence);
                }, delay);
                timeouts.push(timeout);
            }
        }

        this.activeRecoveries.set(cart.id, timeouts);
    }

    /**
     * Cancel recovery sequence
     */
    async cancelSequence(cartId: string): Promise<void> {
        const timeouts = this.activeRecoveries.get(cartId);
        if (timeouts) {
            timeouts.forEach(t => clearTimeout(t));
            this.activeRecoveries.delete(cartId);
        }
    }

    /**
     * Execute a recovery step
     */
    private async executeStep(
        cart: AbandonedCart,
        step: RecoveryStep,
        sequence: RecoverySequence
    ): Promise<void> {
        // This would be called by the main service
        // Emitting event for the main class to handle
    }

    /**
     * Get next scheduled step for a cart
     */
    getNextStep(cart: AbandonedCart, sequenceId: string = 'default'): RecoveryStep | null {
        const sequence = this.sequences.get(sequenceId);
        if (!sequence) return null;

        const completedSteps = cart.recoveryAttempts.length;
        if (completedSteps >= sequence.steps.length) return null;

        return sequence.steps[completedSteps] || null;
    }

    /**
     * Add or update a sequence
     */
    addSequence(sequence: RecoverySequence): void {
        this.sequences.set(sequence.id, sequence);
    }

    /**
     * Get sequence by ID
     */
    getSequence(sequenceId: string): RecoverySequence | undefined {
        return this.sequences.get(sequenceId);
    }

    /**
     * Get optimal timing based on customer timezone
     */
    getOptimalSendTime(
        scheduledTime: Date,
        customerTimezone?: string
    ): Date {
        if (!customerTimezone) return scheduledTime;

        // Avoid sending between 10PM and 8AM local time
        const hour = scheduledTime.getHours();
        if (hour >= 22 || hour < 8) {
            const nextMorning = new Date(scheduledTime);
            nextMorning.setHours(9, 0, 0, 0);
            if (hour >= 22) {
                nextMorning.setDate(nextMorning.getDate() + 1);
            }
            return nextMorning;
        }

        return scheduledTime;
    }
}

// ============================================================================
// Visual Cart Renderer
// ============================================================================

export class VisualCartRenderer {
    /**
     * Generate visual representation of abandoned cart
     */
    async renderCart(cart: AbandonedCart): Promise<VisualCartImage> {
        // Generate SVG representation of cart items
        const itemsHtml = cart.items.map((item, index) => `
            <g transform="translate(0, ${index * 100})">
                <rect x="20" y="20" width="360" height="80" fill="#f5f5f5" rx="8"/>
                <text x="40" y="50" font-size="16" font-weight="bold">${this.escapeHtml(item.name)}</text>
                <text x="40" y="75" font-size="14" fill="#666">Qty: ${item.quantity} × ${cart.currency} ${item.price.toFixed(2)}</text>
                <text x="340" y="60" font-size="16" font-weight="bold" text-anchor="end">
                    ${cart.currency} ${(item.price * item.quantity).toFixed(2)}
                </text>
            </g>
        `).join('');

        const totalHeight = Math.max(200, cart.items.length * 100 + 120);

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="${totalHeight}" viewBox="0 0 400 ${totalHeight}">
                <defs>
                    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#4f46e5"/>
                        <stop offset="100%" style="stop-color:#7c3aed"/>
                    </linearGradient>
                </defs>

                <!-- Header -->
                <rect width="400" height="60" fill="url(#headerGrad)"/>
                <text x="200" y="38" text-anchor="middle" fill="white" font-size="20" font-weight="bold">
                    Your Cart is Waiting!
                </text>

                <!-- Items -->
                <g transform="translate(0, 60)">
                    ${itemsHtml}
                </g>

                <!-- Total -->
                <rect x="20" y="${totalHeight - 60}" width="360" height="50" fill="#4f46e5" rx="8"/>
                <text x="40" y="${totalHeight - 28}" fill="white" font-size="18">Total:</text>
                <text x="360" y="${totalHeight - 28}" fill="white" font-size="20" font-weight="bold" text-anchor="end">
                    ${cart.currency} ${cart.subtotal.toFixed(2)}
                </text>
            </svg>
        `;

        const base64 = Buffer.from(svg).toString('base64');

        return {
            url: `data:image/svg+xml;base64,${base64}`,
            base64,
            width: 400,
            height: totalHeight,
            format: 'png'
        };
    }

    /**
     * Generate visual with discount badge
     */
    async renderCartWithDiscount(
        cart: AbandonedCart,
        discount: DiscountOffer
    ): Promise<VisualCartImage> {
        const discountText = discount.type === 'percentage'
            ? `${discount.value}% OFF`
            : discount.type === 'free_shipping'
            ? 'FREE SHIPPING'
            : `${cart.currency} ${discount.value} OFF`;

        const discountedTotal = this.calculateDiscountedTotal(cart, discount);

        const itemsHtml = cart.items.map((item, index) => `
            <g transform="translate(0, ${index * 100})">
                <rect x="20" y="20" width="360" height="80" fill="#f5f5f5" rx="8"/>
                <text x="40" y="50" font-size="16" font-weight="bold">${this.escapeHtml(item.name)}</text>
                <text x="40" y="75" font-size="14" fill="#666">Qty: ${item.quantity}</text>
                <text x="340" y="60" font-size="16" text-anchor="end">
                    ${cart.currency} ${(item.price * item.quantity).toFixed(2)}
                </text>
            </g>
        `).join('');

        const totalHeight = Math.max(280, cart.items.length * 100 + 200);

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="${totalHeight}" viewBox="0 0 400 ${totalHeight}">
                <defs>
                    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#4f46e5"/>
                        <stop offset="100%" style="stop-color:#7c3aed"/>
                    </linearGradient>
                </defs>

                <!-- Header with discount badge -->
                <rect width="400" height="60" fill="url(#headerGrad)"/>
                <text x="200" y="38" text-anchor="middle" fill="white" font-size="20" font-weight="bold">
                    Your Cart is Waiting!
                </text>

                <!-- Discount Badge -->
                <g transform="translate(280, 10)">
                    <rect width="110" height="40" fill="#ef4444" rx="20"/>
                    <text x="55" y="26" text-anchor="middle" fill="white" font-size="14" font-weight="bold">
                        ${discountText}
                    </text>
                </g>

                <!-- Items -->
                <g transform="translate(0, 60)">
                    ${itemsHtml}
                </g>

                <!-- Original Total (strikethrough) -->
                <text x="40" y="${totalHeight - 80}" fill="#999" font-size="14">
                    <tspan text-decoration="line-through">Original: ${cart.currency} ${cart.subtotal.toFixed(2)}</tspan>
                </text>

                <!-- Discounted Total -->
                <rect x="20" y="${totalHeight - 60}" width="360" height="50" fill="#22c55e" rx="8"/>
                <text x="40" y="${totalHeight - 28}" fill="white" font-size="18">New Total:</text>
                <text x="360" y="${totalHeight - 28}" fill="white" font-size="20" font-weight="bold" text-anchor="end">
                    ${cart.currency} ${discountedTotal.toFixed(2)}
                </text>
            </svg>
        `;

        const base64 = Buffer.from(svg).toString('base64');

        return {
            url: `data:image/svg+xml;base64,${base64}`,
            base64,
            width: 400,
            height: totalHeight,
            format: 'png'
        };
    }

    private calculateDiscountedTotal(cart: AbandonedCart, discount: DiscountOffer): number {
        switch (discount.type) {
            case 'percentage':
                const percentDiscount = cart.subtotal * (discount.value / 100);
                const cappedDiscount = discount.maxDiscount
                    ? Math.min(percentDiscount, discount.maxDiscount)
                    : percentDiscount;
                return cart.subtotal - cappedDiscount;
            case 'fixed':
                return Math.max(0, cart.subtotal - discount.value);
            case 'free_shipping':
                return cart.subtotal; // Shipping handled separately
            default:
                return cart.subtotal;
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// ============================================================================
// Discount Engine
// ============================================================================

export class DiscountEngine {
    private baseDiscountPercentage: number = 10;
    private maxDiscountPercentage: number = 30;

    /**
     * Calculate personalized discount based on cart and customer history
     */
    async calculateDiscount(
        cart: AbandonedCart,
        customerHistory: CustomerHistory,
        step: RecoveryStep
    ): Promise<DiscountOffer | null> {
        if (!step.discountStrategy || step.discountStrategy.type === 'none') {
            return null;
        }

        let discountValue: number;

        switch (step.discountStrategy.type) {
            case 'fixed':
                discountValue = step.discountStrategy.baseValue || this.baseDiscountPercentage;
                break;

            case 'escalating':
                const base = step.discountStrategy.baseValue || this.baseDiscountPercentage;
                const rate = step.discountStrategy.escalationRate || 5;
                const max = step.discountStrategy.maxValue || this.maxDiscountPercentage;
                discountValue = Math.min(base + (step.stepNumber - 1) * rate, max);
                break;

            case 'dynamic':
                discountValue = this.calculateDynamicDiscount(cart, customerHistory);
                break;

            default:
                return null;
        }

        const code = this.generateDiscountCode(cart.id);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry

        return {
            type: 'percentage',
            value: discountValue,
            code,
            expiresAt,
            minPurchase: cart.subtotal * 0.5 // Minimum 50% of cart value
        };
    }

    /**
     * Calculate dynamic discount based on multiple factors
     */
    private calculateDynamicDiscount(
        cart: AbandonedCart,
        customerHistory: CustomerHistory
    ): number {
        let discount = this.baseDiscountPercentage;

        // Higher cart value = higher discount potential
        if (cart.subtotal > 200) {
            discount += 5;
        }

        // New customer = higher discount to convert
        if (customerHistory.totalPurchases === 0) {
            discount += 5;
        }

        // Loyal customer = smaller discount needed
        if (customerHistory.totalPurchases > 5) {
            discount -= 3;
        }

        // Previous recovery failures = higher discount
        if (customerHistory.abandonedCarts > customerHistory.recoveredCarts) {
            discount += 3;
        }

        return Math.min(Math.max(discount, 5), this.maxDiscountPercentage);
    }

    private generateDiscountCode(cartId: string): string {
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `SAVE${random}`;
    }

    /**
     * Validate a discount code
     */
    async validateDiscount(
        code: string,
        cartValue: number,
        discount: DiscountOffer
    ): Promise<{ valid: boolean; reason?: string }> {
        if (code !== discount.code) {
            return { valid: false, reason: 'Invalid code' };
        }

        if (discount.expiresAt && new Date() > discount.expiresAt) {
            return { valid: false, reason: 'Code expired' };
        }

        if (discount.minPurchase && cartValue < discount.minPurchase) {
            return { valid: false, reason: `Minimum purchase of ${discount.minPurchase} required` };
        }

        return { valid: true };
    }
}

// ============================================================================
// Message Template Builder
// ============================================================================

export class MessageTemplateBuilder {
    private templates: Map<string, (data: TemplateData) => string> = new Map();

    constructor() {
        this.initializeTemplates();
    }

    private initializeTemplates(): void {
        this.templates.set('reminder_gentle', (data) => `
Hi ${data.customerName || 'there'}!

You left some great items in your cart. They're still waiting for you!

${data.itemsSummary}

Ready to complete your order? Tap here to continue shopping.
        `.trim());

        this.templates.set('reminder_with_discount', (data) => `
Hey ${data.customerName || 'there'}!

Your cart misses you! We noticed you left some items behind.

${data.itemsSummary}

Good news - use code ${data.discountCode} for ${data.discountValue}% off your order!

This offer expires in 48 hours. Don't miss out!
        `.trim());

        this.templates.set('last_chance', (data) => `
${data.customerName || 'Hi'}! Last chance!

Your cart items are about to expire:

${data.itemsSummary}

Use code ${data.discountCode} for ${data.discountValue}% off - expires tonight!

Complete your order now before it's too late.
        `.trim());

        this.templates.set('social_proof', (data) => `
Hi ${data.customerName}!

Did you know? ${data.socialProofText}

Your cart is still saved:
${data.itemsSummary}

Join thousands of happy customers - complete your order today!
        `.trim());

        this.templates.set('urgency_stock', (data) => `
Heads up ${data.customerName}!

Some items in your cart are running low on stock:
${data.lowStockItems}

Don't miss out - complete your order before they're gone!
        `.trim());
    }

    /**
     * Build message from template
     */
    build(
        templateId: string,
        cart: AbandonedCart,
        discount?: DiscountOffer,
        extra?: Record<string, any>
    ): string {
        const template = this.templates.get(templateId);
        if (!template) {
            return this.buildDefault(cart, discount);
        }

        const itemsSummary = cart.items
            .map(item => `• ${item.name} (x${item.quantity}) - ${cart.currency} ${(item.price * item.quantity).toFixed(2)}`)
            .join('\n');

        const data: TemplateData = {
            customerName: cart.customerName,
            itemsSummary,
            total: `${cart.currency} ${cart.subtotal.toFixed(2)}`,
            itemCount: cart.items.length,
            discountCode: discount?.code,
            discountValue: discount?.value,
            ...extra
        };

        return template(data);
    }

    private buildDefault(cart: AbandonedCart, discount?: DiscountOffer): string {
        let message = `Hi! You have ${cart.items.length} item(s) in your cart worth ${cart.currency} ${cart.subtotal.toFixed(2)}.`;

        if (discount) {
            message += ` Use code ${discount.code} for ${discount.value}% off!`;
        }

        message += ' Complete your order now!';
        return message;
    }

    /**
     * Add custom template
     */
    addTemplate(id: string, builder: (data: TemplateData) => string): void {
        this.templates.set(id, builder);
    }

    /**
     * Adapt message for specific platform
     */
    adaptForPlatform(message: string, platform: string): string {
        switch (platform) {
            case 'sms':
                // SMS: Keep under 160 chars
                if (message.length > 160) {
                    return message.substring(0, 157) + '...';
                }
                return message;

            case 'whatsapp':
                // WhatsApp supports rich formatting
                return message
                    .replace(/\*\*(.*?)\*\*/g, '*$1*')  // Bold
                    .replace(/__(.*?)__/g, '_$1_');     // Italic

            case 'email':
                // Email can be longer and include HTML
                return message;

            default:
                return message;
        }
    }
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

// ============================================================================
// Analytics Tracker
// ============================================================================

export class AnalyticsTracker extends EventEmitter {
    private metrics: RecoveryMetrics = {
        totalAbandoned: 0,
        totalRecovered: 0,
        recoveryRate: 0,
        revenueRecovered: 0,
        averageRecoveryTime: 0,
        bestPerformingStep: 1,
        bestPerformingChannel: 'email',
        discountUsageRate: 0
    };

    private stepPerformance: Map<number, { sent: number; converted: number }> = new Map();
    private channelPerformance: Map<string, { sent: number; converted: number }> = new Map();
    private recoveryTimes: number[] = [];
    private discountsUsed: number = 0;
    private discountsOffered: number = 0;

    /**
     * Track cart abandonment
     */
    trackAbandonment(cart: AbandonedCart): void {
        this.metrics.totalAbandoned++;
        this.updateRecoveryRate();
        this.emit('metrics:updated', this.metrics);
    }

    /**
     * Track recovery attempt sent
     */
    trackAttemptSent(
        attempt: RecoveryAttempt
    ): void {
        // Track step performance
        const stepStats = this.stepPerformance.get(attempt.sequenceStep) || { sent: 0, converted: 0 };
        stepStats.sent++;
        this.stepPerformance.set(attempt.sequenceStep, stepStats);

        // Track channel performance
        const channelStats = this.channelPerformance.get(attempt.channel) || { sent: 0, converted: 0 };
        channelStats.sent++;
        this.channelPerformance.set(attempt.channel, channelStats);

        // Track discount offers
        if (attempt.discountOffered) {
            this.discountsOffered++;
        }
    }

    /**
     * Track successful recovery
     */
    trackRecovery(
        cart: AbandonedCart,
        purchaseValue: number,
        recoveringAttempt: RecoveryAttempt
    ): void {
        this.metrics.totalRecovered++;
        this.metrics.revenueRecovered += purchaseValue;

        // Track recovery time
        const recoveryTime = Date.now() - cart.abandonedAt.getTime();
        this.recoveryTimes.push(recoveryTime);
        this.metrics.averageRecoveryTime = this.calculateAverageRecoveryTime();

        // Update step performance
        const stepStats = this.stepPerformance.get(recoveringAttempt.sequenceStep);
        if (stepStats) {
            stepStats.converted++;
        }

        // Update channel performance
        const channelStats = this.channelPerformance.get(recoveringAttempt.channel);
        if (channelStats) {
            channelStats.converted++;
        }

        // Track discount usage
        if (recoveringAttempt.discountOffered) {
            this.discountsUsed++;
        }

        this.updateRecoveryRate();
        this.updateBestPerformers();
        this.updateDiscountUsageRate();

        this.emit('recovery:success', { cart, purchaseValue, metrics: this.metrics });
    }

    private updateRecoveryRate(): void {
        if (this.metrics.totalAbandoned > 0) {
            this.metrics.recoveryRate = this.metrics.totalRecovered / this.metrics.totalAbandoned;
        }
    }

    private calculateAverageRecoveryTime(): number {
        if (this.recoveryTimes.length === 0) return 0;
        const sum = this.recoveryTimes.reduce((a, b) => a + b, 0);
        return sum / this.recoveryTimes.length;
    }

    private updateBestPerformers(): void {
        // Find best performing step
        let bestStep = 1;
        let bestStepRate = 0;
        for (const [step, stats] of this.stepPerformance) {
            const rate = stats.sent > 0 ? stats.converted / stats.sent : 0;
            if (rate > bestStepRate) {
                bestStepRate = rate;
                bestStep = step;
            }
        }
        this.metrics.bestPerformingStep = bestStep;

        // Find best performing channel
        let bestChannel = 'email';
        let bestChannelRate = 0;
        for (const [channel, stats] of this.channelPerformance) {
            const rate = stats.sent > 0 ? stats.converted / stats.sent : 0;
            if (rate > bestChannelRate) {
                bestChannelRate = rate;
                bestChannel = channel;
            }
        }
        this.metrics.bestPerformingChannel = bestChannel;
    }

    private updateDiscountUsageRate(): void {
        if (this.discountsOffered > 0) {
            this.metrics.discountUsageRate = this.discountsUsed / this.discountsOffered;
        }
    }

    /**
     * Get current metrics
     */
    getMetrics(): RecoveryMetrics {
        return { ...this.metrics };
    }

    /**
     * Get step-by-step analytics
     */
    getStepAnalytics(): Map<number, { sent: number; converted: number; rate: number }> {
        const result = new Map();
        for (const [step, stats] of this.stepPerformance) {
            result.set(step, {
                ...stats,
                rate: stats.sent > 0 ? stats.converted / stats.sent : 0
            });
        }
        return result;
    }

    /**
     * Get channel analytics
     */
    getChannelAnalytics(): Map<string, { sent: number; converted: number; rate: number }> {
        const result = new Map();
        for (const [channel, stats] of this.channelPerformance) {
            result.set(channel, {
                ...stats,
                rate: stats.sent > 0 ? stats.converted / stats.sent : 0
            });
        }
        return result;
    }
}

// ============================================================================
// Main Abandoned Cart Recovery Class
// ============================================================================

export class AbandonedCartRecovery extends EventEmitter {
    private cartTracker: CartTracker;
    private recoverySequencer: RecoverySequencer;
    private visualRenderer: VisualCartRenderer;
    private discountEngine: DiscountEngine;
    private templateBuilder: MessageTemplateBuilder;
    private analyticsTracker: AnalyticsTracker;

    private customerHistories: Map<string, CustomerHistory> = new Map();
    private checkInterval?: NodeJS.Timeout;

    constructor(options: {
        abandonmentThresholdMinutes?: number;
        checkIntervalMinutes?: number;
    } = {}) {
        super();

        this.cartTracker = new CartTracker(options.abandonmentThresholdMinutes || 30);
        this.recoverySequencer = new RecoverySequencer();
        this.visualRenderer = new VisualCartRenderer();
        this.discountEngine = new DiscountEngine();
        this.templateBuilder = new MessageTemplateBuilder();
        this.analyticsTracker = new AnalyticsTracker();

        this.setupEventHandlers();

        // Start periodic abandonment check
        const checkInterval = (options.checkIntervalMinutes || 5) * 60 * 1000;
        this.checkInterval = setInterval(() => {
            this.checkForAbandonedCarts();
        }, checkInterval);
    }

    private setupEventHandlers(): void {
        this.cartTracker.on('cart:abandoned', async (cart: AbandonedCart) => {
            this.analyticsTracker.trackAbandonment(cart);
            await this.startRecovery(cart);
        });

        this.cartTracker.on('cart:recovered', async (data) => {
            const { cart, purchaseValue } = data;
            await this.handleRecovery(cart, purchaseValue);
        });

        this.analyticsTracker.on('recovery:success', (data) => {
            this.emit('recovery:success', data);
        });
    }

    /**
     * Track cart abandonment via webhook
     */
    async trackAbandonment(event: {
        type: 'cart.created' | 'cart.updated' | 'checkout.started' | 'checkout.completed' | 'cart.abandoned';
        data: any;
    }): Promise<void> {
        await this.cartTracker.handleWebhook(event);
    }

    /**
     * Manually trigger recovery for a cart
     */
    async triggerRecovery(cartId: string): Promise<void> {
        const cart = this.cartTracker.getCart(cartId);
        if (!cart) {
            throw new Error(`Cart ${cartId} not found`);
        }

        await this.startRecovery(cart);
    }

    /**
     * Start recovery sequence
     */
    private async startRecovery(cart: AbandonedCart): Promise<void> {
        await this.recoverySequencer.startSequence(cart);
        this.emit('recovery:started', { cartId: cart.id });

        // Execute first step immediately or wait based on sequence
        const nextStep = this.recoverySequencer.getNextStep(cart);
        if (nextStep) {
            await this.executeRecoveryStep(cart, nextStep);
        }
    }

    /**
     * Execute a recovery step
     */
    private async executeRecoveryStep(
        cart: AbandonedCart,
        step: RecoveryStep
    ): Promise<RecoveryAttempt> {
        // Get customer history
        const history = this.getOrCreateCustomerHistory(cart.customerId);

        // Calculate discount if applicable
        const discount = await this.discountEngine.calculateDiscount(cart, history, step);

        // Build message
        const message = this.templateBuilder.build(
            step.messageTemplate,
            cart,
            discount || undefined
        );

        // Adapt for platform
        const adaptedMessage = this.templateBuilder.adaptForPlatform(message, step.channel);

        // Generate visual if needed
        let visual: VisualCartImage | undefined;
        if (step.includeVisual) {
            visual = discount
                ? await this.visualRenderer.renderCartWithDiscount(cart, discount)
                : await this.visualRenderer.renderCart(cart);
        }

        // Create recovery attempt record
        const attempt: RecoveryAttempt = {
            id: `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            cartId: cart.id,
            sequenceStep: step.stepNumber,
            sentAt: new Date(),
            channel: step.channel,
            messageType: step.messageTemplate,
            discountOffered: discount || undefined,
            opened: false,
            clicked: false,
            converted: false
        };

        cart.recoveryAttempts.push(attempt);

        // Track attempt
        this.analyticsTracker.trackAttemptSent(attempt);

        // Emit event for bridge system to send message
        this.emit('recovery:send', {
            cart,
            attempt,
            message: adaptedMessage,
            visual,
            channel: step.channel
        });

        return attempt;
    }

    /**
     * Handle successful recovery
     */
    private async handleRecovery(cart: AbandonedCart, purchaseValue: number): Promise<void> {
        // Find the recovering attempt
        const recoveringAttempt = cart.recoveryAttempts
            .filter(a => !a.converted)
            .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];

        if (recoveringAttempt) {
            recoveringAttempt.converted = true;
            this.analyticsTracker.trackRecovery(cart, purchaseValue, recoveringAttempt);
        }

        // Update customer history
        const history = this.getOrCreateCustomerHistory(cart.customerId);
        history.recoveredCarts++;
        history.totalPurchases++;
        history.totalSpent += purchaseValue;
        history.averageOrderValue = history.totalSpent / history.totalPurchases;
        history.lastPurchaseDate = new Date();

        // Cancel remaining recovery steps
        await this.recoverySequencer.cancelSequence(cart.id);
    }

    /**
     * Check for abandoned carts periodically
     */
    private async checkForAbandonedCarts(): Promise<void> {
        const abandoned = await this.cartTracker.checkForAbandonment();

        for (const cart of abandoned) {
            this.emit('cart:abandoned', cart);
        }
    }

    /**
     * Get or create customer history
     */
    private getOrCreateCustomerHistory(customerId: string): CustomerHistory {
        let history = this.customerHistories.get(customerId);
        if (!history) {
            history = {
                customerId,
                totalPurchases: 0,
                totalSpent: 0,
                averageOrderValue: 0,
                abandonedCarts: 0,
                recoveredCarts: 0
            };
            this.customerHistories.set(customerId, history);
        }
        return history;
    }

    /**
     * Update customer history
     */
    updateCustomerHistory(customerId: string, history: Partial<CustomerHistory>): void {
        const existing = this.getOrCreateCustomerHistory(customerId);
        Object.assign(existing, history);
    }

    /**
     * Get recovery metrics
     */
    getMetrics(): RecoveryMetrics {
        return this.analyticsTracker.getMetrics();
    }

    /**
     * Get step analytics
     */
    getStepAnalytics() {
        return this.analyticsTracker.getStepAnalytics();
    }

    /**
     * Get channel analytics
     */
    getChannelAnalytics() {
        return this.analyticsTracker.getChannelAnalytics();
    }

    /**
     * Add custom recovery sequence
     */
    addSequence(sequence: RecoverySequence): void {
        this.recoverySequencer.addSequence(sequence);
    }

    /**
     * Add custom message template
     */
    addTemplate(id: string, builder: (data: TemplateData) => string): void {
        this.templateBuilder.addTemplate(id, builder);
    }

    /**
     * Stop recovery service
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

// Export factory function
export function createAbandonedCartRecovery(options?: {
    abandonmentThresholdMinutes?: number;
    checkIntervalMinutes?: number;
}): AbandonedCartRecovery {
    return new AbandonedCartRecovery(options);
}
