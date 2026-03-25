import { EventEmitter } from 'events';
export type Platform = 'twitter' | 'google_trends' | 'reddit' | 'news';
export type TrendStatus = 'emerging' | 'rising' | 'peaking' | 'declining' | 'stable';
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';
export interface TrendDataPoint {
    timestamp: Date;
    value: number;
    platform: Platform;
    metadata?: Record<string, any>;
}
export interface RawTrendData {
    id: string;
    keyword: string;
    platform: Platform;
    volume: number;
    velocity: number;
    sentiment: number;
    engagementRate: number;
    dataPoints: TrendDataPoint[];
    collectedAt: Date;
    metadata?: Record<string, any>;
}
export interface Trend {
    id: string;
    keyword: string;
    category: string;
    platforms: Platform[];
    status: TrendStatus;
    viralityScore: number;
    velocityScore: number;
    reachScore: number;
    relevanceScore: number;
    sentiment: number;
    volume: number;
    peakPrediction: Date | null;
    confidence: number;
    relatedKeywords: string[];
    dataPoints: TrendDataPoint[];
    firstDetected: Date;
    lastUpdated: Date;
    metadata?: Record<string, any>;
}
export interface TrendAlert {
    id: string;
    trendId: string;
    keyword: string;
    priority: AlertPriority;
    message: string;
    viralityScore: number;
    relevanceScore: number;
    industry: string;
    suggestedActions: string[];
    createdAt: Date;
    expiresAt: Date;
    acknowledged: boolean;
}
export interface ContentIdea {
    id: string;
    trendId: string;
    title: string;
    description: string;
    contentType: 'blog' | 'video' | 'social' | 'podcast' | 'infographic';
    platforms: Platform[];
    keywords: string[];
    targetAudience: string;
    urgency: 'immediate' | 'soon' | 'planned';
    estimatedEngagement: number;
    talkingPoints: string[];
    createdAt: Date;
}
export interface IndustryProfile {
    id: string;
    name: string;
    keywords: string[];
    competitors: string[];
    excludedTerms: string[];
    platforms: Platform[];
    minRelevanceThreshold: number;
}
export interface TrendPrediction {
    trendId: string;
    keyword: string;
    currentScore: number;
    predictedPeakScore: number;
    predictedPeakDate: Date;
    timeToAction: number;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: 'engage_now' | 'prepare' | 'monitor' | 'skip';
}
export interface AnalysisResult {
    trends: Trend[];
    topTrends: Trend[];
    emergingTrends: Trend[];
    predictions: TrendPrediction[];
    alerts: TrendAlert[];
    contentIdeas: ContentIdea[];
    analysisTimestamp: Date;
    dataSourcesUsed: Platform[];
    confidence: number;
}
export interface TrendCollectorConfig {
    twitter?: {
        bearerToken: string;
        maxResults?: number;
    };
    googleTrends?: {
        enabled: boolean;
        region?: string;
    };
    reddit?: {
        clientId: string;
        clientSecret: string;
        subreddits?: string[];
    };
    news?: {
        apiKey: string;
        sources?: string[];
    };
}
export interface TrendPredictorConfig {
    collectorConfig: TrendCollectorConfig;
    analysisInterval: number;
    alertThreshold: number;
    maxTrendsToTrack: number;
    predictionWindowHours: number;
    cacheEnabled: boolean;
    cacheTTL: number;
}
export declare class TrendDataCollector {
    private config;
    private rateLimits;
    private cache;
    constructor(config: TrendCollectorConfig);
    /**
     * Collect trend data from all configured platforms.
     */
    collectAll(keywords?: string[]): Promise<RawTrendData[]>;
    /**
     * Collect data from a specific platform.
     */
    collectFromPlatform(platform: Platform, keywords?: string[]): Promise<RawTrendData[]>;
    /**
     * Collect trending topics from Twitter/X API.
     */
    private collectFromTwitter;
    /**
     * Fetch trending topics from Twitter API.
     */
    private fetchTwitterTrends;
    /**
     * Collect data from Google Trends.
     */
    private collectFromGoogleTrends;
    /**
     * Fetch daily trending searches from Google Trends.
     */
    private fetchGoogleDailyTrends;
    /**
     * Collect trending topics from Reddit.
     */
    private collectFromReddit;
    /**
     * Fetch hot posts from a subreddit.
     */
    private fetchRedditHot;
    /**
     * Collect trending news topics.
     */
    private collectFromNews;
    /**
     * Fetch news articles.
     */
    private fetchNewsArticles;
    /**
     * Calculate velocity from data points (rate of change).
     */
    private calculateVelocity;
    /**
     * Extract main topic from article title.
     */
    private extractMainTopic;
    /**
     * Calculate average sentiment from articles.
     */
    private calculateAverageSentiment;
    /**
     * Update rate limit tracking.
     */
    private updateRateLimit;
    /**
     * Clear cached data.
     */
    clearCache(): void;
    private generateMockTwitterTrends;
    private generateMockGoogleTrends;
    private generateMockRedditPosts;
    private generateMockNewsArticles;
}
export declare class TrendAnalyzer {
    private historicalData;
    constructor();
    /**
     * Analyze raw trend data and identify patterns.
     */
    analyze(rawData: RawTrendData[]): Trend[];
    /**
     * Analyze a single trend across all its data sources.
     */
    private analyzeTrend;
    /**
     * Calculate momentum from data points.
     */
    private calculateMomentum;
    /**
     * Determine trend status based on momentum and velocity.
     */
    private determineTrendStatus;
    /**
     * Infer category from keyword.
     */
    private inferCategory;
    /**
     * Predict when trend will peak.
     */
    private predictPeak;
    /**
     * Calculate confidence score.
     */
    private calculateConfidence;
    /**
     * Find related keywords from metadata.
     */
    private findRelatedKeywords;
    /**
     * Normalize a value to 0-100 score.
     */
    private normalizeScore;
    /**
     * Normalize keyword for matching.
     */
    private normalizeKeyword;
    /**
     * Get historical data for a keyword.
     */
    getHistoricalData(keyword: string): TrendDataPoint[];
    /**
     * Clear historical data.
     */
    clearHistory(): void;
}
export declare class ViralityScorer {
    private weights;
    constructor();
    /**
     * Calculate virality score for a trend.
     */
    score(trend: Trend): number;
    /**
     * Score multiple trends.
     */
    scoreAll(trends: Trend[]): Trend[];
    /**
     * Get detailed score breakdown.
     */
    getScoreBreakdown(trend: Trend): Record<string, number>;
    /**
     * Calculate velocity component score.
     */
    private calculateVelocityScore;
    /**
     * Calculate reach component score.
     */
    private calculateReachScore;
    /**
     * Calculate sentiment component score.
     */
    private calculateSentimentScore;
    /**
     * Calculate cross-platform presence score.
     */
    private calculateCrossPlatformScore;
    /**
     * Calculate momentum score from data points.
     */
    private calculateMomentumScore;
    /**
     * Calculate freshness score.
     */
    private calculateFreshnessScore;
    /**
     * Update scoring weights.
     */
    setWeights(weights: Partial<typeof this.weights>): void;
}
export declare class IndustryMatcher {
    private industryProfiles;
    private defaultKeywords;
    constructor();
    /**
     * Initialize default industry keywords.
     */
    private initializeDefaultKeywords;
    /**
     * Register a custom industry profile.
     */
    registerProfile(profile: IndustryProfile): void;
    /**
     * Get or create industry profile.
     */
    getProfile(industryId: string): IndustryProfile | null;
    /**
     * Calculate relevance score for a trend to an industry.
     */
    calculateRelevance(trend: Trend, industryId: string): number;
    /**
     * Filter trends by industry relevance.
     */
    filterByIndustry(trends: Trend[], industryId: string, minRelevance?: number): Trend[];
    /**
     * Find best matching industries for a trend.
     */
    findMatchingIndustries(trend: Trend, topN?: number): Array<{
        industryId: string;
        relevance: number;
    }>;
    /**
     * List available industries.
     */
    listIndustries(): string[];
}
export declare class AlertSystem extends EventEmitter {
    private alerts;
    private userSubscriptions;
    private alertHistory;
    private maxHistorySize;
    constructor();
    /**
     * Subscribe a user to trend alerts.
     */
    subscribe(userId: string, options: {
        industryIds: string[];
        minViralityScore?: number;
        platforms?: Platform[];
    }): void;
    /**
     * Unsubscribe a user from alerts.
     */
    unsubscribe(userId: string): void;
    /**
     * Toggle user subscription.
     */
    toggleSubscription(userId: string, enabled: boolean): void;
    /**
     * Generate alerts from analyzed trends.
     */
    generateAlerts(trends: Trend[], industryMatcher: IndustryMatcher): TrendAlert[];
    /**
     * Create an alert from a trend.
     */
    private createAlert;
    /**
     * Determine alert priority.
     */
    private determinePriority;
    /**
     * Generate alert message.
     */
    private generateAlertMessage;
    /**
     * Generate suggested actions based on trend and priority.
     */
    private generateSuggestedActions;
    /**
     * Check if alert is duplicate.
     */
    private isDuplicateAlert;
    /**
     * Add alert to history.
     */
    private addToHistory;
    /**
     * Get active alerts for a user.
     */
    getActiveAlerts(userId?: string): TrendAlert[];
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string): boolean;
    /**
     * Dismiss an alert.
     */
    dismissAlert(alertId: string): boolean;
    /**
     * Get alert statistics.
     */
    getStats(): {
        totalAlerts: number;
        activeAlerts: number;
        byPriority: Record<AlertPriority, number>;
        acknowledgedRate: number;
    };
    /**
     * Cleanup expired alerts.
     */
    cleanup(): number;
}
export declare class ContentSuggester {
    private templates;
    constructor();
    /**
     * Initialize content templates by type.
     */
    private initializeTemplates;
    /**
     * Generate content ideas from trends.
     */
    generateIdeas(trends: Trend[], options?: {
        industry?: string;
        contentTypes?: ContentIdea['contentType'][];
        maxIdeasPerTrend?: number;
        targetAudience?: string;
    }): ContentIdea[];
    /**
     * Generate ideas for a single trend.
     */
    private generateIdeasForTrend;
    /**
     * Determine content urgency based on trend status.
     */
    private determineUrgency;
    /**
     * Select best content types for a trend.
     */
    private selectBestContentTypes;
    /**
     * Select best template based on trend characteristics.
     */
    private selectTemplate;
    /**
     * Fill template with values.
     */
    private fillTemplate;
    /**
     * Generate description for content idea.
     */
    private generateDescription;
    /**
     * Recommend platforms for content distribution.
     */
    private recommendPlatforms;
    /**
     * Estimate engagement potential.
     */
    private estimateEngagement;
    /**
     * Generate talking points for content.
     */
    private generateTalkingPoints;
    /**
     * Get content ideas by type.
     */
    filterByType(ideas: ContentIdea[], contentType: ContentIdea['contentType']): ContentIdea[];
    /**
     * Get urgent content ideas.
     */
    getUrgentIdeas(ideas: ContentIdea[]): ContentIdea[];
}
export declare class TrendPredictor extends EventEmitter {
    private config;
    private collector;
    private analyzer;
    private scorer;
    private industryMatcher;
    private alertSystem;
    private contentSuggester;
    private trends;
    private analysisInterval;
    private lastAnalysis;
    private isRunning;
    constructor(config: TrendPredictorConfig);
    /**
     * Start automated trend analysis.
     */
    start(): void;
    /**
     * Stop automated trend analysis.
     */
    stop(): void;
    /**
     * Run a single analysis cycle.
     */
    private runAnalysis;
    /**
     * Analyze trends across all platforms.
     */
    analyze(keywords?: string[]): Promise<AnalysisResult>;
    /**
     * Generate predictions for trends.
     */
    predict(trendIds?: string[]): TrendPrediction[];
    /**
     * Generate predictions for a list of trends.
     */
    private generatePredictions;
    /**
     * Predict a single trend.
     */
    private predictTrend;
    /**
     * Calculate growth rate from data points.
     */
    private calculateGrowthRate;
    /**
     * Estimate hours until peak.
     */
    private estimateHoursToPeak;
    /**
     * Assess risk level for engaging with trend.
     */
    private assessRisk;
    /**
     * Generate engagement recommendation.
     */
    private generateRecommendation;
    /**
     * Get trending topics filtered by industry.
     */
    getTrendsByIndustry(industryId: string, minRelevance?: number): Trend[];
    /**
     * Get content suggestions for an industry.
     */
    getContentSuggestions(industryId: string, options?: {
        contentTypes?: ContentIdea['contentType'][];
        maxIdeas?: number;
    }): ContentIdea[];
    /**
     * Subscribe to alerts.
     */
    subscribeToAlerts(userId: string, options: {
        industryIds: string[];
        minViralityScore?: number;
        platforms?: Platform[];
    }): void;
    /**
     * Unsubscribe from alerts.
     */
    unsubscribeFromAlerts(userId: string): void;
    /**
     * Get active alerts.
     */
    getAlerts(userId?: string): TrendAlert[];
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string): boolean;
    /**
     * Register custom industry profile.
     */
    registerIndustry(profile: IndustryProfile): void;
    /**
     * Get available industries.
     */
    getIndustries(): string[];
    /**
     * Get a specific trend by ID.
     */
    getTrend(trendId: string): Trend | undefined;
    /**
     * Get all tracked trends.
     */
    getAllTrends(): Trend[];
    /**
     * Get service status.
     */
    getStatus(): {
        isRunning: boolean;
        lastAnalysis: Date | null;
        trackedTrends: number;
        activeAlerts: number;
        industries: string[];
    };
    /**
     * Force refresh trend data.
     */
    refresh(): Promise<AnalysisResult>;
    /**
     * Get component instances for advanced usage.
     */
    getComponents(): {
        collector: TrendDataCollector;
        analyzer: TrendAnalyzer;
        scorer: ViralityScorer;
        industryMatcher: IndustryMatcher;
        alertSystem: AlertSystem;
        contentSuggester: ContentSuggester;
    };
}
/**
 * Create a TrendPredictor instance with the provided configuration.
 */
export declare function createTrendPredictor(config: TrendPredictorConfig): TrendPredictor;
/**
 * Get or create a singleton TrendPredictor instance.
 */
export declare function getTrendPredictor(config?: TrendPredictorConfig): TrendPredictor;
export default TrendPredictor;
//# sourceMappingURL=TrendPredictor.d.ts.map