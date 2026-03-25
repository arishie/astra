import { EventEmitter } from 'events';
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
    screenshotInterval: number;
    domSnapshotInterval: number;
    priceCheckInterval: number;
    socialCheckInterval: number;
    enableVisualDiff: boolean;
    enablePriceTracking: boolean;
    enableProductTracking: boolean;
    enableSocialMonitoring: boolean;
    diffThreshold: number;
}
export interface Snapshot {
    id: string;
    competitorId: string;
    url: string;
    type: 'screenshot' | 'dom' | 'html';
    data: string;
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
    diffImageData?: string;
    analyzedAt: Date;
}
export interface DiffRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    changeType: 'added' | 'removed' | 'modified';
    significance: number;
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
    changes?: Record<string, {
        before: any;
        after: any;
    }>;
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
        dayOfWeek?: number;
        hourOfDay?: number;
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
export declare class WebsiteMonitor {
    private config;
    private activeMonitors;
    private snapshotCache;
    constructor(config: CompetitorSentinelConfig);
    /**
     * Start monitoring a competitor's website.
     */
    startMonitoring(competitor: CompetitorProfile, onSnapshot: (snapshot: Snapshot) => void): Promise<void>;
    /**
     * Stop monitoring a competitor's website.
     */
    stopMonitoring(competitor: CompetitorProfile): void;
    /**
     * Capture a snapshot of a URL.
     */
    captureSnapshot(competitorId: string, url: string): Promise<Snapshot | null>;
    /**
     * Capture a screenshot of a URL.
     */
    private captureScreenshot;
    /**
     * Capture screenshot using external API.
     */
    private captureWithScreenshotApi;
    /**
     * Capture screenshot using Browserless.
     */
    private captureWithBrowserless;
    /**
     * Simulate screenshot capture for development.
     */
    private simulateScreenshotCapture;
    /**
     * Capture DOM content of a URL.
     */
    private captureDom;
    /**
     * Get the latest cached snapshot for a URL.
     */
    getLatestSnapshot(competitorId: string, url: string): Snapshot | undefined;
    /**
     * Hash content for comparison.
     */
    private hashContent;
    /**
     * Stop all monitors.
     */
    stopAll(): void;
    /**
     * Get monitoring status.
     */
    getStatus(): {
        activeMonitors: number;
        urls: string[];
    };
}
export declare class VisualDiffEngine {
    private diffThreshold;
    constructor(diffThreshold?: number);
    /**
     * Compare two snapshots and detect visual differences.
     */
    compare(before: Snapshot, after: Snapshot): Promise<VisualDiff>;
    /**
     * Calculate the difference percentage between two snapshots.
     */
    private calculateDiffPercentage;
    /**
     * Calculate similarity ratio between two strings.
     */
    private calculateSimilarity;
    /**
     * Identify regions that changed between snapshots.
     */
    private identifyChangedRegions;
    /**
     * Generate a diff image highlighting changes.
     */
    private generateDiffImage;
    /**
     * Check if a diff exceeds the threshold.
     */
    isSignificant(diff: VisualDiff): boolean;
    /**
     * Categorize the change based on diff characteristics.
     */
    categorizeChange(diff: VisualDiff): ChangeType;
    /**
     * Set the diff threshold.
     */
    setThreshold(threshold: number): void;
}
export declare class PriceTracker {
    private priceHistory;
    private pricePatterns;
    constructor();
    /**
     * Initialize regex patterns for price extraction.
     */
    private initializePricePatterns;
    /**
     * Extract prices from HTML content.
     */
    extractPrices(competitorId: string, url: string, htmlContent: string): Promise<PriceData[]>;
    /**
     * Find pricing-related sections in HTML.
     */
    private findPricingSections;
    /**
     * Extract prices from a pricing section.
     */
    private extractPricesFromSection;
    /**
     * Extract all prices from text content.
     */
    private extractAllPrices;
    /**
     * Create a PriceData object.
     */
    private createPriceData;
    /**
     * Detect billing cycle from price context.
     */
    private detectBillingCycle;
    /**
     * Strip HTML tags from content.
     */
    private stripHtml;
    /**
     * Compare prices and detect changes.
     */
    detectChanges(competitorId: string, currentPrices: PriceData[], previousPrices: PriceData[]): PriceChange[];
    /**
     * Get price history for a product.
     */
    getPriceHistory(competitorId: string, productName: string): PriceData[];
    /**
     * Get all current prices for a competitor.
     */
    getCurrentPrices(competitorId: string): PriceData[];
    /**
     * Clear price history.
     */
    clearHistory(): void;
}
export declare class ProductCatalogTracker {
    private productCatalogs;
    private productPatterns;
    constructor();
    /**
     * Initialize patterns for product extraction.
     */
    private initializeProductPatterns;
    /**
     * Extract products from HTML content.
     */
    extractProducts(competitorId: string, url: string, htmlContent: string): Promise<ProductEntry[]>;
    /**
     * Find product containers in HTML.
     */
    private findProductContainers;
    /**
     * Parse a product container into a ProductEntry.
     */
    private parseProductContainer;
    /**
     * Generate a stable product ID from name.
     */
    private generateProductId;
    /**
     * Extract features from product container.
     */
    private extractFeatures;
    /**
     * Resolve a relative URL to absolute.
     */
    private resolveUrl;
    /**
     * Detect product changes.
     */
    detectChanges(competitorId: string, currentProducts: ProductEntry[]): ProductChange[];
    /**
     * Detect modifications between two product entries.
     */
    private detectModifications;
    /**
     * Get product catalog for a competitor.
     */
    getCatalog(competitorId: string): ProductEntry[];
    /**
     * Get active products for a competitor.
     */
    getActiveProducts(competitorId: string): ProductEntry[];
    /**
     * Clear catalog for a competitor.
     */
    clearCatalog(competitorId: string): void;
}
export declare class SocialMediaMonitor {
    private socialData;
    private metricsHistory;
    private apiConfigs;
    constructor();
    /**
     * Configure API credentials for a platform.
     */
    configureApi(platform: SocialPlatform, config: {
        apiKey?: string;
        accessToken?: string;
    }): void;
    /**
     * Monitor social profiles for a competitor.
     */
    monitor(competitor: CompetitorProfile): Promise<{
        posts: SocialPost[];
        metrics: SocialMetrics[];
    }>;
    /**
     * Fetch posts from a social platform.
     */
    private fetchPosts;
    /**
     * Fetch Twitter posts.
     */
    private fetchTwitterPosts;
    /**
     * Fetch LinkedIn posts.
     */
    private fetchLinkedInPosts;
    /**
     * Fetch Facebook posts.
     */
    private fetchFacebookPosts;
    /**
     * Fetch Instagram posts.
     */
    private fetchInstagramPosts;
    /**
     * Fetch YouTube posts/videos.
     */
    private fetchYouTubePosts;
    /**
     * Generate mock posts for development.
     */
    private generateMockPosts;
    /**
     * Fetch metrics for a social profile.
     */
    private fetchMetrics;
    /**
     * Get recent posts for a competitor.
     */
    getRecentPosts(competitorId: string, platform?: SocialPlatform): SocialPost[];
    /**
     * Get metrics history for a competitor.
     */
    getMetricsHistory(competitorId: string, platform: SocialPlatform): SocialMetrics[];
    /**
     * Analyze social activity trends.
     */
    analyzeActivity(competitorId: string): {
        totalPosts: number;
        avgEngagement: number;
        topPlatform: SocialPlatform | null;
        sentiment: number;
        activityTrend: 'increasing' | 'stable' | 'decreasing';
    };
    /**
     * Clear social data.
     */
    clearData(): void;
}
export declare class CompetitorAlertSystem extends EventEmitter {
    private alerts;
    private channelConfigs;
    private alertHistory;
    private maxHistorySize;
    constructor(channelConfigs?: AlertChannelConfig[]);
    /**
     * Create and dispatch an alert.
     */
    createAlert(params: {
        competitorId: string;
        competitorName: string;
        type: ChangeType;
        severity: ChangeSeverity;
        title: string;
        description: string;
        details?: Record<string, any>;
        url?: string;
    }): Promise<CompetitorAlert>;
    /**
     * Dispatch alert to configured channels.
     */
    private dispatchAlert;
    /**
     * Send alert to a specific channel.
     */
    private sendToChannel;
    /**
     * Send email alert.
     */
    private sendEmail;
    /**
     * Send Slack alert.
     */
    private sendSlack;
    /**
     * Send webhook alert.
     */
    private sendWebhook;
    /**
     * Get severity color for UI/messaging.
     */
    private getSeverityColor;
    /**
     * Add alert to history.
     */
    private addToHistory;
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean;
    /**
     * Get unacknowledged alerts.
     */
    getActiveAlerts(competitorId?: string): CompetitorAlert[];
    /**
     * Get alert history.
     */
    getAlertHistory(options?: {
        competitorId?: string;
        type?: ChangeType;
        severity?: ChangeSeverity;
        limit?: number;
    }): CompetitorAlert[];
    /**
     * Get alert statistics.
     */
    getStats(): {
        total: number;
        active: number;
        byType: Record<ChangeType, number>;
        bySeverity: Record<ChangeSeverity, number>;
    };
    /**
     * Configure alert channels.
     */
    configureChannels(configs: AlertChannelConfig[]): void;
    /**
     * Cleanup old alerts.
     */
    cleanup(maxAgeDays?: number): number;
}
export declare class ReportGenerator {
    private db;
    constructor();
    /**
     * Generate a competitive intelligence report.
     */
    generateReport(params: {
        competitors: CompetitorProfile[];
        periodStart: Date;
        periodEnd: Date;
        priceChanges: PriceChange[];
        productChanges: ProductChange[];
        visualChanges: VisualDiff[];
        socialPosts: SocialPost[];
        alerts: CompetitorAlert[];
        reportType?: 'weekly' | 'monthly' | 'custom';
    }): Promise<IntelligenceReport>;
    /**
     * Generate summary for a single competitor.
     */
    private generateCompetitorSummary;
    /**
     * Select top social posts as highlights.
     */
    private selectSocialHighlights;
    /**
     * Generate key insights from the data.
     */
    private generateKeyInsights;
    /**
     * Generate actionable recommendations.
     */
    private generateRecommendations;
    /**
     * Save report to database.
     */
    private saveReport;
    /**
     * Get historical reports.
     */
    getReports(options?: {
        reportType?: 'weekly' | 'monthly' | 'custom';
        limit?: number;
    }): Promise<IntelligenceReport[]>;
}
export declare class ChangeHistory {
    private db;
    private inMemoryHistory;
    constructor();
    /**
     * Record a change.
     */
    recordChange(change: Omit<ChangeRecord, 'id'>): Promise<ChangeRecord>;
    /**
     * Get change history for a competitor.
     */
    getHistory(options: {
        competitorId?: string;
        changeType?: ChangeType;
        severity?: ChangeSeverity;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<ChangeRecord[]>;
    /**
     * Get history from database.
     */
    private getHistoryFromDb;
    /**
     * Get history from in-memory storage.
     */
    private getHistoryFromMemory;
    /**
     * Get change statistics.
     */
    getStats(competitorId?: string, days?: number): Promise<{
        totalChanges: number;
        byType: Record<ChangeType, number>;
        bySeverity: Record<ChangeSeverity, number>;
        avgChangesPerDay: number;
    }>;
    /**
     * Clear history for a competitor.
     */
    clearHistory(competitorId: string): void;
}
export declare class CompetitorSentinel extends EventEmitter {
    private config;
    private websiteMonitor;
    private visualDiffEngine;
    private priceTracker;
    private productTracker;
    private socialMonitor;
    private alertSystem;
    private reportGenerator;
    private changeHistory;
    private competitors;
    private previousSnapshots;
    private previousPrices;
    private isRunning;
    private monitorIntervals;
    private reportInterval;
    constructor(config?: Partial<CompetitorSentinelConfig>);
    /**
     * Start monitoring competitors.
     */
    monitor(competitorUrls: string[] | CompetitorProfile[]): Promise<void>;
    /**
     * Create a competitor profile from a URL.
     */
    private createProfileFromUrl;
    /**
     * Start monitoring a single competitor.
     */
    private startCompetitorMonitoring;
    /**
     * Handle a new snapshot and check for changes.
     */
    private handleNewSnapshot;
    /**
     * Check competitor pricing.
     */
    private checkPricing;
    /**
     * Check competitor products.
     */
    private checkProducts;
    /**
     * Check competitor social media.
     */
    private checkSocialMedia;
    /**
     * Schedule weekly reports.
     */
    private scheduleReports;
    /**
     * Generate a weekly competitive intelligence report.
     */
    generateWeeklyReport(): Promise<IntelligenceReport>;
    /**
     * Determine severity based on diff percentage.
     */
    private determineSeverity;
    /**
     * Determine severity for pricing changes.
     */
    private determinePricingSeverity;
    /**
     * Add a competitor to monitor.
     */
    addCompetitor(profile: CompetitorProfile): void;
    /**
     * Remove a competitor from monitoring.
     */
    removeCompetitor(competitorId: string): void;
    /**
     * Get all competitors.
     */
    getCompetitors(): CompetitorProfile[];
    /**
     * Get a specific competitor.
     */
    getCompetitor(competitorId: string): CompetitorProfile | undefined;
    /**
     * Get change history.
     */
    getChangeHistory(options?: Parameters<ChangeHistory['getHistory']>[0]): Promise<ChangeRecord[]>;
    /**
     * Get active alerts.
     */
    getAlerts(competitorId?: string): CompetitorAlert[];
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean;
    /**
     * Get service status.
     */
    getStatus(): {
        isRunning: boolean;
        competitorCount: number;
        activeMonitors: number;
        pendingAlerts: number;
    };
    /**
     * Stop all monitoring.
     */
    stop(): void;
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
    };
}
/**
 * Create a CompetitorSentinel instance with the provided configuration.
 */
export declare function createCompetitorSentinel(config?: Partial<CompetitorSentinelConfig>): CompetitorSentinel;
/**
 * Get or create a singleton CompetitorSentinel instance.
 */
export declare function getCompetitorSentinel(config?: Partial<CompetitorSentinelConfig>): CompetitorSentinel;
export default CompetitorSentinel;
//# sourceMappingURL=CompetitorSentinel.d.ts.map