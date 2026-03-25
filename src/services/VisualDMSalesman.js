/**
 * Visual DM Salesman Service
 * AI-powered sales assistant that engages customers via direct messages
 * with visual product presentations and intelligent objection handling
 */
import { EventEmitter } from 'events';
// ============================================================================
// Intent Analyzer
// ============================================================================
export class IntentAnalyzer {
    buyingKeywords = [
        'buy', 'purchase', 'order', 'want', 'need', 'looking for',
        'interested in', 'how much', 'price', 'cost', 'available',
        'in stock', 'shipping', 'deliver', 'get it', 'add to cart'
    ];
    comparisonKeywords = [
        'compare', 'vs', 'versus', 'difference', 'better', 'best',
        'which one', 'recommend', 'suggestion', 'alternative'
    ];
    urgencyKeywords = [
        'urgent', 'asap', 'today', 'now', 'immediately', 'quick',
        'fast', 'rush', 'deadline', 'gift', 'birthday', 'anniversary'
    ];
    objectionKeywords = [
        'expensive', 'too much', 'cheaper', 'budget', 'afford',
        'not sure', 'think about', 'later', 'maybe', 'competitor'
    ];
    async analyze(conversation) {
        const recentMessages = conversation.messages.slice(-10);
        const customerMessages = recentMessages.filter(m => m.role === 'customer');
        const signals = [];
        let totalConfidence = 0;
        for (const message of customerMessages) {
            const content = message.content.toLowerCase();
            // Check buying keywords
            for (const keyword of this.buyingKeywords) {
                if (content.includes(keyword)) {
                    signals.push({
                        type: 'keyword',
                        text: keyword,
                        strength: 0.7
                    });
                    totalConfidence += 0.15;
                }
            }
            // Check comparison keywords
            for (const keyword of this.comparisonKeywords) {
                if (content.includes(keyword)) {
                    signals.push({
                        type: 'comparison',
                        text: keyword,
                        strength: 0.6
                    });
                    totalConfidence += 0.1;
                }
            }
            // Check urgency keywords
            for (const keyword of this.urgencyKeywords) {
                if (content.includes(keyword)) {
                    signals.push({
                        type: 'urgency',
                        text: keyword,
                        strength: 0.8
                    });
                    totalConfidence += 0.2;
                }
            }
            // Check objection keywords
            for (const keyword of this.objectionKeywords) {
                if (content.includes(keyword)) {
                    signals.push({
                        type: 'objection',
                        text: keyword,
                        strength: 0.4
                    });
                    totalConfidence -= 0.1;
                }
            }
            // Check for price inquiries
            if (/how much|price|cost|\$|\d+/.test(content)) {
                signals.push({
                    type: 'price_inquiry',
                    text: 'price inquiry detected',
                    strength: 0.65
                });
                totalConfidence += 0.12;
            }
            // Check for questions
            if (content.includes('?')) {
                signals.push({
                    type: 'question',
                    text: 'question asked',
                    strength: 0.5
                });
                totalConfidence += 0.08;
            }
        }
        const confidence = Math.min(1, Math.max(0, totalConfidence));
        const stage = this.determineStage(confidence, signals);
        return {
            detected: confidence > 0.3,
            confidence,
            signals,
            suggestedProducts: [],
            estimatedValue: 0,
            stage
        };
    }
    determineStage(confidence, signals) {
        const hasUrgency = signals.some(s => s.type === 'urgency');
        const hasPriceInquiry = signals.some(s => s.type === 'price_inquiry');
        const hasObjection = signals.some(s => s.type === 'objection');
        if (confidence >= 0.8 && hasUrgency && hasPriceInquiry) {
            return 'intent';
        }
        else if (confidence >= 0.6 && hasPriceInquiry) {
            return 'consideration';
        }
        else if (confidence >= 0.4 || hasObjection) {
            return 'interest';
        }
        else {
            return 'awareness';
        }
    }
}
// ============================================================================
// Product Matcher
// ============================================================================
export class ProductMatcher {
    async match(conversation, catalog, intent) {
        const keywords = this.extractKeywords(conversation);
        const matchedProducts = new Map();
        for (const product of catalog.products) {
            let score = 0;
            // Match by keywords in product name/description
            for (const keyword of keywords) {
                if (product.name.toLowerCase().includes(keyword)) {
                    score += 0.4;
                }
                if (product.description.toLowerCase().includes(keyword)) {
                    score += 0.2;
                }
                if (product.tags.some(t => t.toLowerCase().includes(keyword))) {
                    score += 0.3;
                }
            }
            // Boost in-stock products
            if (product.inStock) {
                score += 0.1;
            }
            // Boost based on intent confidence
            score *= (1 + intent.confidence * 0.5);
            if (score > 0) {
                matchedProducts.set(product.id, { product, score });
            }
        }
        // Sort by score and return top matches
        return Array.from(matchedProducts.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(m => m.product);
    }
    extractKeywords(conversation) {
        const customerMessages = conversation.messages
            .filter(m => m.role === 'customer')
            .map(m => m.content.toLowerCase());
        const allText = customerMessages.join(' ');
        // Simple keyword extraction (remove common words)
        const stopWords = new Set([
            'i', 'me', 'my', 'we', 'you', 'your', 'the', 'a', 'an', 'is', 'are',
            'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'can', 'this', 'that', 'these', 'those', 'it', 'its', 'of', 'for',
            'to', 'from', 'in', 'on', 'at', 'by', 'with', 'about', 'into'
        ]);
        const words = allText
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
        return [...new Set(words)];
    }
}
// ============================================================================
// Visual Presenter
// ============================================================================
export class VisualPresenter {
    async createPresentation(products, type = 'carousel', options = {}) {
        if (products.length === 0) {
            return {
                type: 'single',
                products: [],
                title: 'No products found',
                description: 'Please try a different search'
            };
        }
        if (products.length === 1) {
            return this.createSinglePresentation(products[0], options);
        }
        switch (type) {
            case 'comparison':
                return this.createComparisonPresentation(products.slice(0, 3), options);
            case 'bundle':
                return this.createBundlePresentation(products, options);
            default:
                return this.createCarouselPresentation(products, options);
        }
    }
    createSinglePresentation(product, options) {
        const finalPrice = options.discount
            ? this.applyDiscount(product.price, options.discount)
            : product.price;
        return {
            type: 'single',
            products: [product],
            title: options.title || product.name,
            description: `${product.description}\n\n${product.currency} ${finalPrice.toFixed(2)}`,
            callToAction: 'Buy Now',
            discount: options.discount
        };
    }
    createCarouselPresentation(products, options) {
        return {
            type: 'carousel',
            products,
            title: options.title || `Check out these ${products.length} great options`,
            description: 'Swipe to see more',
            callToAction: 'View Details',
            discount: options.discount
        };
    }
    createComparisonPresentation(products, options) {
        const comparison = products.map(p => `${p.name}: ${p.currency} ${p.price.toFixed(2)}`).join(' vs ');
        return {
            type: 'comparison',
            products,
            title: options.title || 'Compare Options',
            description: comparison,
            callToAction: 'Choose Best Option',
            discount: options.discount
        };
    }
    createBundlePresentation(products, options) {
        const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
        const bundleDiscount = 0.15; // 15% bundle discount
        const bundlePrice = totalPrice * (1 - bundleDiscount);
        return {
            type: 'bundle',
            products,
            title: options.title || 'Special Bundle Deal',
            description: `Get all ${products.length} items for ${products[0].currency} ${bundlePrice.toFixed(2)} (Save ${(bundleDiscount * 100).toFixed(0)}%)`,
            callToAction: 'Get Bundle',
            discount: {
                type: 'percentage',
                value: bundleDiscount * 100
            }
        };
    }
    applyDiscount(price, discount) {
        switch (discount.type) {
            case 'percentage':
                return price * (1 - discount.value / 100);
            case 'fixed':
                return Math.max(0, price - discount.value);
            default:
                return price;
        }
    }
    async generateCarouselImage(products) {
        // Placeholder - would integrate with image generation service
        // Returns base64 or URL of generated carousel image
        return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
                <rect width="100%" height="100%" fill="#f0f0f0"/>
                <text x="400" y="200" text-anchor="middle" font-size="24">
                    Product Carousel: ${products.map(p => p.name).join(', ')}
                </text>
            </svg>`).toString('base64')}`;
    }
}
// ============================================================================
// Objection Handler
// ============================================================================
export class ObjectionHandler {
    objectionResponses = new Map([
        ['price', [
                {
                    objectionType: 'price',
                    response: "I understand price is important. Let me show you our payment plan options that can make this more manageable.",
                    followUp: "We also have a satisfaction guarantee, so you can try it risk-free."
                },
                {
                    objectionType: 'price',
                    response: "Great question about the price! When you consider the quality and how long it will last, it's actually very cost-effective.",
                    followUp: "Would you like me to show you a comparison with similar products?"
                }
            ]],
        ['timing', [
                {
                    objectionType: 'timing',
                    response: "No problem! I can save your selection so you can come back anytime. Would you like me to send you a reminder?",
                    followUp: "Is there anything specific holding you back that I could help with?"
                }
            ]],
        ['competitor', [
                {
                    objectionType: 'competitor',
                    response: "That's a great brand! Here's what makes us unique: [unique value proposition]. Would you like a side-by-side comparison?",
                    followUp: "Many of our customers switched from them and love the difference."
                }
            ]],
        ['quality', [
                {
                    objectionType: 'quality',
                    response: "Quality is our top priority! All our products come with a warranty and thousands of positive reviews.",
                    followUp: "Would you like to see some customer testimonials?"
                }
            ]],
        ['shipping', [
                {
                    objectionType: 'shipping',
                    response: "Great news! We offer fast shipping options. Standard delivery is 3-5 business days, and express is available.",
                    followUp: "For orders over $50, shipping is FREE!"
                }
            ]]
    ]);
    async handle(objection, conversation, products) {
        const objectionType = this.classifyObjection(objection);
        const responses = this.objectionResponses.get(objectionType) || [];
        if (responses.length === 0) {
            return {
                objectionType: 'general',
                response: "I appreciate you sharing that concern. Let me address it directly...",
                followUp: "Is there anything else you'd like to know?"
            };
        }
        // Select response based on conversation context
        const responseIndex = conversation.messages.length % responses.length;
        const response = responses[responseIndex];
        // Add alternative products if price objection
        if (objectionType === 'price' && products.length > 0) {
            const cheaperProducts = products
                .sort((a, b) => a.price - b.price)
                .slice(0, 2)
                .map(p => p.id);
            return {
                ...response,
                alternativeProducts: cheaperProducts
            };
        }
        return response;
    }
    classifyObjection(text) {
        const lower = text.toLowerCase();
        if (/expensive|price|cost|budget|afford|cheap/.test(lower)) {
            return 'price';
        }
        if (/later|think|time|busy|not now/.test(lower)) {
            return 'timing';
        }
        if (/competitor|other brand|amazon|elsewhere/.test(lower)) {
            return 'competitor';
        }
        if (/quality|last|durable|reliable/.test(lower)) {
            return 'quality';
        }
        if (/shipping|delivery|arrive/.test(lower)) {
            return 'shipping';
        }
        return 'general';
    }
}
// ============================================================================
// Conversation Tracker
// ============================================================================
export class ConversationTracker extends EventEmitter {
    conversations = new Map();
    metrics = new Map();
    async startConversation(customerId, customerName) {
        const conversation = {
            id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId,
            customerName,
            messages: [],
            startedAt: new Date(),
            lastActivityAt: new Date(),
            stage: 'awareness'
        };
        this.conversations.set(conversation.id, conversation);
        const metrics = {
            conversationId: conversation.id,
            customerId,
            startTime: new Date(),
            messagesCount: 0,
            productsViewed: [],
            productsRecommended: [],
            converted: false,
            objectionsCounted: 0,
            objectionsOvercome: 0
        };
        this.metrics.set(conversation.id, metrics);
        this.emit('conversation:started', conversation);
        return conversation;
    }
    async addMessage(conversationId, role, content, metadata) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role,
            content,
            timestamp: new Date(),
            metadata
        };
        conversation.messages.push(message);
        conversation.lastActivityAt = new Date();
        const metrics = this.metrics.get(conversationId);
        if (metrics) {
            metrics.messagesCount++;
        }
        this.emit('message:added', { conversation, message });
        return message;
    }
    async updateStage(conversationId, stage) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation)
            return;
        const previousStage = conversation.stage;
        conversation.stage = stage;
        this.emit('stage:changed', {
            conversationId,
            previousStage,
            newStage: stage
        });
        if (stage === 'closed_won') {
            const metrics = this.metrics.get(conversationId);
            if (metrics) {
                metrics.converted = true;
                metrics.endTime = new Date();
                metrics.timeToConversion =
                    metrics.endTime.getTime() - metrics.startTime.getTime();
            }
            this.emit('conversion:success', { conversationId, metrics });
        }
    }
    async trackProductView(conversationId, productId) {
        const metrics = this.metrics.get(conversationId);
        if (metrics && !metrics.productsViewed.includes(productId)) {
            metrics.productsViewed.push(productId);
        }
    }
    async trackProductRecommendation(conversationId, productIds) {
        const metrics = this.metrics.get(conversationId);
        if (metrics) {
            for (const id of productIds) {
                if (!metrics.productsRecommended.includes(id)) {
                    metrics.productsRecommended.push(id);
                }
            }
        }
    }
    async trackObjection(conversationId, overcome) {
        const metrics = this.metrics.get(conversationId);
        if (metrics) {
            metrics.objectionsCounted++;
            if (overcome) {
                metrics.objectionsOvercome++;
            }
        }
    }
    getConversation(conversationId) {
        return this.conversations.get(conversationId);
    }
    getMetrics(conversationId) {
        return this.metrics.get(conversationId);
    }
    getAllMetrics() {
        return Array.from(this.metrics.values());
    }
    getConversionRate() {
        const allMetrics = this.getAllMetrics();
        if (allMetrics.length === 0)
            return 0;
        const converted = allMetrics.filter(m => m.converted).length;
        return converted / allMetrics.length;
    }
}
// ============================================================================
// Personalization Engine
// ============================================================================
export class PersonalizationEngine {
    async analyzeCustomerStyle(conversation) {
        const customerMessages = conversation.messages.filter(m => m.role === 'customer');
        let totalLength = 0;
        let questionCount = 0;
        let emojiCount = 0;
        let formalIndicators = 0;
        for (const msg of customerMessages) {
            totalLength += msg.content.length;
            if (msg.content.includes('?'))
                questionCount++;
            if (/[\u{1F600}-\u{1F64F}]/u.test(msg.content))
                emojiCount++;
            if (/please|thank|appreciate|sincerely/i.test(msg.content))
                formalIndicators++;
        }
        const avgLength = customerMessages.length > 0
            ? totalLength / customerMessages.length
            : 0;
        return {
            communicationStyle: avgLength > 100 ? 'detailed' : 'concise',
            formality: formalIndicators > customerMessages.length / 2 ? 'formal' : 'casual',
            usesEmojis: emojiCount > 0,
            asksQuestions: questionCount > customerMessages.length / 2,
            responsePreference: avgLength > 50 ? 'detailed' : 'brief'
        };
    }
    async personalizeMessage(message, style) {
        let personalized = message;
        // Adjust formality
        if (style.formality === 'casual') {
            personalized = personalized
                .replace(/We would like to/g, "We'd love to")
                .replace(/Please feel free/g, "Feel free")
                .replace(/We appreciate/g, "Thanks for");
        }
        // Add emoji if customer uses them
        if (style.usesEmojis && !personalized.includes('!')) {
            personalized += ' ';
        }
        // Adjust length
        if (style.responsePreference === 'brief' && personalized.length > 200) {
            // Truncate to key points
            const sentences = personalized.split('. ');
            personalized = sentences.slice(0, 2).join('. ') + '.';
        }
        return personalized;
    }
}
// ============================================================================
// Main Visual DM Salesman Class
// ============================================================================
export class VisualDMSalesman extends EventEmitter {
    intentAnalyzer;
    productMatcher;
    visualPresenter;
    objectionHandler;
    conversationTracker;
    personalizationEngine;
    constructor() {
        super();
        this.intentAnalyzer = new IntentAnalyzer();
        this.productMatcher = new ProductMatcher();
        this.visualPresenter = new VisualPresenter();
        this.objectionHandler = new ObjectionHandler();
        this.conversationTracker = new ConversationTracker();
        this.personalizationEngine = new PersonalizationEngine();
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.conversationTracker.on('conversion:success', (data) => {
            this.emit('sale:completed', data);
        });
        this.conversationTracker.on('stage:changed', (data) => {
            this.emit('funnel:progress', data);
        });
    }
    /**
     * Main engagement method - processes customer message and generates response
     */
    async engage(conversation, catalog, latestMessage) {
        // Add latest message if provided
        if (latestMessage) {
            await this.conversationTracker.addMessage(conversation.id, 'customer', latestMessage);
        }
        // Analyze purchase intent
        const intent = await this.intentAnalyzer.analyze(conversation);
        // Match products based on conversation
        const matchedProducts = await this.productMatcher.match(conversation, catalog, intent);
        // Track product recommendations
        await this.conversationTracker.trackProductRecommendation(conversation.id, matchedProducts.map(p => p.id));
        // Update funnel stage
        await this.conversationTracker.updateStage(conversation.id, intent.stage);
        // Get customer style for personalization
        const customerStyle = await this.personalizationEngine.analyzeCustomerStyle(conversation);
        // Check for objections
        const hasObjection = intent.signals.some(s => s.type === 'objection');
        let objectionResponse;
        if (hasObjection && latestMessage) {
            objectionResponse = await this.objectionHandler.handle(latestMessage, conversation, matchedProducts);
            await this.conversationTracker.trackObjection(conversation.id, true);
        }
        // Generate response
        let response = await this.generateResponse(intent, matchedProducts, objectionResponse, customerStyle);
        // Create visual presentation if products matched
        let visualPresentation;
        if (matchedProducts.length > 0 && intent.confidence > 0.4) {
            const presentationType = matchedProducts.length === 1 ? 'single'
                : intent.signals.some(s => s.type === 'comparison') ? 'comparison'
                    : 'carousel';
            visualPresentation = await this.visualPresenter.createPresentation(matchedProducts, presentationType);
        }
        // Add agent response to conversation
        await this.conversationTracker.addMessage(conversation.id, 'agent', response, { intent, productsRecommended: matchedProducts.map(p => p.id) });
        // Get current metrics
        const metrics = this.conversationTracker.getMetrics(conversation.id);
        return {
            response,
            visualPresentation,
            intent,
            suggestedActions: this.getSuggestedActions(intent, matchedProducts),
            metrics: metrics || {}
        };
    }
    /**
     * Start a new sales conversation
     */
    async startConversation(customerId, customerName, initialMessage) {
        const conversation = await this.conversationTracker.startConversation(customerId, customerName);
        if (initialMessage) {
            await this.conversationTracker.addMessage(conversation.id, 'customer', initialMessage);
        }
        return conversation;
    }
    /**
     * Get conversation by ID
     */
    getConversation(conversationId) {
        return this.conversationTracker.getConversation(conversationId);
    }
    /**
     * Get overall conversion metrics
     */
    getConversionRate() {
        return this.conversationTracker.getConversionRate();
    }
    /**
     * Get all conversation metrics
     */
    getAllMetrics() {
        return this.conversationTracker.getAllMetrics();
    }
    async generateResponse(intent, products, objectionResponse, style) {
        let response;
        if (objectionResponse) {
            response = objectionResponse.response;
            if (objectionResponse.followUp) {
                response += '\n\n' + objectionResponse.followUp;
            }
        }
        else if (products.length > 0) {
            switch (intent.stage) {
                case 'awareness':
                    response = `Great to hear from you! I found some products that might interest you. ${products[0].name} is one of our most popular items.`;
                    break;
                case 'interest':
                    response = `Based on what you're looking for, I'd recommend checking out ${products.map(p => p.name).join(', ')}. Would you like more details on any of these?`;
                    break;
                case 'consideration':
                    response = `Excellent choice! ${products[0].name} is priced at ${products[0].currency} ${products[0].price.toFixed(2)}. It's ${products[0].inStock ? 'in stock and ready to ship' : 'currently on backorder'}. Want me to add it to your cart?`;
                    break;
                case 'intent':
                    response = `Perfect! Let me help you complete your purchase. ${products[0].name} at ${products[0].currency} ${products[0].price.toFixed(2)} is an excellent choice. Ready to proceed?`;
                    break;
                default:
                    response = "How can I help you find what you're looking for today?";
            }
        }
        else {
            response = "I'd be happy to help you find the perfect product. What are you looking for today?";
        }
        // Personalize the response
        return this.personalizationEngine.personalizeMessage(response, style);
    }
    getSuggestedActions(intent, products) {
        const actions = [];
        switch (intent.stage) {
            case 'awareness':
                actions.push('Show product catalog');
                actions.push('Ask about preferences');
                break;
            case 'interest':
                actions.push('Send product details');
                actions.push('Offer comparison');
                break;
            case 'consideration':
                actions.push('Provide pricing');
                actions.push('Offer discount');
                actions.push('Show reviews');
                break;
            case 'intent':
                actions.push('Send checkout link');
                actions.push('Apply discount code');
                actions.push('Offer express shipping');
                break;
        }
        if (products.length > 1) {
            actions.push('Create product comparison');
        }
        if (intent.signals.some(s => s.type === 'objection')) {
            actions.push('Address concerns');
            actions.push('Offer alternatives');
        }
        return actions;
    }
}
// Export default instance factory
export function createVisualDMSalesman() {
    return new VisualDMSalesman();
}
//# sourceMappingURL=VisualDMSalesman.js.map