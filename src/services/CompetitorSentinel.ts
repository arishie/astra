// @ts-nocheck
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { Database } from '../database/Database.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ChangeType = 'pricing' | 'product' | 'feature' | 'content' | 'design' | 'social';
export type ChangeSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SocialPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'youtube';
export type AlertChannel = 'email' | 'slack' | 'webhook' | 'in_app';

export interface CompetitorProfile {
    id: string;
    name: string;
    domain: string;
    urls: string[];
    pricingPageUrl?: string;
    productPageUrl?: string;
    socialProfiles: SocialProfile[];
    monitoringConfig: MonitoringConfig;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface SocialProfile {
    platform: SocialPlatform;
    handle: string;
    url: string;
    isActive: boolean;
}

export interface MonitoringConfig {
    screenshotInterval: number; // milliseconds
    domSnapshotInterval: number;
    priceCheckInterval: number;
    socialCheckInterval: number;
    enableVisualDiff: boolean;
    enablePriceTracking: boolean;
    enableProductTracking: boolean;
    enableSocialMonitoring: boolean;
    diffThreshold: number; // percentage difference to trigger alert (0-100)
}

export interface Snapshot {
    id: string;
    competitorId: string;
    url: string;
    type: 'screenshot' | 'dom' | 'html';
    data: string; // base64 for screenshots, HTML/DOM string otherwise
    hash: string;
    capturedAt: Date;
    metadata?: Record<string, any>;
}

export interface VisualDiff {
    id: string;
    competitorId: string;
    url: string;
    beforeSnapshotId: string;
    afterSnapshotId: string;
    diffPercentage: number;
    changedRegions: DiffRegion[];
    diffImageData?: string; // base64 encoded diff image
    analyzedAt: Date;
}

export interface DiffRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    changeType: 'added' | 'removed' | 'modified';
    significance: number; // 0-100
}

export interface PriceData {
    id: string;
    competitorId: string;
    productId?: string;
    productName: string;
    price: number;
    currency: string;
    tier?: string;
    billingCycle?: 'monthly' | 'yearly' | 'one_time';
    features?: string[];
    url: string;
    capturedAt: Date;
}

export interface PriceChange {
    id: string;
    competitorId: string;
    productName: string;
    previousPrice: number;
    newPrice: number;
    currency: string;
    changePercentage: number;
    changeType: 'increase' | 'decrease' | 'new' | 'removed';
    detectedAt: Date;
}

export interface ProductEntry {
    id: string;
    competitorId: string;
    productId: string;
    name: string;
    description?: string;
    category?: string;
    price?: number;
    currency?: string;
    features: string[];
    url: string;
    imageUrl?: string;
    isActive: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
}

export interface ProductChange {
    id: string;
    competitorId: string;
    productId: string;
    productName: string;
    changeType: 'added' | 'removed' | 'modified';
    changes?: Record<string, { before: any; after: any }>;
    detectedAt: Date;
}

export interface SocialPost {
    id: string;
    competitorId: string;
    platform: SocialPlatform;
    postId: string;
    content: string;
    url: string;
    engagement: {
        likes: number;
        comments: number;
        shares: number;
        views?: number;
    };
    postedAt: Date;
    capturedAt: Date;
    sentiment?: number;
    topics?: string[];
}

export interface SocialMetrics {
    competitorId: string;
    platform: SocialPlatform;
    followers: number;
    followersGrowth: number;
    postsThisWeek: number;
    avgEngagementRate: number;
    topPosts: SocialPost[];
    capturedAt: Date;
}

export interface CompetitorAlert {
    id: string;
    competitorId: string;
    competitorName: string;
    type: ChangeType;
    severity: ChangeSeverity;
    title: string;
    description: string;
    details?: Record<string, any>;
    url?: string;
    createdAt: Date;
    acknowledged: boolean;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
}

export interface IntelligenceReport {
    id: string;
    reportType: 'weekly' | 'monthly' | 'custom';
    periodStart: Date;
    periodEnd: Date;
    competitors: CompetitorSummary[];
    priceChanges: PriceChange[];
    productChanges: ProductChange[];
    visualChanges: VisualDiff[];
    socialHighlights: SocialPost[];
    keyInsights: string[];
    recommendations: string[];
    generatedAt: Date;
}

export interface CompetitorSummary {
    competitorId: string;
    competitorName: string;
    domain: string;
    totalChanges: number;
    changesByType: Record<ChangeType, number>;
    significantChanges: string[];
    socialGrowth: number;
    riskLevel: 'low' | 'medium' | 'high';
}

export interface ChangeRecord {
    id: string;
    competitorId: string;
    changeType: ChangeType;
    severity: ChangeSeverity;
    title: string;
    description: string;
    beforeState?: string;
    afterState?: string;
    metadata?: Record<string, any>;
    detectedAt: Date;
}

export interface CompetitorSentinelConfig {
    defaultMonitoringConfig: MonitoringConfig;
    screenshotService?: {
        type: 'puppeteer' | 'playwright' | 'browserless' | 'screenshotapi';
        apiKey?: string;
        endpoint?: string;
    };
    alertChannels: AlertChannelConfig[];
    reportSchedule: {
        weekly: boolean;
        dayOfWeek?: number; // 0-6, 0 = Sunday
        hourOfDay?: number; // 0-23
    };
    maxConcurrentMonitors: number;
    retryConfig: {
        maxRetries: number;
        retryDelayMs: number;
    };
}

export interface AlertChannelConfig {
    type: AlertChannel;
    enabled: boolean;
    minSeverity: ChangeSeverity;
    config: Record<string, any>;
}

// ============================================================================
// WebsiteMonitor - Takes periodic screenshots and DOM snapshots
// ============================================================================

export class WebsiteMonitor {
    private config: CompetitorSentinelConfig;
    private activeMonitors: Map<string, NodeJS.Timeout>;
    private snapshotCache: Map<string, Snapshot>;

    constructor(config: CompetitorSentinelConfig) {
        this.config = config;
        this.activeMonitors = new Map();
        this.snapshotCache = new Map();
    }

    /**
     * Start monitoring a competitor's website.
     */
    async startMonitoring(
        competitor: CompetitorProfile,
        onSnapshot: (snapshot: Snapshot) => void
    ): Promise<void> {
        const { urls, monitoringConfig } = competitor;

        for (const url of urls) {
            const monitorId = `${competitor.id}:${url}`;

            if (this.activeMonitors.has(monitorId)) {
                console.log(`[WebsiteMonitor] Already monitoring ${url}`);
                continue;
            }

            // Initial snapshot
            const snapshot = await this.captureSnapshot(competitor.id, url);
            if (snapshot) {
                onSnapshot(snapshot);
            }

            // Schedule periodic snapshots
            const interval = setInterval(async () => {
                try {
                    const newSnapshot = await this.captureSnapshot(competitor.id, url);
                    if (newSnapshot) {
                        onSnapshot(newSnapshot);
                    }
                } catch (error) {
                    console.error(`[WebsiteMonitor] Snapshot failed for ${url}:`, error);
                }
            }, monitoringConfig.screenshotInterval);

            this.activeMonitors.set(monitorId, interval);
            console.log(`[WebsiteMonitor] Started monitoring ${url}`);
        }
    }

    /**
     * Stop monitoring a competitor's website.
     */
    stopMonitoring(competitor: CompetitorProfile): void {
        for (const url of competitor.urls) {
            const monitorId = `${competitor.id}:${url}`;
            const interval = this.activeMonitors.get(monitorId);

            if (interval) {
                clearInterval(interval);
                this.activeMonitors.delete(monitorId);
                console.log(`[WebsiteMonitor] Stopped monitoring ${url}`);
            }
        }
    }

    /**
     * Capture a snapshot of a URL.
     */
    async captureSnapshot(competitorId: string, url: string): Promise<Snapshot | null> {
        try {
            // Capture both screenshot and DOM
            const [screenshotData, domData] = await Promise.all([
                this.captureScreenshot(url),
                this.captureDom(url),
            ]);

            const snapshot: Snapshot = {
                id: crypto.randomUUID(),
                competitorId,
                url,
                type: 'screenshot',
                data: screenshotData,
                hash: this.hashContent(screenshotData),
                capturedAt: new Date(),
                metadata: {
                    domHash: this.hashContent(domData),
                    domSize: domData.length,
                },
            };

            // Cache for quick comparison
            this.snapshotCache.set(`${competitorId}:${url}`, snapshot);

            return snapshot;
        } catch (error) {
            console.error(`[WebsiteMonitor] Capture failed for ${url}:`, error);
            return null;
        }
    }

    /**
     * Capture a screenshot of a URL.
     */
    private async captureScreenshot(url: string): Promise<string> {
        const screenshotService = this.config.screenshotService;

        if (screenshotService?.type === 'screenshotapi' && screenshotService.apiKey) {
            return this.captureWithScreenshotApi(url, screenshotService.apiKey);
        }

        if (screenshotService?.type === 'browserless' && screenshotService.endpoint) {
            return this.captureWithBrowserless(url, screenshotService.endpoint);
        }

        // Default: simulate screenshot capture
        return this.simulateScreenshotCapture(url);
    }

    /**
     * Capture screenshot using external API.
     */
    private async captureWithScreenshotApi(url: string, apiKey: string): Promise<string> {
        // In production, implement actual API call:
        // const response = await fetch(`https://api.screenshotapi.net/screenshot?url=${encodeURIComponent(url)}&token=${apiKey}`);
        // const data = await response.json();
        // return data.screenshot; // base64 encoded

        return this.simulateScreenshotCapture(url);
    }

    /**
     * Capture screenshot using Browserless.
     */
    private async captureWithBrowserless(url: string, endpoint: string): Promise<string> {
        // In production, implement Browserless API call:
        // const response = await fetch(`${endpoint}/screenshot`, {
        //     method: 'POST',
        //     body: JSON.stringify({ url, options: { fullPage: true } }),
        // });
        // return response.text(); // base64 encoded

        return this.simulateScreenshotCapture(url);
    }

    /**
     * Simulate screenshot capture for development.
     */
    private async simulateScreenshotCapture(url: string): Promise<string> {
        // Generate a deterministic "screenshot" based on URL and time
        const timestamp = Date.now();
        const content = `SCREENSHOT:${url}:${timestamp}`;
        return Buffer.from(content).toString('base64');
    }

    /**
     * Capture DOM content of a URL.
     */
    private async captureDom(url: string): Promise<string> {
        try {
            // In production, use Puppeteer/Playwright to get rendered DOM:
            // const browser = await puppeteer.launch();
            // const page = await browser.newPage();
            // await page.goto(url, { waitUntil: 'networkidle2' });
            // const dom = await page.content();
            // await browser.close();
            // return dom;

            // For now, fetch raw HTML
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'CompetitorSentinel/1.0',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            console.error(`[WebsiteMonitor] DOM capture failed for ${url}:`, error);
            return '';
        }
    }

    /**
     * Get the latest cached snapshot for a URL.
     */
    getLatestSnapshot(competitorId: string, url: string): Snapshot | undefined {
        return this.snapshotCache.get(`${competitorId}:${url}`);
    }

    /**
     * Hash content for comparison.
     */
    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Stop all monitors.
     */
    stopAll(): void {
        for (const interval of this.activeMonitors.values()) {
            clearInterval(interval);
        }
        this.activeMonitors.clear();
        console.log('[WebsiteMonitor] Stopped all monitors');
    }

    /**
     * Get monitoring status.
     */
    getStatus(): { activeMonitors: number; urls: string[] } {
        return {
            activeMonitors: this.activeMonitors.size,
            urls: Array.from(this.activeMonitors.keys()),
        };
    }
}

// ============================================================================
// VisualDiffEngine - Detects visual changes between snapshots
// ============================================================================

export class VisualDiffEngine {
    private diffThreshold: number;

    constructor(diffThreshold: number = 5) {
        this.diffThreshold = diffThreshold;
    }

    /**
     * Compare two snapshots and detect visual differences.
     */
    async compare(before: Snapshot, after: Snapshot): Promise<VisualDiff> {
        // Validate snapshots
        if (before.url !== after.url) {
            throw new Error('Cannot compare snapshots from different URLs');
        }

        // Calculate diff percentage based on hash comparison
        const diffPercentage = this.calculateDiffPercentage(before, after);

        // Identify changed regions (simplified - in production use image processing)
        const changedRegions = await this.identifyChangedRegions(before, after, diffPercentage);

        // Generate diff image (placeholder - in production use actual image diff)
        const diffImageData = diffPercentage > 0
            ? await this.generateDiffImage(before, after)
            : undefined;

        return {
            id: crypto.randomUUID(),
            competitorId: before.competitorId,
            url: before.url,
            beforeSnapshotId: before.id,
            afterSnapshotId: after.id,
            diffPercentage,
            changedRegions,
            diffImageData,
            analyzedAt: new Date(),
        };
    }

    /**
     * Calculate the difference percentage between two snapshots.
     */
    private calculateDiffPercentage(before: Snapshot, after: Snapshot): number {
        // If hashes are identical, no change
        if (before.hash === after.hash) {
            return 0;
        }

        // Compare DOM metadata if available
        const beforeDomHash = before.metadata?.domHash;
        const afterDomHash = after.metadata?.domHash;

        if (beforeDomHash && afterDomHash && beforeDomHash === afterDomHash) {
            // DOM is same but screenshot differs - minor visual change
            return 5;
        }

        // Calculate Levenshtein-like distance for content comparison
        const beforeData = Buffer.from(before.data, 'base64').toString();
        const afterData = Buffer.from(after.data, 'base64').toString();

        const similarity = this.calculateSimilarity(beforeData, afterData);
        return Math.round((1 - similarity) * 100);
    }

    /**
     * Calculate similarity ratio between two strings.
     */
    private calculateSimilarity(str1: string, str2: string): number {
        if (str1 === str2) return 1;
        if (str1.length === 0 || str2.length === 0) return 0;

        // Simple Jaccard-like similarity on character sets
        const set1 = new Set(str1.split(''));
        const set2 = new Set(str2.split(''));

        let intersection = 0;
        for (const char of set1) {
            if (set2.has(char)) intersection++;
        }

        const union = set1.size + set2.size - intersection;
        return intersection / union;
    }

    /**
     * Identify regions that changed between snapshots.
     */
    private async identifyChangedRegions(
        before: Snapshot,
        after: Snapshot,
        diffPercentage: number
    ): Promise<DiffRegion[]> {
        // In production, use image processing libraries like:
        // - pixelmatch for pixel-level comparison
        // - sharp for image manipulation
        // - opencv for advanced region detection

        if (diffPercentage === 0) {
            return [];
        }

        // Simulate region detection based on diff percentage
        const regions: DiffRegion[] = [];

        if (diffPercentage > 50) {
            // Major change - entire viewport affected
            regions.push({
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                changeType: 'modified',
                significance: 100,
            });
        } else if (diffPercentage > 20) {
            // Moderate change - multiple regions
            regions.push({
                x: 0,
                y: 0,
                width: 1920,
                height: 200,
                changeType: 'modified',
                significance: 70,
            });
            regions.push({
                x: 0,
                y: 400,
                width: 800,
                height: 300,
                changeType: 'modified',
                significance: 50,
            });
        } else if (diffPercentage > 5) {
            // Minor change - single region
            regions.push({
                x: 100,
                y: 200,
                width: 400,
                height: 200,
                changeType: 'modified',
                significance: 30,
            });
        }

        return regions;
    }

    /**
     * Generate a diff image highlighting changes.
     */
    private async generateDiffImage(before: Snapshot, after: Snapshot): Promise<string> {
        // In production, use image processing:
        // const beforeImg = sharp(Buffer.from(before.data, 'base64'));
        // const afterImg = sharp(Buffer.from(after.data, 'base64'));
        // ... perform pixel comparison and highlight differences ...

        // Return placeholder diff indicator
        const diffIndicator = `DIFF:${before.id}:${after.id}:${Date.now()}`;
        return Buffer.from(diffIndicator).toString('base64');
    }

    /**
     * Check if a diff exceeds the threshold.
     */
    isSignificant(diff: VisualDiff): boolean {
        return diff.diffPercentage >= this.diffThreshold;
    }

    /**
     * Categorize the change based on diff characteristics.
     */
    categorizeChange(diff: VisualDiff): ChangeType {
        if (diff.diffPercentage > 50) {
            return 'design'; // Major visual overhaul
        }

        // Analyze regions to determine change type
        const hasHeaderChange = diff.changedRegions.some(r => r.y < 200);
        const hasPricingRegion = diff.changedRegions.some(r =>
            r.significance > 50 && r.width > 300
        );

        if (hasPricingRegion) {
            return 'pricing';
        }

        if (hasHeaderChange) {
            return 'feature';
        }

        return 'content';
    }

    /**
     * Set the diff threshold.
     */
    setThreshold(threshold: number): void {
        this.diffThreshold = Math.max(0, Math.min(100, threshold));
    }
}

// ============================================================================
// PriceTracker - Extracts and tracks pricing changes
// ============================================================================

export class PriceTracker {
    private priceHistory: Map<string, PriceData[]>;
    private pricePatterns: RegExp[];

    constructor() {
        this.priceHistory = new Map();
        this.pricePatterns = this.initializePricePatterns();
    }

    /**
     * Initialize regex patterns for price extraction.
     */
    private initializePricePatterns(): RegExp[] {
        return [
            /\$\s*([\d,]+(?:\.\d{2})?)/g, // $99.99
            /USD\s*([\d,]+(?:\.\d{2})?)/gi, // USD 99.99
            /([\d,]+(?:\.\d{2})?)\s*(?:per\s*)?(?:\/)?mo(?:nth)?/gi, // 99.99/month
            /([\d,]+(?:\.\d{2})?)\s*(?:per\s*)?(?:\/)?yr|year/gi, // 99.99/year
            /price[:\s]*\$?([\d,]+(?:\.\d{2})?)/gi, // price: 99.99
            /\b(free)\b/gi, // Free tier
        ];
    }

    /**
     * Extract prices from HTML content.
     */
    async extractPrices(
        competitorId: string,
        url: string,
        htmlContent: string
    ): Promise<PriceData[]> {
        const prices: PriceData[] = [];
        const seenPrices = new Set<string>();

        // Extract text content from HTML
        const textContent = this.stripHtml(htmlContent);

        // Find pricing sections
        const pricingSections = this.findPricingSections(htmlContent);

        for (const section of pricingSections) {
            const sectionPrices = this.extractPricesFromSection(section, competitorId, url);
            for (const price of sectionPrices) {
                const key = `${price.productName}:${price.price}:${price.billingCycle}`;
                if (!seenPrices.has(key)) {
                    seenPrices.add(key);
                    prices.push(price);
                }
            }
        }

        // Fallback: extract all prices from text
        if (prices.length === 0) {
            const fallbackPrices = this.extractAllPrices(textContent, competitorId, url);
            prices.push(...fallbackPrices);
        }

        // Update price history
        for (const price of prices) {
            const historyKey = `${competitorId}:${price.productName}`;
            const history = this.priceHistory.get(historyKey) || [];
            history.push(price);

            // Keep last 100 data points
            if (history.length > 100) {
                history.shift();
            }

            this.priceHistory.set(historyKey, history);
        }

        return prices;
    }

    /**
     * Find pricing-related sections in HTML.
     */
    private findPricingSections(html: string): string[] {
        const sections: string[] = [];

        // Look for pricing-related elements
        const pricingPatterns = [
            /<div[^>]*(?:class|id)[^>]*(?:pricing|price|plans?|tiers?)[^>]*>[\s\S]*?<\/div>/gi,
            /<section[^>]*(?:class|id)[^>]*(?:pricing|price|plans?)[^>]*>[\s\S]*?<\/section>/gi,
            /<table[^>]*(?:class|id)[^>]*(?:pricing|comparison)[^>]*>[\s\S]*?<\/table>/gi,
        ];

        for (const pattern of pricingPatterns) {
            const matches = html.match(pattern);
            if (matches) {
                sections.push(...matches);
            }
        }

        return sections;
    }

    /**
     * Extract prices from a pricing section.
     */
    private extractPricesFromSection(
        section: string,
        competitorId: string,
        url: string
    ): PriceData[] {
        const prices: PriceData[] = [];
        const textContent = this.stripHtml(section);

        // Find tier/plan names
        const tierMatches = section.match(/(?:plan|tier|package)[:\s]*([A-Za-z]+)/gi) ||
            textContent.match(/\b(Basic|Pro|Premium|Enterprise|Starter|Free|Plus|Business)\b/gi);

        const tiers = tierMatches ? [...new Set(tierMatches.map(t => t.trim()))] : ['Standard'];

        // Extract prices with context
        for (const pattern of this.pricePatterns) {
            let match;
            while ((match = pattern.exec(textContent)) !== null) {
                const priceValue = match[1];

                if (priceValue.toLowerCase() === 'free') {
                    prices.push(this.createPriceData(competitorId, url, 'Free', 0, 'USD', tiers[0]));
                    continue;
                }

                const numericPrice = parseFloat(priceValue.replace(/,/g, ''));
                if (!isNaN(numericPrice) && numericPrice > 0 && numericPrice < 100000) {
                    const billingCycle = this.detectBillingCycle(match[0]);
                    const tierIndex = Math.min(prices.length, tiers.length - 1);

                    prices.push(this.createPriceData(
                        competitorId,
                        url,
                        tiers[tierIndex] || `Plan ${prices.length + 1}`,
                        numericPrice,
                        'USD',
                        tiers[tierIndex],
                        billingCycle
                    ));
                }
            }
        }

        return prices;
    }

    /**
     * Extract all prices from text content.
     */
    private extractAllPrices(
        text: string,
        competitorId: string,
        url: string
    ): PriceData[] {
        const prices: PriceData[] = [];
        let planIndex = 1;

        for (const pattern of this.pricePatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const priceValue = match[1];

                if (priceValue.toLowerCase() === 'free') {
                    prices.push(this.createPriceData(competitorId, url, 'Free', 0, 'USD'));
                    continue;
                }

                const numericPrice = parseFloat(priceValue.replace(/,/g, ''));
                if (!isNaN(numericPrice) && numericPrice > 0 && numericPrice < 100000) {
                    const billingCycle = this.detectBillingCycle(match[0]);
                    prices.push(this.createPriceData(
                        competitorId,
                        url,
                        `Plan ${planIndex++}`,
                        numericPrice,
                        'USD',
                        undefined,
                        billingCycle
                    ));
                }
            }
        }

        return prices;
    }

    /**
     * Create a PriceData object.
     */
    private createPriceData(
        competitorId: string,
        url: string,
        productName: string,
        price: number,
        currency: string,
        tier?: string,
        billingCycle?: 'monthly' | 'yearly' | 'one_time'
    ): PriceData {
        return {
            id: crypto.randomUUID(),
            competitorId,
            productName,
            price,
            currency,
            tier,
            billingCycle,
            url,
            capturedAt: new Date(),
        };
    }

    /**
     * Detect billing cycle from price context.
     */
    private detectBillingCycle(priceText: string): 'monthly' | 'yearly' | 'one_time' {
        const text = priceText.toLowerCase();

        if (text.includes('month') || text.includes('/mo') || text.includes('per mo')) {
            return 'monthly';
        }

        if (text.includes('year') || text.includes('/yr') || text.includes('annual')) {
            return 'yearly';
        }

        return 'one_time';
    }

    /**
     * Strip HTML tags from content.
     */
    private stripHtml(html: string): string {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Compare prices and detect changes.
     */
    detectChanges(
        competitorId: string,
        currentPrices: PriceData[],
        previousPrices: PriceData[]
    ): PriceChange[] {
        const changes: PriceChange[] = [];
        const previousMap = new Map(
            previousPrices.map(p => [`${p.productName}:${p.tier || ''}`, p])
        );
        const currentMap = new Map(
            currentPrices.map(p => [`${p.productName}:${p.tier || ''}`, p])
        );

        // Check for price changes and removals
        for (const [key, prev] of previousMap) {
            const current = currentMap.get(key);

            if (!current) {
                // Product removed
                changes.push({
                    id: crypto.randomUUID(),
                    competitorId,
                    productName: prev.productName,
                    previousPrice: prev.price,
                    newPrice: 0,
                    currency: prev.currency,
                    changePercentage: -100,
                    changeType: 'removed',
                    detectedAt: new Date(),
                });
            } else if (current.price !== prev.price) {
                // Price changed
                const changePercentage = prev.price > 0
                    ? ((current.price - prev.price) / prev.price) * 100
                    : 100;

                changes.push({
                    id: crypto.randomUUID(),
                    competitorId,
                    productName: prev.productName,
                    previousPrice: prev.price,
                    newPrice: current.price,
                    currency: current.currency,
                    changePercentage: Math.round(changePercentage * 100) / 100,
                    changeType: current.price > prev.price ? 'increase' : 'decrease',
                    detectedAt: new Date(),
                });
            }
        }

        // Check for new products
        for (const [key, current] of currentMap) {
            if (!previousMap.has(key)) {
                changes.push({
                    id: crypto.randomUUID(),
                    competitorId,
                    productName: current.productName,
                    previousPrice: 0,
                    newPrice: current.price,
                    currency: current.currency,
                    changePercentage: 100,
                    changeType: 'new',
                    detectedAt: new Date(),
                });
            }
        }

        return changes;
    }

    /**
     * Get price history for a product.
     */
    getPriceHistory(competitorId: string, productName: string): PriceData[] {
        return this.priceHistory.get(`${competitorId}:${productName}`) || [];
    }

    /**
     * Get all current prices for a competitor.
     */
    getCurrentPrices(competitorId: string): PriceData[] {
        const prices: PriceData[] = [];

        for (const [key, history] of this.priceHistory) {
            if (key.startsWith(`${competitorId}:`)) {
                const latest = history[history.length - 1];
                if (latest) {
                    prices.push(latest);
                }
            }
        }

        return prices;
    }

    /**
     * Clear price history.
     */
    clearHistory(): void {
        this.priceHistory.clear();
    }
}

// ============================================================================
// ProductCatalogTracker - Tracks new/removed products
// ============================================================================

export class ProductCatalogTracker {
    private productCatalogs: Map<string, Map<string, ProductEntry>>;
    private productPatterns: RegExp[];

    constructor() {
        this.productCatalogs = new Map();
        this.productPatterns = this.initializeProductPatterns();
    }

    /**
     * Initialize patterns for product extraction.
     */
    private initializeProductPatterns(): RegExp[] {
        return [
            /<(?:div|article)[^>]*(?:class|id)[^>]*product[^>]*>[\s\S]*?<\/(?:div|article)>/gi,
            /<(?:div|li)[^>]*(?:class|id)[^>]*(?:card|item)[^>]*>[\s\S]*?<\/(?:div|li)>/gi,
            /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi,
        ];
    }

    /**
     * Extract products from HTML content.
     */
    async extractProducts(
        competitorId: string,
        url: string,
        htmlContent: string
    ): Promise<ProductEntry[]> {
        const products: ProductEntry[] = [];
        const seenProducts = new Set<string>();

        // Find product containers
        const productContainers = this.findProductContainers(htmlContent);

        for (const container of productContainers) {
            const product = this.parseProductContainer(container, competitorId, url);
            if (product && !seenProducts.has(product.productId)) {
                seenProducts.add(product.productId);
                products.push(product);
            }
        }

        // Update product catalog
        let catalog = this.productCatalogs.get(competitorId);
        if (!catalog) {
            catalog = new Map();
            this.productCatalogs.set(competitorId, catalog);
        }

        const now = new Date();
        for (const product of products) {
            const existing = catalog.get(product.productId);
            if (existing) {
                // Update last seen
                existing.lastSeenAt = now;
                existing.isActive = true;
            } else {
                catalog.set(product.productId, product);
            }
        }

        return products;
    }

    /**
     * Find product containers in HTML.
     */
    private findProductContainers(html: string): string[] {
        const containers: string[] = [];

        for (const pattern of this.productPatterns) {
            const matches = html.match(pattern);
            if (matches) {
                containers.push(...matches);
            }
        }

        return containers;
    }

    /**
     * Parse a product container into a ProductEntry.
     */
    private parseProductContainer(
        container: string,
        competitorId: string,
        url: string
    ): ProductEntry | null {
        // Extract product name
        const nameMatch = container.match(/<h[1-4][^>]*>([^<]+)<\/h[1-4]>/i) ||
            container.match(/(?:title|name)[^>]*>([^<]+)</i);

        if (!nameMatch) return null;

        const name = nameMatch[1].trim();
        if (name.length < 2 || name.length > 200) return null;

        // Extract description
        const descMatch = container.match(/<p[^>]*>([^<]+)<\/p>/i);
        const description = descMatch ? descMatch[1].trim() : undefined;

        // Extract price
        const priceMatch = container.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined;

        // Extract image
        const imgMatch = container.match(/<img[^>]*src=["']([^"']+)["']/i);
        const imageUrl = imgMatch ? imgMatch[1] : undefined;

        // Extract link
        const linkMatch = container.match(/<a[^>]*href=["']([^"']+)["']/i);
        const productUrl = linkMatch ? this.resolveUrl(linkMatch[1], url) : url;

        // Generate product ID from name
        const productId = this.generateProductId(name);

        // Extract features
        const features = this.extractFeatures(container);

        return {
            id: crypto.randomUUID(),
            competitorId,
            productId,
            name,
            description,
            price,
            currency: price !== undefined ? 'USD' : undefined,
            features,
            url: productUrl,
            imageUrl,
            isActive: true,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
        };
    }

    /**
     * Generate a stable product ID from name.
     */
    private generateProductId(name: string): string {
        return crypto
            .createHash('md5')
            .update(name.toLowerCase().replace(/[^a-z0-9]/g, ''))
            .digest('hex')
            .substring(0, 16);
    }

    /**
     * Extract features from product container.
     */
    private extractFeatures(container: string): string[] {
        const features: string[] = [];

        // Look for list items
        const listMatches = container.match(/<li[^>]*>([^<]+)<\/li>/gi);
        if (listMatches) {
            for (const match of listMatches) {
                const feature = match.replace(/<[^>]+>/g, '').trim();
                if (feature.length > 2 && feature.length < 200) {
                    features.push(feature);
                }
            }
        }

        return features.slice(0, 20); // Limit features
    }

    /**
     * Resolve a relative URL to absolute.
     */
    private resolveUrl(href: string, baseUrl: string): string {
        try {
            return new URL(href, baseUrl).toString();
        } catch {
            return href;
        }
    }

    /**
     * Detect product changes.
     */
    detectChanges(
        competitorId: string,
        currentProducts: ProductEntry[]
    ): ProductChange[] {
        const changes: ProductChange[] = [];
        const catalog = this.productCatalogs.get(competitorId);

        if (!catalog) {
            // All products are new
            for (const product of currentProducts) {
                changes.push({
                    id: crypto.randomUUID(),
                    competitorId,
                    productId: product.productId,
                    productName: product.name,
                    changeType: 'added',
                    detectedAt: new Date(),
                });
            }
            return changes;
        }

        const currentProductIds = new Set(currentProducts.map(p => p.productId));

        // Check for new and modified products
        for (const product of currentProducts) {
            const existing = catalog.get(product.productId);

            if (!existing) {
                changes.push({
                    id: crypto.randomUUID(),
                    competitorId,
                    productId: product.productId,
                    productName: product.name,
                    changeType: 'added',
                    detectedAt: new Date(),
                });
            } else {
                // Check for modifications
                const modifications = this.detectModifications(existing, product);
                if (Object.keys(modifications).length > 0) {
                    changes.push({
                        id: crypto.randomUUID(),
                        competitorId,
                        productId: product.productId,
                        productName: product.name,
                        changeType: 'modified',
                        changes: modifications,
                        detectedAt: new Date(),
                    });
                }
            }
        }

        // Check for removed products
        for (const [productId, existing] of catalog) {
            if (!currentProductIds.has(productId) && existing.isActive) {
                changes.push({
                    id: crypto.randomUUID(),
                    competitorId,
                    productId,
                    productName: existing.name,
                    changeType: 'removed',
                    detectedAt: new Date(),
                });

                // Mark as inactive
                existing.isActive = false;
            }
        }

        return changes;
    }

    /**
     * Detect modifications between two product entries.
     */
    private detectModifications(
        existing: ProductEntry,
        current: ProductEntry
    ): Record<string, { before: any; after: any }> {
        const modifications: Record<string, { before: any; after: any }> = {};

        if (existing.price !== current.price) {
            modifications['price'] = { before: existing.price, after: current.price };
        }

        if (existing.description !== current.description) {
            modifications['description'] = { before: existing.description, after: current.description };
        }

        // Compare features
        const existingFeatures = new Set(existing.features);
        const currentFeatures = new Set(current.features);

        const addedFeatures = current.features.filter(f => !existingFeatures.has(f));
        const removedFeatures = existing.features.filter(f => !currentFeatures.has(f));

        if (addedFeatures.length > 0 || removedFeatures.length > 0) {
            modifications['features'] = {
                before: existing.features,
                after: current.features,
            };
        }

        return modifications;
    }

    /**
     * Get product catalog for a competitor.
     */
    getCatalog(competitorId: string): ProductEntry[] {
        const catalog = this.productCatalogs.get(competitorId);
        return catalog ? Array.from(catalog.values()) : [];
    }

    /**
     * Get active products for a competitor.
     */
    getActiveProducts(competitorId: string): ProductEntry[] {
        return this.getCatalog(competitorId).filter(p => p.isActive);
    }

    /**
     * Clear catalog for a competitor.
     */
    clearCatalog(competitorId: string): void {
        this.productCatalogs.delete(competitorId);
    }
}

// ============================================================================
// SocialMediaMonitor - Monitors competitor social media activity
// ============================================================================

export class SocialMediaMonitor {
    private socialData: Map<string, SocialPost[]>;
    private metricsHistory: Map<string, SocialMetrics[]>;
    private apiConfigs: Map<SocialPlatform, { apiKey?: string; accessToken?: string }>;

    constructor() {
        this.socialData = new Map();
        this.metricsHistory = new Map();
        this.apiConfigs = new Map();
    }

    /**
     * Configure API credentials for a platform.
     */
    configureApi(platform: SocialPlatform, config: { apiKey?: string; accessToken?: string }): void {
        this.apiConfigs.set(platform, config);
    }

    /**
     * Monitor social profiles for a competitor.
     */
    async monitor(
        competitor: CompetitorProfile
    ): Promise<{ posts: SocialPost[]; metrics: SocialMetrics[] }> {
        const posts: SocialPost[] = [];
        const metrics: SocialMetrics[] = [];

        for (const profile of competitor.socialProfiles) {
            if (!profile.isActive) continue;

            try {
                const platformPosts = await this.fetchPosts(competitor.id, profile);
                const platformMetrics = await this.fetchMetrics(competitor.id, profile);

                posts.push(...platformPosts);
                if (platformMetrics) {
                    metrics.push(platformMetrics);
                }
            } catch (error) {
                console.error(
                    `[SocialMediaMonitor] Failed to monitor ${profile.platform}:`,
                    error
                );
            }
        }

        return { posts, metrics };
    }

    /**
     * Fetch posts from a social platform.
     */
    private async fetchPosts(
        competitorId: string,
        profile: SocialProfile
    ): Promise<SocialPost[]> {
        const apiConfig = this.apiConfigs.get(profile.platform);

        switch (profile.platform) {
            case 'twitter':
                return this.fetchTwitterPosts(competitorId, profile, apiConfig);
            case 'linkedin':
                return this.fetchLinkedInPosts(competitorId, profile, apiConfig);
            case 'facebook':
                return this.fetchFacebookPosts(competitorId, profile, apiConfig);
            case 'instagram':
                return this.fetchInstagramPosts(competitorId, profile, apiConfig);
            case 'youtube':
                return this.fetchYouTubePosts(competitorId, profile, apiConfig);
            default:
                return [];
        }
    }

    /**
     * Fetch Twitter posts.
     */
    private async fetchTwitterPosts(
        competitorId: string,
        profile: SocialProfile,
        apiConfig?: { apiKey?: string; accessToken?: string }
    ): Promise<SocialPost[]> {
        // In production, use Twitter API v2:
        // GET /2/users/:id/tweets
        // Headers: Authorization: Bearer ${apiConfig.accessToken}

        return this.generateMockPosts(competitorId, profile, 'twitter');
    }

    /**
     * Fetch LinkedIn posts.
     */
    private async fetchLinkedInPosts(
        competitorId: string,
        profile: SocialProfile,
        apiConfig?: { apiKey?: string; accessToken?: string }
    ): Promise<SocialPost[]> {
        // In production, use LinkedIn API:
        // GET /organizations/{organizationId}/ugcPosts

        return this.generateMockPosts(competitorId, profile, 'linkedin');
    }

    /**
     * Fetch Facebook posts.
     */
    private async fetchFacebookPosts(
        competitorId: string,
        profile: SocialProfile,
        apiConfig?: { apiKey?: string; accessToken?: string }
    ): Promise<SocialPost[]> {
        // In production, use Facebook Graph API:
        // GET /{page-id}/feed

        return this.generateMockPosts(competitorId, profile, 'facebook');
    }

    /**
     * Fetch Instagram posts.
     */
    private async fetchInstagramPosts(
        competitorId: string,
        profile: SocialProfile,
        apiConfig?: { apiKey?: string; accessToken?: string }
    ): Promise<SocialPost[]> {
        // In production, use Instagram Graph API:
        // GET /{user-id}/media

        return this.generateMockPosts(competitorId, profile, 'instagram');
    }

    /**
     * Fetch YouTube posts/videos.
     */
    private async fetchYouTubePosts(
        competitorId: string,
        profile: SocialProfile,
        apiConfig?: { apiKey?: string; accessToken?: string }
    ): Promise<SocialPost[]> {
        // In production, use YouTube Data API:
        // GET /search?channelId={channelId}&order=date

        return this.generateMockPosts(competitorId, profile, 'youtube');
    }

    /**
     * Generate mock posts for development.
     */
    private generateMockPosts(
        competitorId: string,
        profile: SocialProfile,
        platform: SocialPlatform
    ): SocialPost[] {
        const posts: SocialPost[] = [];
        const now = new Date();

        const topics = [
            'Exciting product update',
            'New feature announcement',
            'Industry insights',
            'Customer success story',
            'Behind the scenes',
        ];

        for (let i = 0; i < 5; i++) {
            const postedAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

            posts.push({
                id: crypto.randomUUID(),
                competitorId,
                platform,
                postId: `${platform}_${crypto.randomUUID().substring(0, 8)}`,
                content: `${topics[i]} from ${profile.handle}`,
                url: `${profile.url}/post/${i}`,
                engagement: {
                    likes: Math.floor(Math.random() * 1000),
                    comments: Math.floor(Math.random() * 100),
                    shares: Math.floor(Math.random() * 50),
                    views: platform === 'youtube' ? Math.floor(Math.random() * 10000) : undefined,
                },
                postedAt,
                capturedAt: now,
                sentiment: Math.random() * 2 - 1, // -1 to 1
                topics: [topics[i].split(' ')[0].toLowerCase()],
            });
        }

        // Store posts
        const key = `${competitorId}:${platform}`;
        const existing = this.socialData.get(key) || [];
        const combined = [...posts, ...existing].slice(0, 100);
        this.socialData.set(key, combined);

        return posts;
    }

    /**
     * Fetch metrics for a social profile.
     */
    private async fetchMetrics(
        competitorId: string,
        profile: SocialProfile
    ): Promise<SocialMetrics | null> {
        // In production, fetch actual metrics from APIs

        const posts = this.socialData.get(`${competitorId}:${profile.platform}`) || [];
        const recentPosts = posts.filter(
            p => p.postedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );

        const totalEngagement = posts.reduce(
            (sum, p) => sum + p.engagement.likes + p.engagement.comments + p.engagement.shares,
            0
        );

        const metrics: SocialMetrics = {
            competitorId,
            platform: profile.platform,
            followers: Math.floor(Math.random() * 100000) + 1000,
            followersGrowth: Math.floor(Math.random() * 500) - 100,
            postsThisWeek: recentPosts.length,
            avgEngagementRate: posts.length > 0 ? totalEngagement / posts.length : 0,
            topPosts: posts.sort((a, b) =>
                (b.engagement.likes + b.engagement.shares) - (a.engagement.likes + a.engagement.shares)
            ).slice(0, 3),
            capturedAt: new Date(),
        };

        // Store metrics history
        const historyKey = `${competitorId}:${profile.platform}`;
        const history = this.metricsHistory.get(historyKey) || [];
        history.push(metrics);
        if (history.length > 30) {
            history.shift();
        }
        this.metricsHistory.set(historyKey, history);

        return metrics;
    }

    /**
     * Get recent posts for a competitor.
     */
    getRecentPosts(competitorId: string, platform?: SocialPlatform): SocialPost[] {
        if (platform) {
            return this.socialData.get(`${competitorId}:${platform}`) || [];
        }

        const allPosts: SocialPost[] = [];
        for (const [key, posts] of this.socialData) {
            if (key.startsWith(`${competitorId}:`)) {
                allPosts.push(...posts);
            }
        }

        return allPosts.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
    }

    /**
     * Get metrics history for a competitor.
     */
    getMetricsHistory(competitorId: string, platform: SocialPlatform): SocialMetrics[] {
        return this.metricsHistory.get(`${competitorId}:${platform}`) || [];
    }

    /**
     * Analyze social activity trends.
     */
    analyzeActivity(competitorId: string): {
        totalPosts: number;
        avgEngagement: number;
        topPlatform: SocialPlatform | null;
        sentiment: number;
        activityTrend: 'increasing' | 'stable' | 'decreasing';
    } {
        const allPosts = this.getRecentPosts(competitorId);

        if (allPosts.length === 0) {
            return {
                totalPosts: 0,
                avgEngagement: 0,
                topPlatform: null,
                sentiment: 0,
                activityTrend: 'stable',
            };
        }

        // Calculate metrics
        const totalEngagement = allPosts.reduce(
            (sum, p) => sum + p.engagement.likes + p.engagement.comments + p.engagement.shares,
            0
        );

        const avgSentiment = allPosts.reduce(
            (sum, p) => sum + (p.sentiment || 0),
            0
        ) / allPosts.length;

        // Find top platform
        const platformCounts = new Map<SocialPlatform, number>();
        for (const post of allPosts) {
            platformCounts.set(
                post.platform,
                (platformCounts.get(post.platform) || 0) + 1
            );
        }

        let topPlatform: SocialPlatform | null = null;
        let maxCount = 0;
        for (const [platform, count] of platformCounts) {
            if (count > maxCount) {
                maxCount = count;
                topPlatform = platform;
            }
        }

        // Analyze trend
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

        const thisWeek = allPosts.filter(p => p.postedAt > oneWeekAgo).length;
        const lastWeek = allPosts.filter(
            p => p.postedAt > twoWeeksAgo && p.postedAt <= oneWeekAgo
        ).length;

        let activityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
        if (thisWeek > lastWeek * 1.2) {
            activityTrend = 'increasing';
        } else if (thisWeek < lastWeek * 0.8) {
            activityTrend = 'decreasing';
        }

        return {
            totalPosts: allPosts.length,
            avgEngagement: Math.round(totalEngagement / allPosts.length),
            topPlatform,
            sentiment: Math.round(avgSentiment * 100) / 100,
            activityTrend,
        };
    }

    /**
     * Clear social data.
     */
    clearData(): void {
        this.socialData.clear();
        this.metricsHistory.clear();
    }
}

// ============================================================================
// AlertSystem - Notifies users of important changes
// ============================================================================

export class CompetitorAlertSystem extends EventEmitter {
    private alerts: Map<string, CompetitorAlert>;
    private channelConfigs: AlertChannelConfig[];
    private alertHistory: CompetitorAlert[];
    private maxHistorySize: number;

    constructor(channelConfigs: AlertChannelConfig[] = []) {
        super();
        this.alerts = new Map();
        this.channelConfigs = channelConfigs;
        this.alertHistory = [];
        this.maxHistorySize = 1000;
    }

    /**
     * Create and dispatch an alert.
     */
    async createAlert(params: {
        competitorId: string;
        competitorName: string;
        type: ChangeType;
        severity: ChangeSeverity;
        title: string;
        description: string;
        details?: Record<string, any>;
        url?: string;
    }): Promise<CompetitorAlert> {
        const alert: CompetitorAlert = {
            id: crypto.randomUUID(),
            competitorId: params.competitorId,
            competitorName: params.competitorName,
            type: params.type,
            severity: params.severity,
            title: params.title,
            description: params.description,
            details: params.details,
            url: params.url,
            createdAt: new Date(),
            acknowledged: false,
        };

        // Store alert
        this.alerts.set(alert.id, alert);
        this.addToHistory(alert);

        // Dispatch to channels
        await this.dispatchAlert(alert);

        // Emit event
        this.emit('alert', alert);

        return alert;
    }

    /**
     * Dispatch alert to configured channels.
     */
    private async dispatchAlert(alert: CompetitorAlert): Promise<void> {
        const severityOrder: Record<ChangeSeverity, number> = {
            low: 0,
            medium: 1,
            high: 2,
            critical: 3,
        };

        for (const channelConfig of this.channelConfigs) {
            if (!channelConfig.enabled) continue;

            const minSeverityLevel = severityOrder[channelConfig.minSeverity];
            const alertSeverityLevel = severityOrder[alert.severity];

            if (alertSeverityLevel < minSeverityLevel) continue;

            try {
                await this.sendToChannel(alert, channelConfig);
            } catch (error) {
                console.error(
                    `[AlertSystem] Failed to send alert to ${channelConfig.type}:`,
                    error
                );
            }
        }
    }

    /**
     * Send alert to a specific channel.
     */
    private async sendToChannel(
        alert: CompetitorAlert,
        config: AlertChannelConfig
    ): Promise<void> {
        switch (config.type) {
            case 'email':
                await this.sendEmail(alert, config.config);
                break;
            case 'slack':
                await this.sendSlack(alert, config.config);
                break;
            case 'webhook':
                await this.sendWebhook(alert, config.config);
                break;
            case 'in_app':
                // Already handled by event emission
                break;
        }
    }

    /**
     * Send email alert.
     */
    private async sendEmail(
        alert: CompetitorAlert,
        config: Record<string, any>
    ): Promise<void> {
        // In production, use email service (SendGrid, SES, etc.):
        // await sendgrid.send({
        //     to: config.recipients,
        //     from: config.from,
        //     subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        //     text: alert.description,
        // });

        console.log(`[AlertSystem] Email alert: ${alert.title} to ${config.recipients?.join(', ')}`);
    }

    /**
     * Send Slack alert.
     */
    private async sendSlack(
        alert: CompetitorAlert,
        config: Record<string, any>
    ): Promise<void> {
        // In production, use Slack webhook:
        // await fetch(config.webhookUrl, {
        //     method: 'POST',
        //     body: JSON.stringify({
        //         text: `*${alert.title}*\n${alert.description}`,
        //         attachments: [{ color: this.getSeverityColor(alert.severity), ... }]
        //     }),
        // });

        console.log(`[AlertSystem] Slack alert: ${alert.title} to ${config.channel}`);
    }

    /**
     * Send webhook alert.
     */
    private async sendWebhook(
        alert: CompetitorAlert,
        config: Record<string, any>
    ): Promise<void> {
        try {
            await fetch(config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.headers || {}),
                },
                body: JSON.stringify(alert),
            });

            console.log(`[AlertSystem] Webhook alert sent to ${config.url}`);
        } catch (error) {
            console.error('[AlertSystem] Webhook failed:', error);
        }
    }

    /**
     * Get severity color for UI/messaging.
     */
    private getSeverityColor(severity: ChangeSeverity): string {
        const colors: Record<ChangeSeverity, string> = {
            low: '#36a64f',
            medium: '#daa520',
            high: '#ff6b6b',
            critical: '#ff0000',
        };
        return colors[severity];
    }

    /**
     * Add alert to history.
     */
    private addToHistory(alert: CompetitorAlert): void {
        this.alertHistory.push(alert);
        if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory = this.alertHistory.slice(-this.maxHistorySize / 2);
        }
    }

    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date();
            alert.acknowledgedBy = acknowledgedBy;
            this.emit('alert_acknowledged', alert);
            return true;
        }
        return false;
    }

    /**
     * Get unacknowledged alerts.
     */
    getActiveAlerts(competitorId?: string): CompetitorAlert[] {
        let alerts = Array.from(this.alerts.values()).filter(a => !a.acknowledged);

        if (competitorId) {
            alerts = alerts.filter(a => a.competitorId === competitorId);
        }

        return alerts.sort((a, b) => {
            const severityOrder: Record<ChangeSeverity, number> = {
                critical: 0,
                high: 1,
                medium: 2,
                low: 3,
            };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    /**
     * Get alert history.
     */
    getAlertHistory(options?: {
        competitorId?: string;
        type?: ChangeType;
        severity?: ChangeSeverity;
        limit?: number;
    }): CompetitorAlert[] {
        let alerts = [...this.alertHistory];

        if (options?.competitorId) {
            alerts = alerts.filter(a => a.competitorId === options.competitorId);
        }

        if (options?.type) {
            alerts = alerts.filter(a => a.type === options.type);
        }

        if (options?.severity) {
            alerts = alerts.filter(a => a.severity === options.severity);
        }

        alerts = alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        if (options?.limit) {
            alerts = alerts.slice(0, options.limit);
        }

        return alerts;
    }

    /**
     * Get alert statistics.
     */
    getStats(): {
        total: number;
        active: number;
        byType: Record<ChangeType, number>;
        bySeverity: Record<ChangeSeverity, number>;
    } {
        const alerts = Array.from(this.alerts.values());

        const byType: Record<ChangeType, number> = {
            pricing: 0,
            product: 0,
            feature: 0,
            content: 0,
            design: 0,
            social: 0,
        };

        const bySeverity: Record<ChangeSeverity, number> = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };

        for (const alert of alerts) {
            byType[alert.type]++;
            bySeverity[alert.severity]++;
        }

        return {
            total: alerts.length,
            active: alerts.filter(a => !a.acknowledged).length,
            byType,
            bySeverity,
        };
    }

    /**
     * Configure alert channels.
     */
    configureChannels(configs: AlertChannelConfig[]): void {
        this.channelConfigs = configs;
    }

    /**
     * Cleanup old alerts.
     */
    cleanup(maxAgeDays: number = 30): number {
        const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
        let removed = 0;

        for (const [id, alert] of this.alerts) {
            if (alert.createdAt < cutoffDate && alert.acknowledged) {
                this.alerts.delete(id);
                removed++;
            }
        }

        return removed;
    }
}

// ============================================================================
// ReportGenerator - Generates weekly competitive intelligence summaries
// ============================================================================

export class ReportGenerator {
    private db: Database | null;

    constructor() {
        try {
            this.db = Database.getInstance();
        } catch {
            this.db = null;
        }
    }

    /**
     * Generate a competitive intelligence report.
     */
    async generateReport(params: {
        competitors: CompetitorProfile[];
        periodStart: Date;
        periodEnd: Date;
        priceChanges: PriceChange[];
        productChanges: ProductChange[];
        visualChanges: VisualDiff[];
        socialPosts: SocialPost[];
        alerts: CompetitorAlert[];
        reportType?: 'weekly' | 'monthly' | 'custom';
    }): Promise<IntelligenceReport> {
        const {
            competitors,
            periodStart,
            periodEnd,
            priceChanges,
            productChanges,
            visualChanges,
            socialPosts,
            alerts,
            reportType = 'weekly',
        } = params;

        // Generate competitor summaries
        const competitorSummaries = competitors.map(competitor =>
            this.generateCompetitorSummary(
                competitor,
                priceChanges,
                productChanges,
                visualChanges,
                alerts
            )
        );

        // Filter period-relevant data
        const periodPriceChanges = priceChanges.filter(
            c => c.detectedAt >= periodStart && c.detectedAt <= periodEnd
        );

        const periodProductChanges = productChanges.filter(
            c => c.detectedAt >= periodStart && c.detectedAt <= periodEnd
        );

        const periodVisualChanges = visualChanges.filter(
            c => c.analyzedAt >= periodStart && c.analyzedAt <= periodEnd
        );

        // Get social highlights
        const socialHighlights = this.selectSocialHighlights(socialPosts, periodStart, periodEnd);

        // Generate insights
        const keyInsights = this.generateKeyInsights(
            competitorSummaries,
            periodPriceChanges,
            periodProductChanges,
            socialHighlights
        );

        // Generate recommendations
        const recommendations = this.generateRecommendations(
            competitorSummaries,
            periodPriceChanges,
            periodProductChanges
        );

        const report: IntelligenceReport = {
            id: crypto.randomUUID(),
            reportType,
            periodStart,
            periodEnd,
            competitors: competitorSummaries,
            priceChanges: periodPriceChanges,
            productChanges: periodProductChanges,
            visualChanges: periodVisualChanges,
            socialHighlights,
            keyInsights,
            recommendations,
            generatedAt: new Date(),
        };

        // Save report to database if available
        if (this.db && this.db.isReady()) {
            await this.saveReport(report);
        }

        return report;
    }

    /**
     * Generate summary for a single competitor.
     */
    private generateCompetitorSummary(
        competitor: CompetitorProfile,
        priceChanges: PriceChange[],
        productChanges: ProductChange[],
        visualChanges: VisualDiff[],
        alerts: CompetitorAlert[]
    ): CompetitorSummary {
        const competitorId = competitor.id;

        // Count changes by type
        const changesByType: Record<ChangeType, number> = {
            pricing: priceChanges.filter(c => c.competitorId === competitorId).length,
            product: productChanges.filter(c => c.competitorId === competitorId).length,
            feature: 0,
            content: visualChanges.filter(c =>
                c.competitorId === competitorId && c.diffPercentage < 30
            ).length,
            design: visualChanges.filter(c =>
                c.competitorId === competitorId && c.diffPercentage >= 30
            ).length,
            social: 0,
        };

        const totalChanges = Object.values(changesByType).reduce((a, b) => a + b, 0);

        // Identify significant changes
        const significantChanges: string[] = [];

        const majorPriceChanges = priceChanges.filter(
            c => c.competitorId === competitorId && Math.abs(c.changePercentage) > 10
        );
        for (const change of majorPriceChanges) {
            significantChanges.push(
                `${change.changeType === 'increase' ? 'Price increase' : 'Price decrease'} ` +
                `for ${change.productName}: ${change.changePercentage > 0 ? '+' : ''}${change.changePercentage.toFixed(1)}%`
            );
        }

        const newProducts = productChanges.filter(
            c => c.competitorId === competitorId && c.changeType === 'added'
        );
        for (const product of newProducts) {
            significantChanges.push(`New product launched: ${product.productName}`);
        }

        // Assess risk level
        const competitorAlerts = alerts.filter(a => a.competitorId === competitorId);
        const criticalAlerts = competitorAlerts.filter(a => a.severity === 'critical').length;
        const highAlerts = competitorAlerts.filter(a => a.severity === 'high').length;

        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        if (criticalAlerts > 0 || highAlerts > 2) {
            riskLevel = 'high';
        } else if (highAlerts > 0 || totalChanges > 5) {
            riskLevel = 'medium';
        }

        return {
            competitorId,
            competitorName: competitor.name,
            domain: competitor.domain,
            totalChanges,
            changesByType,
            significantChanges: significantChanges.slice(0, 5),
            socialGrowth: 0, // Would be calculated from SocialMetrics
            riskLevel,
        };
    }

    /**
     * Select top social posts as highlights.
     */
    private selectSocialHighlights(
        posts: SocialPost[],
        periodStart: Date,
        periodEnd: Date
    ): SocialPost[] {
        return posts
            .filter(p => p.postedAt >= periodStart && p.postedAt <= periodEnd)
            .sort((a, b) => {
                const engagementA = a.engagement.likes + a.engagement.shares * 2 + a.engagement.comments;
                const engagementB = b.engagement.likes + b.engagement.shares * 2 + b.engagement.comments;
                return engagementB - engagementA;
            })
            .slice(0, 10);
    }

    /**
     * Generate key insights from the data.
     */
    private generateKeyInsights(
        summaries: CompetitorSummary[],
        priceChanges: PriceChange[],
        productChanges: ProductChange[],
        socialHighlights: SocialPost[]
    ): string[] {
        const insights: string[] = [];

        // Overall activity insight
        const totalChanges = summaries.reduce((sum, s) => sum + s.totalChanges, 0);
        insights.push(`Detected ${totalChanges} changes across ${summaries.length} competitors this period.`);

        // Price trend insight
        const priceIncreases = priceChanges.filter(c => c.changeType === 'increase').length;
        const priceDecreases = priceChanges.filter(c => c.changeType === 'decrease').length;

        if (priceIncreases > priceDecreases) {
            insights.push(
                `Market trend: ${priceIncreases} price increases vs ${priceDecreases} decreases. ` +
                'Consider reviewing your pricing strategy.'
            );
        } else if (priceDecreases > priceIncreases) {
            insights.push(
                `Market trend: ${priceDecreases} price decreases detected. ` +
                'Competitors may be competing on price.'
            );
        }

        // Product activity insight
        const newProducts = productChanges.filter(c => c.changeType === 'added').length;
        if (newProducts > 0) {
            insights.push(
                `${newProducts} new products/features launched by competitors. ` +
                'Review for potential gaps in your offering.'
            );
        }

        // High-risk competitor insight
        const highRiskCompetitors = summaries.filter(s => s.riskLevel === 'high');
        if (highRiskCompetitors.length > 0) {
            insights.push(
                `High activity detected from: ${highRiskCompetitors.map(c => c.competitorName).join(', ')}. ` +
                'These competitors warrant close attention.'
            );
        }

        // Social engagement insight
        if (socialHighlights.length > 0) {
            const avgEngagement = socialHighlights.reduce(
                (sum, p) => sum + p.engagement.likes + p.engagement.shares,
                0
            ) / socialHighlights.length;

            insights.push(
                `Top competitor social posts averaged ${Math.round(avgEngagement)} engagements. ` +
                'Analyze successful content for inspiration.'
            );
        }

        return insights;
    }

    /**
     * Generate actionable recommendations.
     */
    private generateRecommendations(
        summaries: CompetitorSummary[],
        priceChanges: PriceChange[],
        productChanges: ProductChange[]
    ): string[] {
        const recommendations: string[] = [];

        // Pricing recommendations
        const significantPriceChanges = priceChanges.filter(
            c => Math.abs(c.changePercentage) > 15
        );

        if (significantPriceChanges.length > 0) {
            recommendations.push(
                'Review pricing strategy: Multiple competitors made significant price adjustments. ' +
                'Consider a competitive pricing analysis.'
            );
        }

        // Product recommendations
        const newFeatures = productChanges.filter(c => c.changeType === 'added');
        if (newFeatures.length > 2) {
            recommendations.push(
                'Feature gap analysis recommended: Competitors launched multiple new features. ' +
                'Evaluate if these features align with your roadmap.'
            );
        }

        // Monitoring recommendations
        const highActivityCompetitors = summaries.filter(s => s.totalChanges > 5);
        if (highActivityCompetitors.length > 0) {
            recommendations.push(
                `Increase monitoring frequency for: ${highActivityCompetitors.map(c => c.competitorName).join(', ')}. ` +
                'These competitors are highly active.'
            );
        }

        // Default recommendation
        if (recommendations.length === 0) {
            recommendations.push(
                'Market appears stable. Continue regular monitoring and focus on your strategic initiatives.'
            );
        }

        return recommendations;
    }

    /**
     * Save report to database.
     */
    private async saveReport(report: IntelligenceReport): Promise<void> {
        if (!this.db) return;

        try {
            await this.db.query(
                `INSERT INTO competitor_reports
                 (id, report_type, period_start, period_end, data, generated_at)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    report.id,
                    report.reportType,
                    report.periodStart,
                    report.periodEnd,
                    JSON.stringify(report),
                    report.generatedAt,
                ]
            );
        } catch (error) {
            console.error('[ReportGenerator] Failed to save report:', error);
        }
    }

    /**
     * Get historical reports.
     */
    async getReports(options?: {
        reportType?: 'weekly' | 'monthly' | 'custom';
        limit?: number;
    }): Promise<IntelligenceReport[]> {
        if (!this.db || !this.db.isReady()) {
            return [];
        }

        try {
            let query = 'SELECT data FROM competitor_reports';
            const params: any[] = [];

            if (options?.reportType) {
                query += ' WHERE report_type = $1';
                params.push(options.reportType);
            }

            query += ' ORDER BY generated_at DESC';

            if (options?.limit) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(options.limit);
            }

            const result = await this.db.query<{ data: IntelligenceReport }>(query, params);
            return result.rows.map(r => r.data);
        } catch (error) {
            console.error('[ReportGenerator] Failed to fetch reports:', error);
            return [];
        }
    }
}

// ============================================================================
// ChangeHistory - Database for tracking changes over time
// ============================================================================

export class ChangeHistory {
    private db: Database | null;
    private inMemoryHistory: Map<string, ChangeRecord[]>;

    constructor() {
        try {
            this.db = Database.getInstance();
        } catch {
            this.db = null;
        }
        this.inMemoryHistory = new Map();
    }

    /**
     * Record a change.
     */
    async recordChange(change: Omit<ChangeRecord, 'id'>): Promise<ChangeRecord> {
        const record: ChangeRecord = {
            id: crypto.randomUUID(),
            ...change,
        };

        // Store in memory
        const key = record.competitorId;
        const history = this.inMemoryHistory.get(key) || [];
        history.push(record);
        if (history.length > 1000) {
            history.shift();
        }
        this.inMemoryHistory.set(key, history);

        // Store in database
        if (this.db && this.db.isReady()) {
            try {
                await this.db.query(
                    `INSERT INTO competitor_changes
                     (id, competitor_id, change_type, severity, title, description, before_state, after_state, metadata, detected_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        record.id,
                        record.competitorId,
                        record.changeType,
                        record.severity,
                        record.title,
                        record.description,
                        record.beforeState || null,
                        record.afterState || null,
                        record.metadata ? JSON.stringify(record.metadata) : null,
                        record.detectedAt,
                    ]
                );
            } catch (error) {
                console.error('[ChangeHistory] Failed to save change:', error);
            }
        }

        return record;
    }

    /**
     * Get change history for a competitor.
     */
    async getHistory(options: {
        competitorId?: string;
        changeType?: ChangeType;
        severity?: ChangeSeverity;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<ChangeRecord[]> {
        // Try database first
        if (this.db && this.db.isReady()) {
            return this.getHistoryFromDb(options);
        }

        // Fall back to in-memory
        return this.getHistoryFromMemory(options);
    }

    /**
     * Get history from database.
     */
    private async getHistoryFromDb(options: {
        competitorId?: string;
        changeType?: ChangeType;
        severity?: ChangeSeverity;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<ChangeRecord[]> {
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (options.competitorId) {
            conditions.push(`competitor_id = $${paramIndex++}`);
            params.push(options.competitorId);
        }

        if (options.changeType) {
            conditions.push(`change_type = $${paramIndex++}`);
            params.push(options.changeType);
        }

        if (options.severity) {
            conditions.push(`severity = $${paramIndex++}`);
            params.push(options.severity);
        }

        if (options.startDate) {
            conditions.push(`detected_at >= $${paramIndex++}`);
            params.push(options.startDate);
        }

        if (options.endDate) {
            conditions.push(`detected_at <= $${paramIndex++}`);
            params.push(options.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.min(options.limit || 100, 1000);
        const offset = options.offset || 0;

        params.push(limit, offset);

        try {
            const result = await this.db!.query<any>(
                `SELECT * FROM competitor_changes ${whereClause}
                 ORDER BY detected_at DESC
                 LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
                params
            );

            return result.rows.map(row => ({
                id: row.id,
                competitorId: row.competitor_id,
                changeType: row.change_type,
                severity: row.severity,
                title: row.title,
                description: row.description,
                beforeState: row.before_state,
                afterState: row.after_state,
                metadata: row.metadata,
                detectedAt: new Date(row.detected_at),
            }));
        } catch (error) {
            console.error('[ChangeHistory] Database query failed:', error);
            return this.getHistoryFromMemory(options);
        }
    }

    /**
     * Get history from in-memory storage.
     */
    private getHistoryFromMemory(options: {
        competitorId?: string;
        changeType?: ChangeType;
        severity?: ChangeSeverity;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): ChangeRecord[] {
        let records: ChangeRecord[] = [];

        if (options.competitorId) {
            records = this.inMemoryHistory.get(options.competitorId) || [];
        } else {
            for (const history of this.inMemoryHistory.values()) {
                records.push(...history);
            }
        }

        // Apply filters
        if (options.changeType) {
            records = records.filter(r => r.changeType === options.changeType);
        }

        if (options.severity) {
            records = records.filter(r => r.severity === options.severity);
        }

        if (options.startDate) {
            records = records.filter(r => r.detectedAt >= options.startDate!);
        }

        if (options.endDate) {
            records = records.filter(r => r.detectedAt <= options.endDate!);
        }

        // Sort and paginate
        records = records.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

        const offset = options.offset || 0;
        const limit = options.limit || 100;

        return records.slice(offset, offset + limit);
    }

    /**
     * Get change statistics.
     */
    async getStats(competitorId?: string, days: number = 30): Promise<{
        totalChanges: number;
        byType: Record<ChangeType, number>;
        bySeverity: Record<ChangeSeverity, number>;
        avgChangesPerDay: number;
    }> {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const history = await this.getHistory({
            competitorId,
            startDate,
            limit: 10000,
        });

        const byType: Record<ChangeType, number> = {
            pricing: 0,
            product: 0,
            feature: 0,
            content: 0,
            design: 0,
            social: 0,
        };

        const bySeverity: Record<ChangeSeverity, number> = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };

        for (const record of history) {
            byType[record.changeType]++;
            bySeverity[record.severity]++;
        }

        return {
            totalChanges: history.length,
            byType,
            bySeverity,
            avgChangesPerDay: Math.round((history.length / days) * 100) / 100,
        };
    }

    /**
     * Clear history for a competitor.
     */
    clearHistory(competitorId: string): void {
        this.inMemoryHistory.delete(competitorId);
    }
}

// ============================================================================
// CompetitorSentinel - Main orchestrating class
// ============================================================================

export class CompetitorSentinel extends EventEmitter {
    private config: CompetitorSentinelConfig;
    private websiteMonitor: WebsiteMonitor;
    private visualDiffEngine: VisualDiffEngine;
    private priceTracker: PriceTracker;
    private productTracker: ProductCatalogTracker;
    private socialMonitor: SocialMediaMonitor;
    private alertSystem: CompetitorAlertSystem;
    private reportGenerator: ReportGenerator;
    private changeHistory: ChangeHistory;

    private competitors: Map<string, CompetitorProfile>;
    private previousSnapshots: Map<string, Snapshot>;
    private previousPrices: Map<string, PriceData[]>;
    private isRunning: boolean;
    private monitorIntervals: Map<string, NodeJS.Timeout>;
    private reportInterval: NodeJS.Timeout | null;

    constructor(config?: Partial<CompetitorSentinelConfig>) {
        super();

        this.config = {
            defaultMonitoringConfig: {
                screenshotInterval: 6 * 60 * 60 * 1000, // 6 hours
                domSnapshotInterval: 2 * 60 * 60 * 1000, // 2 hours
                priceCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
                socialCheckInterval: 4 * 60 * 60 * 1000, // 4 hours
                enableVisualDiff: true,
                enablePriceTracking: true,
                enableProductTracking: true,
                enableSocialMonitoring: true,
                diffThreshold: 5,
            },
            alertChannels: [],
            reportSchedule: {
                weekly: true,
                dayOfWeek: 1, // Monday
                hourOfDay: 9, // 9 AM
            },
            maxConcurrentMonitors: 10,
            retryConfig: {
                maxRetries: 3,
                retryDelayMs: 5000,
            },
            ...config,
        };

        this.websiteMonitor = new WebsiteMonitor(this.config);
        this.visualDiffEngine = new VisualDiffEngine(this.config.defaultMonitoringConfig.diffThreshold);
        this.priceTracker = new PriceTracker();
        this.productTracker = new ProductCatalogTracker();
        this.socialMonitor = new SocialMediaMonitor();
        this.alertSystem = new CompetitorAlertSystem(this.config.alertChannels);
        this.reportGenerator = new ReportGenerator();
        this.changeHistory = new ChangeHistory();

        this.competitors = new Map();
        this.previousSnapshots = new Map();
        this.previousPrices = new Map();
        this.isRunning = false;
        this.monitorIntervals = new Map();
        this.reportInterval = null;

        // Forward alert events
        this.alertSystem.on('alert', (alert) => {
            this.emit('alert', alert);
        });
    }

    /**
     * Start monitoring competitors.
     */
    async monitor(competitorUrls: string[] | CompetitorProfile[]): Promise<void> {
        console.log('[CompetitorSentinel] Starting competitive monitoring...');
        this.isRunning = true;

        // Convert URLs to profiles if needed
        const profiles = competitorUrls.map(input => {
            if (typeof input === 'string') {
                return this.createProfileFromUrl(input);
            }
            return input;
        });

        // Register competitors
        for (const profile of profiles) {
            this.competitors.set(profile.id, profile);
        }

        // Start monitoring each competitor
        for (const competitor of this.competitors.values()) {
            await this.startCompetitorMonitoring(competitor);
        }

        // Schedule weekly reports
        this.scheduleReports();

        this.emit('started', { competitorCount: this.competitors.size });
        console.log(`[CompetitorSentinel] Monitoring ${this.competitors.size} competitors`);
    }

    /**
     * Create a competitor profile from a URL.
     */
    private createProfileFromUrl(url: string): CompetitorProfile {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

        return {
            id: crypto.randomUUID(),
            name,
            domain,
            urls: [url],
            socialProfiles: [],
            monitoringConfig: { ...this.config.defaultMonitoringConfig },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    /**
     * Start monitoring a single competitor.
     */
    private async startCompetitorMonitoring(competitor: CompetitorProfile): Promise<void> {
        const config = competitor.monitoringConfig;

        // Website monitoring with visual diff
        if (config.enableVisualDiff) {
            await this.websiteMonitor.startMonitoring(competitor, async (snapshot) => {
                await this.handleNewSnapshot(competitor, snapshot);
            });
        }

        // Price tracking
        if (config.enablePriceTracking && competitor.pricingPageUrl) {
            const priceInterval = setInterval(async () => {
                await this.checkPricing(competitor);
            }, config.priceCheckInterval);

            this.monitorIntervals.set(`${competitor.id}:pricing`, priceInterval);

            // Initial check
            await this.checkPricing(competitor);
        }

        // Product tracking
        if (config.enableProductTracking && competitor.productPageUrl) {
            const productInterval = setInterval(async () => {
                await this.checkProducts(competitor);
            }, config.priceCheckInterval);

            this.monitorIntervals.set(`${competitor.id}:products`, productInterval);

            // Initial check
            await this.checkProducts(competitor);
        }

        // Social media monitoring
        if (config.enableSocialMonitoring && competitor.socialProfiles.length > 0) {
            const socialInterval = setInterval(async () => {
                await this.checkSocialMedia(competitor);
            }, config.socialCheckInterval);

            this.monitorIntervals.set(`${competitor.id}:social`, socialInterval);

            // Initial check
            await this.checkSocialMedia(competitor);
        }
    }

    /**
     * Handle a new snapshot and check for changes.
     */
    private async handleNewSnapshot(competitor: CompetitorProfile, snapshot: Snapshot): Promise<void> {
        const snapshotKey = `${competitor.id}:${snapshot.url}`;
        const previousSnapshot = this.previousSnapshots.get(snapshotKey);

        if (previousSnapshot) {
            // Compare snapshots
            const diff = await this.visualDiffEngine.compare(previousSnapshot, snapshot);

            if (this.visualDiffEngine.isSignificant(diff)) {
                const changeType = this.visualDiffEngine.categorizeChange(diff);
                const severity = this.determineSeverity(diff.diffPercentage);

                // Record change
                await this.changeHistory.recordChange({
                    competitorId: competitor.id,
                    changeType,
                    severity,
                    title: `Visual change detected on ${competitor.name}`,
                    description: `${diff.diffPercentage.toFixed(1)}% visual difference detected on ${snapshot.url}`,
                    beforeState: previousSnapshot.hash,
                    afterState: snapshot.hash,
                    metadata: {
                        url: snapshot.url,
                        diffPercentage: diff.diffPercentage,
                        changedRegions: diff.changedRegions.length,
                    },
                    detectedAt: new Date(),
                });

                // Create alert
                await this.alertSystem.createAlert({
                    competitorId: competitor.id,
                    competitorName: competitor.name,
                    type: changeType,
                    severity,
                    title: `Visual change on ${competitor.name}`,
                    description: `Detected ${diff.diffPercentage.toFixed(1)}% visual change`,
                    details: { diff },
                    url: snapshot.url,
                });

                this.emit('visual_change', { competitor, diff });
            }
        }

        // Update previous snapshot
        this.previousSnapshots.set(snapshotKey, snapshot);
    }

    /**
     * Check competitor pricing.
     */
    private async checkPricing(competitor: CompetitorProfile): Promise<void> {
        if (!competitor.pricingPageUrl) return;

        try {
            // Fetch pricing page
            const response = await fetch(competitor.pricingPageUrl, {
                headers: { 'User-Agent': 'CompetitorSentinel/1.0' },
            });

            if (!response.ok) return;

            const html = await response.text();

            // Extract prices
            const currentPrices = await this.priceTracker.extractPrices(
                competitor.id,
                competitor.pricingPageUrl,
                html
            );

            // Get previous prices
            const previousPrices = this.previousPrices.get(competitor.id) || [];

            // Detect changes
            const changes = this.priceTracker.detectChanges(competitor.id, currentPrices, previousPrices);

            for (const change of changes) {
                const severity = this.determinePricingSeverity(change);

                // Record change
                await this.changeHistory.recordChange({
                    competitorId: competitor.id,
                    changeType: 'pricing',
                    severity,
                    title: `Price ${change.changeType} for ${change.productName}`,
                    description: `${change.previousPrice} -> ${change.newPrice} ${change.currency} (${change.changePercentage > 0 ? '+' : ''}${change.changePercentage.toFixed(1)}%)`,
                    beforeState: String(change.previousPrice),
                    afterState: String(change.newPrice),
                    metadata: change,
                    detectedAt: new Date(),
                });

                // Create alert
                await this.alertSystem.createAlert({
                    competitorId: competitor.id,
                    competitorName: competitor.name,
                    type: 'pricing',
                    severity,
                    title: `${competitor.name}: Price ${change.changeType}`,
                    description: `${change.productName}: ${change.currency}${change.previousPrice} -> ${change.currency}${change.newPrice}`,
                    details: change,
                    url: competitor.pricingPageUrl,
                });

                this.emit('price_change', { competitor, change });
            }

            // Update previous prices
            this.previousPrices.set(competitor.id, currentPrices);
        } catch (error) {
            console.error(`[CompetitorSentinel] Price check failed for ${competitor.name}:`, error);
        }
    }

    /**
     * Check competitor products.
     */
    private async checkProducts(competitor: CompetitorProfile): Promise<void> {
        if (!competitor.productPageUrl) return;

        try {
            const response = await fetch(competitor.productPageUrl, {
                headers: { 'User-Agent': 'CompetitorSentinel/1.0' },
            });

            if (!response.ok) return;

            const html = await response.text();

            // Extract products
            const currentProducts = await this.productTracker.extractProducts(
                competitor.id,
                competitor.productPageUrl,
                html
            );

            // Detect changes
            const changes = this.productTracker.detectChanges(competitor.id, currentProducts);

            for (const change of changes) {
                const severity: ChangeSeverity = change.changeType === 'added' ? 'high' : 'medium';

                // Record change
                await this.changeHistory.recordChange({
                    competitorId: competitor.id,
                    changeType: 'product',
                    severity,
                    title: `Product ${change.changeType}: ${change.productName}`,
                    description: `${change.changeType === 'added' ? 'New' : change.changeType === 'removed' ? 'Removed' : 'Updated'} product detected`,
                    metadata: change,
                    detectedAt: new Date(),
                });

                // Create alert for significant changes
                if (change.changeType === 'added' || change.changeType === 'removed') {
                    await this.alertSystem.createAlert({
                        competitorId: competitor.id,
                        competitorName: competitor.name,
                        type: 'product',
                        severity,
                        title: `${competitor.name}: Product ${change.changeType}`,
                        description: change.productName,
                        details: change,
                        url: competitor.productPageUrl,
                    });
                }

                this.emit('product_change', { competitor, change });
            }
        } catch (error) {
            console.error(`[CompetitorSentinel] Product check failed for ${competitor.name}:`, error);
        }
    }

    /**
     * Check competitor social media.
     */
    private async checkSocialMedia(competitor: CompetitorProfile): Promise<void> {
        if (competitor.socialProfiles.length === 0) return;

        try {
            const { posts, metrics } = await this.socialMonitor.monitor(competitor);

            // Analyze activity
            const activity = this.socialMonitor.analyzeActivity(competitor.id);

            // Alert on significant activity spikes
            if (activity.activityTrend === 'increasing' && activity.totalPosts > 10) {
                await this.alertSystem.createAlert({
                    competitorId: competitor.id,
                    competitorName: competitor.name,
                    type: 'social',
                    severity: 'low',
                    title: `${competitor.name}: Increased social activity`,
                    description: `${activity.totalPosts} posts detected, activity trending up`,
                    details: activity,
                });
            }

            // Record high-engagement posts
            for (const post of posts) {
                const engagementScore = post.engagement.likes + post.engagement.shares * 2;
                if (engagementScore > 1000) {
                    await this.changeHistory.recordChange({
                        competitorId: competitor.id,
                        changeType: 'social',
                        severity: 'low',
                        title: `High-engagement post on ${post.platform}`,
                        description: post.content.substring(0, 100),
                        metadata: post,
                        detectedAt: new Date(),
                    });
                }
            }

            this.emit('social_update', { competitor, posts, metrics, activity });
        } catch (error) {
            console.error(`[CompetitorSentinel] Social check failed for ${competitor.name}:`, error);
        }
    }

    /**
     * Schedule weekly reports.
     */
    private scheduleReports(): void {
        if (!this.config.reportSchedule.weekly) return;

        const now = new Date();
        const targetDay = this.config.reportSchedule.dayOfWeek ?? 1;
        const targetHour = this.config.reportSchedule.hourOfDay ?? 9;

        // Calculate time until next report
        const daysUntilTarget = (targetDay - now.getDay() + 7) % 7 || 7;
        const nextReport = new Date(now);
        nextReport.setDate(nextReport.getDate() + daysUntilTarget);
        nextReport.setHours(targetHour, 0, 0, 0);

        const timeUntilReport = nextReport.getTime() - now.getTime();

        // Schedule first report
        setTimeout(() => {
            this.generateWeeklyReport();

            // Then schedule weekly
            this.reportInterval = setInterval(() => {
                this.generateWeeklyReport();
            }, 7 * 24 * 60 * 60 * 1000);
        }, timeUntilReport);

        console.log(`[CompetitorSentinel] Weekly reports scheduled for ${nextReport.toISOString()}`);
    }

    /**
     * Generate a weekly competitive intelligence report.
     */
    async generateWeeklyReport(): Promise<IntelligenceReport> {
        const periodEnd = new Date();
        const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

        const competitors = Array.from(this.competitors.values());

        // Gather all data
        const priceChanges: PriceChange[] = [];
        const productChanges: ProductChange[] = [];
        const visualChanges: VisualDiff[] = [];
        const socialPosts: SocialPost[] = [];

        for (const competitor of competitors) {
            // Get price changes
            const history = await this.changeHistory.getHistory({
                competitorId: competitor.id,
                changeType: 'pricing',
                startDate: periodStart,
                endDate: periodEnd,
            });

            for (const record of history) {
                if (record.metadata) {
                    priceChanges.push(record.metadata as PriceChange);
                }
            }

            // Get social posts
            const posts = this.socialMonitor.getRecentPosts(competitor.id);
            socialPosts.push(...posts.filter(
                p => p.postedAt >= periodStart && p.postedAt <= periodEnd
            ));
        }

        // Generate report
        const report = await this.reportGenerator.generateReport({
            competitors,
            periodStart,
            periodEnd,
            priceChanges,
            productChanges,
            visualChanges,
            socialPosts,
            alerts: this.alertSystem.getAlertHistory({ limit: 100 }),
            reportType: 'weekly',
        });

        this.emit('report_generated', report);
        console.log(`[CompetitorSentinel] Weekly report generated: ${report.id}`);

        return report;
    }

    /**
     * Determine severity based on diff percentage.
     */
    private determineSeverity(diffPercentage: number): ChangeSeverity {
        if (diffPercentage >= 50) return 'critical';
        if (diffPercentage >= 30) return 'high';
        if (diffPercentage >= 15) return 'medium';
        return 'low';
    }

    /**
     * Determine severity for pricing changes.
     */
    private determinePricingSeverity(change: PriceChange): ChangeSeverity {
        const absChange = Math.abs(change.changePercentage);

        if (change.changeType === 'new' || change.changeType === 'removed') {
            return 'high';
        }

        if (absChange >= 30) return 'critical';
        if (absChange >= 15) return 'high';
        if (absChange >= 5) return 'medium';
        return 'low';
    }

    /**
     * Add a competitor to monitor.
     */
    addCompetitor(profile: CompetitorProfile): void {
        this.competitors.set(profile.id, profile);

        if (this.isRunning) {
            this.startCompetitorMonitoring(profile);
        }

        this.emit('competitor_added', profile);
    }

    /**
     * Remove a competitor from monitoring.
     */
    removeCompetitor(competitorId: string): void {
        const competitor = this.competitors.get(competitorId);
        if (!competitor) return;

        // Stop monitoring
        this.websiteMonitor.stopMonitoring(competitor);

        // Clear intervals
        for (const [key, interval] of this.monitorIntervals) {
            if (key.startsWith(`${competitorId}:`)) {
                clearInterval(interval);
                this.monitorIntervals.delete(key);
            }
        }

        this.competitors.delete(competitorId);
        this.emit('competitor_removed', competitorId);
    }

    /**
     * Get all competitors.
     */
    getCompetitors(): CompetitorProfile[] {
        return Array.from(this.competitors.values());
    }

    /**
     * Get a specific competitor.
     */
    getCompetitor(competitorId: string): CompetitorProfile | undefined {
        return this.competitors.get(competitorId);
    }

    /**
     * Get change history.
     */
    async getChangeHistory(options?: Parameters<ChangeHistory['getHistory']>[0]): Promise<ChangeRecord[]> {
        return this.changeHistory.getHistory(options || {});
    }

    /**
     * Get active alerts.
     */
    getAlerts(competitorId?: string): CompetitorAlert[] {
        return this.alertSystem.getActiveAlerts(competitorId);
    }

    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
        return this.alertSystem.acknowledgeAlert(alertId, acknowledgedBy);
    }

    /**
     * Get service status.
     */
    getStatus(): {
        isRunning: boolean;
        competitorCount: number;
        activeMonitors: number;
        pendingAlerts: number;
    } {
        return {
            isRunning: this.isRunning,
            competitorCount: this.competitors.size,
            activeMonitors: this.websiteMonitor.getStatus().activeMonitors,
            pendingAlerts: this.alertSystem.getActiveAlerts().length,
        };
    }

    /**
     * Stop all monitoring.
     */
    stop(): void {
        console.log('[CompetitorSentinel] Stopping competitive monitoring...');

        // Stop website monitors
        this.websiteMonitor.stopAll();

        // Clear all intervals
        for (const interval of this.monitorIntervals.values()) {
            clearInterval(interval);
        }
        this.monitorIntervals.clear();

        // Clear report interval
        if (this.reportInterval) {
            clearInterval(this.reportInterval);
            this.reportInterval = null;
        }

        this.isRunning = false;
        this.emit('stopped');
        console.log('[CompetitorSentinel] Monitoring stopped');
    }

    /**
     * Get component instances for advanced usage.
     */
    getComponents(): {
        websiteMonitor: WebsiteMonitor;
        visualDiffEngine: VisualDiffEngine;
        priceTracker: PriceTracker;
        productTracker: ProductCatalogTracker;
        socialMonitor: SocialMediaMonitor;
        alertSystem: CompetitorAlertSystem;
        reportGenerator: ReportGenerator;
        changeHistory: ChangeHistory;
    } {
        return {
            websiteMonitor: this.websiteMonitor,
            visualDiffEngine: this.visualDiffEngine,
            priceTracker: this.priceTracker,
            productTracker: this.productTracker,
            socialMonitor: this.socialMonitor,
            alertSystem: this.alertSystem,
            reportGenerator: this.reportGenerator,
            changeHistory: this.changeHistory,
        };
    }
}

// ============================================================================
// Factory function and singleton
// ============================================================================

let competitorSentinelInstance: CompetitorSentinel | null = null;

/**
 * Create a CompetitorSentinel instance with the provided configuration.
 */
export function createCompetitorSentinel(config?: Partial<CompetitorSentinelConfig>): CompetitorSentinel {
    return new CompetitorSentinel(config);
}

/**
 * Get or create a singleton CompetitorSentinel instance.
 */
export function getCompetitorSentinel(config?: Partial<CompetitorSentinelConfig>): CompetitorSentinel {
    if (!competitorSentinelInstance) {
        competitorSentinelInstance = new CompetitorSentinel(config);
    }
    return competitorSentinelInstance;
}

export default CompetitorSentinel;
