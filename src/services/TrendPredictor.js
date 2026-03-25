// @ts-nocheck
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
// ============================================================================
// TrendDataCollector - Gathers data from multiple sources
// ============================================================================
export class TrendDataCollector {
    config;
    rateLimits;
    cache;
    constructor(config) {
        this.config = config;
        this.rateLimits = new Map();
        this.cache = new Map();
    }
    /**
     * Collect trend data from all configured platforms.
     */
    async collectAll(keywords) {
        const results = [];
        const platforms = [];
        if (this.config.twitter?.bearerToken)
            platforms.push('twitter');
        if (this.config.googleTrends?.enabled)
            platforms.push('google_trends');
        if (this.config.reddit?.clientId)
            platforms.push('reddit');
        if (this.config.news?.apiKey)
            platforms.push('news');
        const collectionPromises = platforms.map(async (platform) => {
            try {
                const data = await this.collectFromPlatform(platform, keywords);
                return data;
            }
            catch (error) {
                console.error(`[TrendDataCollector] Error collecting from ${platform}:`, error);
                return [];
            }
        });
        const platformResults = await Promise.allSettled(collectionPromises);
        for (const result of platformResults) {
            if (result.status === 'fulfilled') {
                results.push(...result.value);
            }
        }
        return results;
    }
    /**
     * Collect data from a specific platform.
     */
    async collectFromPlatform(platform, keywords) {
        // Check cache first
        const cacheKey = `${platform}:${keywords?.join(',') || 'trending'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > new Date()) {
            return cached.data;
        }
        // Check rate limits
        const rateLimit = this.rateLimits.get(platform);
        if (rateLimit && rateLimit.remaining <= 0 && rateLimit.resetAt > new Date()) {
            console.warn(`[TrendDataCollector] Rate limited for ${platform} until ${rateLimit.resetAt}`);
            return [];
        }
        let data;
        switch (platform) {
            case 'twitter':
                data = await this.collectFromTwitter(keywords);
                break;
            case 'google_trends':
                data = await this.collectFromGoogleTrends(keywords);
                break;
            case 'reddit':
                data = await this.collectFromReddit(keywords);
                break;
            case 'news':
                data = await this.collectFromNews(keywords);
                break;
            default:
                data = [];
        }
        // Cache results
        this.cache.set(cacheKey, {
            data,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minute cache
        });
        return data;
    }
    /**
     * Collect trending topics from Twitter/X API.
     */
    async collectFromTwitter(keywords) {
        if (!this.config.twitter?.bearerToken) {
            return [];
        }
        const results = [];
        const now = new Date();
        try {
            // Simulate Twitter API call structure
            // In production, this would use the actual Twitter API v2
            const trendingTopics = await this.fetchTwitterTrends();
            for (const topic of trendingTopics) {
                const dataPoints = [];
                // Generate historical data points for trend analysis
                for (let i = 24; i >= 0; i--) {
                    dataPoints.push({
                        timestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
                        value: topic.tweetVolume * (0.5 + Math.random() * 0.5),
                        platform: 'twitter',
                    });
                }
                results.push({
                    id: crypto.randomUUID(),
                    keyword: topic.name,
                    platform: 'twitter',
                    volume: topic.tweetVolume || 0,
                    velocity: this.calculateVelocity(dataPoints),
                    sentiment: topic.sentiment || 0,
                    engagementRate: topic.engagementRate || 0,
                    dataPoints,
                    collectedAt: now,
                    metadata: {
                        query: topic.query,
                        url: topic.url,
                    },
                });
            }
            this.updateRateLimit('twitter', 15, new Date(Date.now() + 15 * 60 * 1000));
        }
        catch (error) {
            console.error('[TrendDataCollector] Twitter collection failed:', error);
        }
        return results;
    }
    /**
     * Fetch trending topics from Twitter API.
     */
    async fetchTwitterTrends() {
        // In production, implement actual Twitter API v2 call:
        // GET /2/trends/place/:id
        // Headers: Authorization: Bearer ${this.config.twitter.bearerToken}
        // For now, return simulated data structure
        return this.generateMockTwitterTrends();
    }
    /**
     * Collect data from Google Trends.
     */
    async collectFromGoogleTrends(keywords) {
        if (!this.config.googleTrends?.enabled) {
            return [];
        }
        const results = [];
        const now = new Date();
        const region = this.config.googleTrends.region || 'US';
        try {
            // Fetch daily trending searches
            const dailyTrends = await this.fetchGoogleDailyTrends(region);
            for (const trend of dailyTrends) {
                const dataPoints = [];
                // Build time series from Google's data
                for (let i = 7; i >= 0; i--) {
                    dataPoints.push({
                        timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
                        value: trend.trafficVolume * (0.3 + Math.random() * 0.7),
                        platform: 'google_trends',
                    });
                }
                results.push({
                    id: crypto.randomUUID(),
                    keyword: trend.title,
                    platform: 'google_trends',
                    volume: trend.trafficVolume,
                    velocity: this.calculateVelocity(dataPoints),
                    sentiment: 0, // Google Trends doesn't provide sentiment
                    engagementRate: 0,
                    dataPoints,
                    collectedAt: now,
                    metadata: {
                        formattedTraffic: trend.formattedTraffic,
                        relatedQueries: trend.relatedQueries,
                        articles: trend.articles,
                    },
                });
            }
        }
        catch (error) {
            console.error('[TrendDataCollector] Google Trends collection failed:', error);
        }
        return results;
    }
    /**
     * Fetch daily trending searches from Google Trends.
     */
    async fetchGoogleDailyTrends(region) {
        // In production, use google-trends-api or unofficial API
        // https://trends.google.com/trends/api/dailytrends
        return this.generateMockGoogleTrends();
    }
    /**
     * Collect trending topics from Reddit.
     */
    async collectFromReddit(keywords) {
        if (!this.config.reddit?.clientId || !this.config.reddit?.clientSecret) {
            return [];
        }
        const results = [];
        const now = new Date();
        const subreddits = this.config.reddit.subreddits || ['all', 'popular'];
        try {
            for (const subreddit of subreddits) {
                const posts = await this.fetchRedditHot(subreddit);
                for (const post of posts) {
                    const dataPoints = [];
                    // Build engagement timeline
                    for (let i = 24; i >= 0; i--) {
                        dataPoints.push({
                            timestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
                            value: post.score * (i / 24),
                            platform: 'reddit',
                        });
                    }
                    results.push({
                        id: crypto.randomUUID(),
                        keyword: post.title.split(' ').slice(0, 5).join(' '),
                        platform: 'reddit',
                        volume: post.numComments,
                        velocity: this.calculateVelocity(dataPoints),
                        sentiment: post.upvoteRatio * 2 - 1, // Convert 0-1 to -1 to 1
                        engagementRate: post.numComments / Math.max(post.score, 1),
                        dataPoints,
                        collectedAt: now,
                        metadata: {
                            subreddit: post.subreddit,
                            url: post.url,
                            score: post.score,
                            awards: post.awards,
                        },
                    });
                }
            }
            this.updateRateLimit('reddit', 60, new Date(Date.now() + 60 * 1000));
        }
        catch (error) {
            console.error('[TrendDataCollector] Reddit collection failed:', error);
        }
        return results;
    }
    /**
     * Fetch hot posts from a subreddit.
     */
    async fetchRedditHot(subreddit) {
        // In production, implement Reddit OAuth and use:
        // GET https://oauth.reddit.com/r/{subreddit}/hot
        // Headers: Authorization: Bearer ${accessToken}
        return this.generateMockRedditPosts(subreddit);
    }
    /**
     * Collect trending news topics.
     */
    async collectFromNews(keywords) {
        if (!this.config.news?.apiKey) {
            return [];
        }
        const results = [];
        const now = new Date();
        try {
            const articles = await this.fetchNewsArticles(keywords);
            // Aggregate articles by topic/keyword
            const topicMap = new Map();
            for (const article of articles) {
                const topic = this.extractMainTopic(article.title);
                if (!topicMap.has(topic)) {
                    topicMap.set(topic, { articles: [], totalEngagement: 0 });
                }
                const entry = topicMap.get(topic);
                entry.articles.push(article);
                entry.totalEngagement += article.engagement || 0;
            }
            for (const [topic, data] of topicMap) {
                const dataPoints = [];
                for (let i = 24; i >= 0; i--) {
                    dataPoints.push({
                        timestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
                        value: data.totalEngagement * (Math.random() * 0.5 + 0.5),
                        platform: 'news',
                    });
                }
                results.push({
                    id: crypto.randomUUID(),
                    keyword: topic,
                    platform: 'news',
                    volume: data.articles.length,
                    velocity: this.calculateVelocity(dataPoints),
                    sentiment: this.calculateAverageSentiment(data.articles),
                    engagementRate: data.totalEngagement / data.articles.length,
                    dataPoints,
                    collectedAt: now,
                    metadata: {
                        articleCount: data.articles.length,
                        sources: data.articles.map(a => a.source),
                    },
                });
            }
            this.updateRateLimit('news', 100, new Date(Date.now() + 60 * 60 * 1000));
        }
        catch (error) {
            console.error('[TrendDataCollector] News collection failed:', error);
        }
        return results;
    }
    /**
     * Fetch news articles.
     */
    async fetchNewsArticles(keywords) {
        // In production, implement NewsAPI or similar:
        // GET https://newsapi.org/v2/top-headlines
        // Headers: X-Api-Key: ${this.config.news.apiKey}
        return this.generateMockNewsArticles(keywords);
    }
    /**
     * Calculate velocity from data points (rate of change).
     */
    calculateVelocity(dataPoints) {
        if (dataPoints.length < 2)
            return 0;
        const sorted = dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const recentPoints = sorted.slice(-6); // Last 6 data points
        if (recentPoints.length < 2)
            return 0;
        let totalChange = 0;
        for (let i = 1; i < recentPoints.length; i++) {
            const change = (recentPoints[i].value - recentPoints[i - 1].value) / Math.max(recentPoints[i - 1].value, 1);
            totalChange += change;
        }
        return totalChange / (recentPoints.length - 1);
    }
    /**
     * Extract main topic from article title.
     */
    extractMainTopic(title) {
        // Simple extraction - in production use NLP
        const words = title.split(/\s+/).slice(0, 4);
        return words.join(' ');
    }
    /**
     * Calculate average sentiment from articles.
     */
    calculateAverageSentiment(articles) {
        if (articles.length === 0)
            return 0;
        const sum = articles.reduce((acc, a) => acc + a.sentiment, 0);
        return sum / articles.length;
    }
    /**
     * Update rate limit tracking.
     */
    updateRateLimit(platform, remaining, resetAt) {
        this.rateLimits.set(platform, { remaining, resetAt });
    }
    /**
     * Clear cached data.
     */
    clearCache() {
        this.cache.clear();
    }
    // Mock data generators for development/testing
    generateMockTwitterTrends() {
        const topics = [
            'AI Revolution', 'Climate Summit', 'Tech Layoffs', 'Crypto Rally',
            'SpaceX Launch', 'Gaming News', 'Health Tips', 'Remote Work',
            'Startup Funding', 'Electric Vehicles',
        ];
        return topics.map(name => ({
            name,
            query: name.toLowerCase().replace(/\s/g, '+'),
            url: `https://twitter.com/search?q=${encodeURIComponent(name)}`,
            tweetVolume: Math.floor(Math.random() * 100000) + 10000,
            sentiment: Math.random() * 2 - 1,
            engagementRate: Math.random() * 0.1,
        }));
    }
    generateMockGoogleTrends() {
        const trends = [
            'Artificial Intelligence', 'Sustainable Energy', 'Digital Marketing',
            'Blockchain Technology', 'Machine Learning', 'Data Science',
            'Cloud Computing', 'Cybersecurity', 'Fintech', 'EdTech',
        ];
        return trends.map(title => ({
            title,
            trafficVolume: Math.floor(Math.random() * 500000) + 50000,
            formattedTraffic: `${Math.floor(Math.random() * 500) + 50}K+`,
            relatedQueries: [
                `${title} trends`,
                `${title} 2024`,
                `best ${title}`,
            ],
            articles: [
                { title: `Latest ${title} developments`, url: 'https://example.com/1' },
                { title: `How ${title} is changing`, url: 'https://example.com/2' },
            ],
        }));
    }
    generateMockRedditPosts(subreddit) {
        const titles = [
            'Breaking: Major tech announcement today',
            'Discussion: Future of remote work',
            'Analysis: Market trends for 2024',
            'Opinion: Why this matters for everyone',
            'Guide: How to stay ahead of trends',
        ];
        return titles.map(title => ({
            title,
            subreddit,
            url: `https://reddit.com/r/${subreddit}/comments/abc123`,
            score: Math.floor(Math.random() * 50000) + 1000,
            numComments: Math.floor(Math.random() * 5000) + 100,
            upvoteRatio: 0.7 + Math.random() * 0.25,
            awards: Math.floor(Math.random() * 20),
        }));
    }
    generateMockNewsArticles(keywords) {
        const sources = ['TechCrunch', 'Wired', 'The Verge', 'Bloomberg', 'Reuters'];
        const topics = keywords || ['technology', 'business', 'innovation'];
        return topics.flatMap(topic => sources.map(source => ({
            title: `${topic}: Latest developments and insights`,
            description: `Comprehensive coverage of ${topic} from ${source}`,
            source,
            url: `https://${source.toLowerCase().replace(/\s/g, '')}.com/article`,
            publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
            engagement: Math.floor(Math.random() * 10000),
            sentiment: Math.random() * 2 - 1,
        })));
    }
}
// ============================================================================
// TrendAnalyzer - Identifies patterns and momentum
// ============================================================================
export class TrendAnalyzer {
    historicalData;
    constructor() {
        this.historicalData = new Map();
    }
    /**
     * Analyze raw trend data and identify patterns.
     */
    analyze(rawData) {
        const trends = [];
        const keywordMap = new Map();
        // Group by keyword (normalize)
        for (const data of rawData) {
            const normalizedKeyword = this.normalizeKeyword(data.keyword);
            if (!keywordMap.has(normalizedKeyword)) {
                keywordMap.set(normalizedKeyword, []);
            }
            keywordMap.get(normalizedKeyword).push(data);
        }
        // Analyze each keyword across platforms
        for (const [keyword, dataList] of keywordMap) {
            const trend = this.analyzeTrend(keyword, dataList);
            if (trend) {
                trends.push(trend);
            }
        }
        // Sort by virality score
        return trends.sort((a, b) => b.viralityScore - a.viralityScore);
    }
    /**
     * Analyze a single trend across all its data sources.
     */
    analyzeTrend(keyword, dataList) {
        if (dataList.length === 0)
            return null;
        const now = new Date();
        const allDataPoints = [];
        const platforms = new Set();
        let totalVolume = 0;
        let totalSentiment = 0;
        let totalVelocity = 0;
        let totalEngagement = 0;
        for (const data of dataList) {
            platforms.add(data.platform);
            allDataPoints.push(...data.dataPoints);
            totalVolume += data.volume;
            totalSentiment += data.sentiment;
            totalVelocity += data.velocity;
            totalEngagement += data.engagementRate;
        }
        const avgSentiment = totalSentiment / dataList.length;
        const avgVelocity = totalVelocity / dataList.length;
        // Store historical data for future analysis
        const existingHistory = this.historicalData.get(keyword) || [];
        this.historicalData.set(keyword, [...existingHistory, ...allDataPoints].slice(-100));
        // Calculate momentum and pattern
        const momentum = this.calculateMomentum(allDataPoints);
        const status = this.determineTrendStatus(momentum, avgVelocity);
        const category = this.inferCategory(keyword);
        // Calculate component scores
        const velocityScore = this.normalizeScore(avgVelocity, -1, 1);
        const reachScore = this.normalizeScore(totalVolume, 0, 1000000);
        const relevanceScore = 50; // Base score, adjusted by IndustryMatcher
        // Peak prediction
        const peakPrediction = this.predictPeak(allDataPoints, status);
        const confidence = this.calculateConfidence(dataList.length, platforms.size, allDataPoints.length);
        // Find related keywords
        const relatedKeywords = this.findRelatedKeywords(keyword, dataList);
        return {
            id: crypto.randomUUID(),
            keyword,
            category,
            platforms: Array.from(platforms),
            status,
            viralityScore: 0, // Set by ViralityScorer
            velocityScore,
            reachScore,
            relevanceScore,
            sentiment: avgSentiment,
            volume: totalVolume,
            peakPrediction,
            confidence,
            relatedKeywords,
            dataPoints: allDataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
            firstDetected: new Date(Math.min(...allDataPoints.map(d => d.timestamp.getTime()))),
            lastUpdated: now,
        };
    }
    /**
     * Calculate momentum from data points.
     */
    calculateMomentum(dataPoints) {
        if (dataPoints.length < 3)
            return 0;
        const sorted = dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const recent = sorted.slice(-10);
        // Calculate weighted momentum (more recent = higher weight)
        let momentum = 0;
        let weight = 0;
        for (let i = 1; i < recent.length; i++) {
            const change = (recent[i].value - recent[i - 1].value) / Math.max(recent[i - 1].value, 1);
            const w = i / recent.length;
            momentum += change * w;
            weight += w;
        }
        return weight > 0 ? momentum / weight : 0;
    }
    /**
     * Determine trend status based on momentum and velocity.
     */
    determineTrendStatus(momentum, velocity) {
        const combined = momentum * 0.6 + velocity * 0.4;
        if (combined > 0.3)
            return 'emerging';
        if (combined > 0.1)
            return 'rising';
        if (combined > -0.1)
            return 'peaking';
        if (combined > -0.3)
            return 'declining';
        return 'stable';
    }
    /**
     * Infer category from keyword.
     */
    inferCategory(keyword) {
        const categories = {
            'technology': ['ai', 'tech', 'software', 'app', 'digital', 'cloud', 'data', 'cyber'],
            'business': ['startup', 'funding', 'market', 'investment', 'company', 'ceo'],
            'finance': ['crypto', 'bitcoin', 'stock', 'trading', 'bank', 'fintech'],
            'health': ['health', 'medical', 'covid', 'vaccine', 'fitness', 'wellness'],
            'entertainment': ['gaming', 'movie', 'music', 'streaming', 'celebrity'],
            'politics': ['election', 'government', 'policy', 'vote', 'congress'],
            'science': ['research', 'space', 'climate', 'energy', 'nasa'],
        };
        const lowerKeyword = keyword.toLowerCase();
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(k => lowerKeyword.includes(k))) {
                return category;
            }
        }
        return 'general';
    }
    /**
     * Predict when trend will peak.
     */
    predictPeak(dataPoints, status) {
        if (status === 'declining' || status === 'stable') {
            return null;
        }
        const now = new Date();
        // Simple prediction based on status
        switch (status) {
            case 'emerging':
                return new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
            case 'rising':
                return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
            case 'peaking':
                return new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
            default:
                return null;
        }
    }
    /**
     * Calculate confidence score.
     */
    calculateConfidence(dataSourceCount, platformCount, dataPointCount) {
        const sourceConfidence = Math.min(dataSourceCount / 5, 1) * 30;
        const platformConfidence = Math.min(platformCount / 4, 1) * 30;
        const dataConfidence = Math.min(dataPointCount / 50, 1) * 40;
        return Math.round(sourceConfidence + platformConfidence + dataConfidence);
    }
    /**
     * Find related keywords from metadata.
     */
    findRelatedKeywords(keyword, dataList) {
        const related = new Set();
        for (const data of dataList) {
            if (data.metadata?.relatedQueries) {
                for (const query of data.metadata.relatedQueries) {
                    if (query.toLowerCase() !== keyword.toLowerCase()) {
                        related.add(query);
                    }
                }
            }
        }
        return Array.from(related).slice(0, 10);
    }
    /**
     * Normalize a value to 0-100 score.
     */
    normalizeScore(value, min, max) {
        const normalized = (value - min) / (max - min);
        return Math.round(Math.max(0, Math.min(100, normalized * 100)));
    }
    /**
     * Normalize keyword for matching.
     */
    normalizeKeyword(keyword) {
        return keyword.toLowerCase().trim().replace(/[^\w\s]/g, '');
    }
    /**
     * Get historical data for a keyword.
     */
    getHistoricalData(keyword) {
        return this.historicalData.get(this.normalizeKeyword(keyword)) || [];
    }
    /**
     * Clear historical data.
     */
    clearHistory() {
        this.historicalData.clear();
    }
}
// ============================================================================
// ViralityScorer - Predicts trend potential (0-100)
// ============================================================================
export class ViralityScorer {
    weights;
    constructor() {
        this.weights = {
            velocity: 0.25,
            reach: 0.20,
            sentiment: 0.10,
            crossPlatform: 0.15,
            momentum: 0.20,
            freshness: 0.10,
        };
    }
    /**
     * Calculate virality score for a trend.
     */
    score(trend) {
        const velocityScore = this.calculateVelocityScore(trend);
        const reachScore = this.calculateReachScore(trend);
        const sentimentScore = this.calculateSentimentScore(trend);
        const crossPlatformScore = this.calculateCrossPlatformScore(trend);
        const momentumScore = this.calculateMomentumScore(trend);
        const freshnessScore = this.calculateFreshnessScore(trend);
        const weightedScore = velocityScore * this.weights.velocity +
            reachScore * this.weights.reach +
            sentimentScore * this.weights.sentiment +
            crossPlatformScore * this.weights.crossPlatform +
            momentumScore * this.weights.momentum +
            freshnessScore * this.weights.freshness;
        return Math.round(Math.max(0, Math.min(100, weightedScore)));
    }
    /**
     * Score multiple trends.
     */
    scoreAll(trends) {
        return trends.map(trend => ({
            ...trend,
            viralityScore: this.score(trend),
        }));
    }
    /**
     * Get detailed score breakdown.
     */
    getScoreBreakdown(trend) {
        return {
            velocity: Math.round(this.calculateVelocityScore(trend)),
            reach: Math.round(this.calculateReachScore(trend)),
            sentiment: Math.round(this.calculateSentimentScore(trend)),
            crossPlatform: Math.round(this.calculateCrossPlatformScore(trend)),
            momentum: Math.round(this.calculateMomentumScore(trend)),
            freshness: Math.round(this.calculateFreshnessScore(trend)),
            total: this.score(trend),
        };
    }
    /**
     * Calculate velocity component score.
     */
    calculateVelocityScore(trend) {
        // Higher velocity = faster growth = higher score
        // Velocity ranges roughly from -1 to 1
        return ((trend.velocityScore / 100) + 1) * 50;
    }
    /**
     * Calculate reach component score.
     */
    calculateReachScore(trend) {
        // Volume-based scoring with logarithmic scaling
        const logVolume = Math.log10(Math.max(trend.volume, 1));
        return Math.min(logVolume / 6 * 100, 100); // 6 = log10(1,000,000)
    }
    /**
     * Calculate sentiment component score.
     */
    calculateSentimentScore(trend) {
        // Positive sentiment boosts score, but even negative sentiment indicates engagement
        // Sentiment ranges from -1 to 1
        const absEngagement = Math.abs(trend.sentiment);
        const positivityBonus = trend.sentiment > 0 ? 20 : 0;
        return absEngagement * 80 + positivityBonus;
    }
    /**
     * Calculate cross-platform presence score.
     */
    calculateCrossPlatformScore(trend) {
        // More platforms = higher virality potential
        const platformCount = trend.platforms.length;
        const maxPlatforms = 4; // twitter, google_trends, reddit, news
        return (platformCount / maxPlatforms) * 100;
    }
    /**
     * Calculate momentum score from data points.
     */
    calculateMomentumScore(trend) {
        const dataPoints = trend.dataPoints;
        if (dataPoints.length < 3)
            return 50;
        // Calculate recent growth rate
        const sorted = dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const recent = sorted.slice(-5);
        if (recent.length < 2)
            return 50;
        const firstVal = recent[0].value;
        const lastVal = recent[recent.length - 1].value;
        const growthRate = firstVal > 0 ? (lastVal - firstVal) / firstVal : 0;
        // Map growth rate to score (0% = 50, 100% = 100, -50% = 0)
        return Math.max(0, Math.min(100, 50 + growthRate * 50));
    }
    /**
     * Calculate freshness score.
     */
    calculateFreshnessScore(trend) {
        const now = new Date();
        const hoursSinceDetected = (now.getTime() - trend.firstDetected.getTime()) / (1000 * 60 * 60);
        // New trends (< 6 hours) get high freshness score
        // Older trends get lower scores
        if (hoursSinceDetected < 6)
            return 100;
        if (hoursSinceDetected < 24)
            return 80;
        if (hoursSinceDetected < 72)
            return 50;
        return 20;
    }
    /**
     * Update scoring weights.
     */
    setWeights(weights) {
        this.weights = { ...this.weights, ...weights };
        // Normalize weights to sum to 1
        const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
        for (const key of Object.keys(this.weights)) {
            this.weights[key] = this.weights[key] / sum;
        }
    }
}
// ============================================================================
// IndustryMatcher - Filters trends by user's business category
// ============================================================================
export class IndustryMatcher {
    industryProfiles;
    defaultKeywords;
    constructor() {
        this.industryProfiles = new Map();
        this.defaultKeywords = this.initializeDefaultKeywords();
    }
    /**
     * Initialize default industry keywords.
     */
    initializeDefaultKeywords() {
        const keywords = new Map();
        keywords.set('technology', [
            'ai', 'artificial intelligence', 'machine learning', 'software', 'saas',
            'cloud', 'devops', 'api', 'startup', 'tech', 'programming', 'developer',
            'digital transformation', 'automation', 'cybersecurity', 'data science',
        ]);
        keywords.set('finance', [
            'fintech', 'banking', 'investment', 'crypto', 'cryptocurrency', 'bitcoin',
            'trading', 'stock market', 'venture capital', 'funding', 'ipo', 'blockchain',
            'defi', 'nft', 'payment', 'insurance', 'wealth management',
        ]);
        keywords.set('healthcare', [
            'healthtech', 'medical', 'biotech', 'pharma', 'clinical', 'patient care',
            'telemedicine', 'health insurance', 'medical device', 'fda', 'drug development',
            'mental health', 'wellness', 'fitness', 'nutrition',
        ]);
        keywords.set('ecommerce', [
            'retail', 'shopping', 'marketplace', 'dtc', 'direct to consumer',
            'supply chain', 'fulfillment', 'shopify', 'amazon', 'dropshipping',
            'product', 'customer experience', 'conversion', 'checkout',
        ]);
        keywords.set('marketing', [
            'digital marketing', 'social media', 'seo', 'content marketing',
            'advertising', 'brand', 'influencer', 'campaign', 'analytics',
            'customer acquisition', 'growth hacking', 'engagement', 'viral',
        ]);
        keywords.set('education', [
            'edtech', 'learning', 'online course', 'e-learning', 'training',
            'university', 'student', 'certification', 'skill development',
            'tutoring', 'educational technology', 'lms', 'mooc',
        ]);
        keywords.set('media', [
            'streaming', 'content', 'video', 'podcast', 'news', 'journalism',
            'entertainment', 'gaming', 'esports', 'creator economy',
            'subscription', 'publishing', 'media company',
        ]);
        return keywords;
    }
    /**
     * Register a custom industry profile.
     */
    registerProfile(profile) {
        this.industryProfiles.set(profile.id, profile);
    }
    /**
     * Get or create industry profile.
     */
    getProfile(industryId) {
        // Check custom profiles first
        if (this.industryProfiles.has(industryId)) {
            return this.industryProfiles.get(industryId);
        }
        // Check default industries
        const defaultKeywords = this.defaultKeywords.get(industryId);
        if (defaultKeywords) {
            return {
                id: industryId,
                name: industryId.charAt(0).toUpperCase() + industryId.slice(1),
                keywords: defaultKeywords,
                competitors: [],
                excludedTerms: [],
                platforms: ['twitter', 'google_trends', 'reddit', 'news'],
                minRelevanceThreshold: 30,
            };
        }
        return null;
    }
    /**
     * Calculate relevance score for a trend to an industry.
     */
    calculateRelevance(trend, industryId) {
        const profile = this.getProfile(industryId);
        if (!profile)
            return 0;
        const trendText = `${trend.keyword} ${trend.relatedKeywords.join(' ')} ${trend.category}`.toLowerCase();
        let matchScore = 0;
        let totalWeight = 0;
        // Check keyword matches
        for (const keyword of profile.keywords) {
            const weight = keyword.length > 10 ? 2 : 1; // Longer keywords = more specific
            if (trendText.includes(keyword.toLowerCase())) {
                matchScore += 10 * weight;
            }
            totalWeight += weight;
        }
        // Penalize excluded terms
        for (const excluded of profile.excludedTerms) {
            if (trendText.includes(excluded.toLowerCase())) {
                matchScore -= 20;
            }
        }
        // Category match bonus
        if (trend.category === industryId) {
            matchScore += 30;
        }
        // Normalize to 0-100
        const normalizedScore = totalWeight > 0
            ? (matchScore / totalWeight) * 10
            : matchScore;
        return Math.max(0, Math.min(100, normalizedScore));
    }
    /**
     * Filter trends by industry relevance.
     */
    filterByIndustry(trends, industryId, minRelevance) {
        const profile = this.getProfile(industryId);
        const threshold = minRelevance ?? profile?.minRelevanceThreshold ?? 30;
        return trends
            .map(trend => ({
            ...trend,
            relevanceScore: this.calculateRelevance(trend, industryId),
        }))
            .filter(trend => trend.relevanceScore >= threshold)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    /**
     * Find best matching industries for a trend.
     */
    findMatchingIndustries(trend, topN = 3) {
        const results = [];
        // Check all default industries
        for (const industryId of this.defaultKeywords.keys()) {
            const relevance = this.calculateRelevance(trend, industryId);
            if (relevance > 0) {
                results.push({ industryId, relevance });
            }
        }
        // Check custom profiles
        for (const profile of this.industryProfiles.values()) {
            if (!this.defaultKeywords.has(profile.id)) {
                const relevance = this.calculateRelevance(trend, profile.id);
                if (relevance > 0) {
                    results.push({ industryId: profile.id, relevance });
                }
            }
        }
        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, topN);
    }
    /**
     * List available industries.
     */
    listIndustries() {
        const industries = new Set();
        for (const id of this.defaultKeywords.keys()) {
            industries.add(id);
        }
        for (const profile of this.industryProfiles.values()) {
            industries.add(profile.id);
        }
        return Array.from(industries);
    }
}
// ============================================================================
// AlertSystem - Notifies users of relevant emerging trends
// ============================================================================
export class AlertSystem extends EventEmitter {
    alerts;
    userSubscriptions;
    alertHistory;
    maxHistorySize;
    constructor() {
        super();
        this.alerts = new Map();
        this.userSubscriptions = new Map();
        this.alertHistory = [];
        this.maxHistorySize = 1000;
    }
    /**
     * Subscribe a user to trend alerts.
     */
    subscribe(userId, options) {
        this.userSubscriptions.set(userId, {
            industryIds: options.industryIds,
            minViralityScore: options.minViralityScore ?? 60,
            platforms: options.platforms ?? ['twitter', 'google_trends', 'reddit', 'news'],
            enabled: true,
        });
    }
    /**
     * Unsubscribe a user from alerts.
     */
    unsubscribe(userId) {
        this.userSubscriptions.delete(userId);
    }
    /**
     * Toggle user subscription.
     */
    toggleSubscription(userId, enabled) {
        const sub = this.userSubscriptions.get(userId);
        if (sub) {
            sub.enabled = enabled;
        }
    }
    /**
     * Generate alerts from analyzed trends.
     */
    generateAlerts(trends, industryMatcher) {
        const newAlerts = [];
        const now = new Date();
        for (const [userId, subscription] of this.userSubscriptions) {
            if (!subscription.enabled)
                continue;
            for (const trend of trends) {
                // Check virality threshold
                if (trend.viralityScore < subscription.minViralityScore)
                    continue;
                // Check platform match
                const hasMatchingPlatform = trend.platforms.some(p => subscription.platforms.includes(p));
                if (!hasMatchingPlatform)
                    continue;
                // Check industry relevance
                for (const industryId of subscription.industryIds) {
                    const relevance = industryMatcher.calculateRelevance(trend, industryId);
                    if (relevance >= 30) {
                        const alert = this.createAlert(trend, industryId, relevance);
                        // Avoid duplicate alerts
                        if (!this.isDuplicateAlert(alert)) {
                            newAlerts.push(alert);
                            this.alerts.set(alert.id, alert);
                            this.addToHistory(alert);
                            // Emit event for real-time notifications
                            this.emit('alert', { userId, alert });
                        }
                    }
                }
            }
        }
        return newAlerts;
    }
    /**
     * Create an alert from a trend.
     */
    createAlert(trend, industry, relevance) {
        const priority = this.determinePriority(trend.viralityScore, relevance);
        return {
            id: crypto.randomUUID(),
            trendId: trend.id,
            keyword: trend.keyword,
            priority,
            message: this.generateAlertMessage(trend, priority),
            viralityScore: trend.viralityScore,
            relevanceScore: relevance,
            industry,
            suggestedActions: this.generateSuggestedActions(trend, priority),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            acknowledged: false,
        };
    }
    /**
     * Determine alert priority.
     */
    determinePriority(viralityScore, relevance) {
        const combinedScore = viralityScore * 0.6 + relevance * 0.4;
        if (combinedScore >= 85)
            return 'critical';
        if (combinedScore >= 70)
            return 'high';
        if (combinedScore >= 50)
            return 'medium';
        return 'low';
    }
    /**
     * Generate alert message.
     */
    generateAlertMessage(trend, priority) {
        const urgencyWord = {
            critical: 'URGENT',
            high: 'Important',
            medium: 'Notable',
            low: 'FYI',
        }[priority];
        const statusWord = {
            emerging: 'emerging',
            rising: 'rapidly growing',
            peaking: 'peaking right now',
            declining: 'declining',
            stable: 'steady',
        }[trend.status];
        return `${urgencyWord}: "${trend.keyword}" is ${statusWord} with virality score ${trend.viralityScore}/100. ` +
            `Detected across ${trend.platforms.length} platform(s).`;
    }
    /**
     * Generate suggested actions based on trend and priority.
     */
    generateSuggestedActions(trend, priority) {
        const actions = [];
        if (priority === 'critical' || priority === 'high') {
            actions.push('Create content immediately to capitalize on trend');
            actions.push('Schedule social media posts within the next 2 hours');
        }
        if (trend.status === 'emerging') {
            actions.push('Monitor trend closely for the next 24 hours');
            actions.push('Prepare content assets for quick deployment');
        }
        if (trend.status === 'rising') {
            actions.push('Publish content within the next 6-12 hours');
            actions.push('Engage with existing conversations on social platforms');
        }
        if (trend.status === 'peaking') {
            actions.push('Post content immediately if ready');
            actions.push('Consider paid promotion to maximize reach');
        }
        if (trend.sentiment > 0.5) {
            actions.push('Use positive messaging aligned with trend sentiment');
        }
        else if (trend.sentiment < -0.3) {
            actions.push('Approach with caution - negative sentiment detected');
        }
        return actions.slice(0, 5);
    }
    /**
     * Check if alert is duplicate.
     */
    isDuplicateAlert(alert) {
        const recentAlerts = this.alertHistory.slice(-50);
        return recentAlerts.some(a => a.trendId === alert.trendId &&
            a.industry === alert.industry &&
            Date.now() - a.createdAt.getTime() < 60 * 60 * 1000 // Within 1 hour
        );
    }
    /**
     * Add alert to history.
     */
    addToHistory(alert) {
        this.alertHistory.push(alert);
        if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory = this.alertHistory.slice(-this.maxHistorySize / 2);
        }
    }
    /**
     * Get active alerts for a user.
     */
    getActiveAlerts(userId) {
        const now = new Date();
        const activeAlerts = Array.from(this.alerts.values())
            .filter(a => a.expiresAt > now && !a.acknowledged);
        return activeAlerts.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            return true;
        }
        return false;
    }
    /**
     * Dismiss an alert.
     */
    dismissAlert(alertId) {
        return this.alerts.delete(alertId);
    }
    /**
     * Get alert statistics.
     */
    getStats() {
        const alerts = Array.from(this.alerts.values());
        const now = new Date();
        const active = alerts.filter(a => a.expiresAt > now);
        const byPriority = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        };
        for (const alert of alerts) {
            byPriority[alert.priority]++;
        }
        const acknowledged = alerts.filter(a => a.acknowledged).length;
        return {
            totalAlerts: alerts.length,
            activeAlerts: active.length,
            byPriority,
            acknowledgedRate: alerts.length > 0 ? acknowledged / alerts.length : 0,
        };
    }
    /**
     * Cleanup expired alerts.
     */
    cleanup() {
        const now = new Date();
        let removed = 0;
        for (const [id, alert] of this.alerts) {
            if (alert.expiresAt < now) {
                this.alerts.delete(id);
                removed++;
            }
        }
        return removed;
    }
}
// ============================================================================
// ContentSuggester - Generates content ideas based on trends
// ============================================================================
export class ContentSuggester {
    templates;
    constructor() {
        this.templates = this.initializeTemplates();
    }
    /**
     * Initialize content templates by type.
     */
    initializeTemplates() {
        const templates = new Map();
        templates.set('blog', [
            'The Complete Guide to {keyword}: What You Need to Know',
            '{keyword}: Trends, Insights, and What\'s Next',
            'How {keyword} is Transforming {industry}',
            'Top 10 Things About {keyword} Everyone Should Know',
            '{keyword} Explained: A Deep Dive for {audience}',
            'The Future of {keyword}: Expert Predictions',
            'Why {keyword} Matters More Than Ever in {year}',
        ]);
        templates.set('video', [
            '{keyword} Explained in Under 5 Minutes',
            'Breaking Down {keyword}: What the Experts Are Saying',
            '{keyword} Tutorial: Getting Started Guide',
            'The Truth About {keyword} Nobody Tells You',
            '{keyword} vs Traditional Methods: Which is Better?',
            'Day in the Life: Working with {keyword}',
        ]);
        templates.set('social', [
            'Hot take: {keyword} is changing everything. Here\'s why 🧵',
            '3 things about {keyword} that will blow your mind:',
            'The {keyword} trend is real. Are you paying attention?',
            'Unpopular opinion about {keyword}:',
            '{keyword} update: What we learned this week',
        ]);
        templates.set('podcast', [
            'Episode: The Rise of {keyword} and What It Means for You',
            'Interview: Industry Expert on {keyword} Trends',
            'Debate: Is {keyword} Overhyped or Underrated?',
            'Deep Dive: Understanding {keyword} from the Ground Up',
            'Q&A Special: Your {keyword} Questions Answered',
        ]);
        templates.set('infographic', [
            '{keyword} by the Numbers: Key Statistics',
            'The Evolution of {keyword}: A Visual Timeline',
            '{keyword} Ecosystem: Who\'s Who',
            'How {keyword} Works: A Visual Guide',
            '{keyword} Impact: Before vs After',
        ]);
        return templates;
    }
    /**
     * Generate content ideas from trends.
     */
    generateIdeas(trends, options = {}) {
        const ideas = [];
        const contentTypes = options.contentTypes || ['blog', 'video', 'social', 'podcast', 'infographic'];
        const maxPerTrend = options.maxIdeasPerTrend || 3;
        const audience = options.targetAudience || 'general audience';
        for (const trend of trends) {
            const trendIdeas = this.generateIdeasForTrend(trend, contentTypes, maxPerTrend, audience, options.industry);
            ideas.push(...trendIdeas);
        }
        // Sort by estimated engagement
        return ideas.sort((a, b) => b.estimatedEngagement - a.estimatedEngagement);
    }
    /**
     * Generate ideas for a single trend.
     */
    generateIdeasForTrend(trend, contentTypes, maxIdeas, audience, industry) {
        const ideas = [];
        const year = new Date().getFullYear().toString();
        // Determine urgency based on trend status
        const urgency = this.determineUrgency(trend);
        // Select best content types for this trend
        const bestTypes = this.selectBestContentTypes(trend, contentTypes);
        for (let i = 0; i < Math.min(maxIdeas, bestTypes.length); i++) {
            const contentType = bestTypes[i];
            const templates = this.templates.get(contentType) || [];
            if (templates.length === 0)
                continue;
            // Select template based on trend characteristics
            const template = this.selectTemplate(templates, trend);
            const title = this.fillTemplate(template, {
                keyword: trend.keyword,
                industry: industry || trend.category,
                audience,
                year,
            });
            ideas.push({
                id: crypto.randomUUID(),
                trendId: trend.id,
                title,
                description: this.generateDescription(trend, contentType),
                contentType,
                platforms: this.recommendPlatforms(contentType, trend),
                keywords: [trend.keyword, ...trend.relatedKeywords.slice(0, 5)],
                targetAudience: audience,
                urgency,
                estimatedEngagement: this.estimateEngagement(trend, contentType),
                talkingPoints: this.generateTalkingPoints(trend),
                createdAt: new Date(),
            });
        }
        return ideas;
    }
    /**
     * Determine content urgency based on trend status.
     */
    determineUrgency(trend) {
        if (trend.status === 'emerging' || trend.viralityScore >= 80) {
            return 'immediate';
        }
        if (trend.status === 'rising' || trend.viralityScore >= 60) {
            return 'soon';
        }
        return 'planned';
    }
    /**
     * Select best content types for a trend.
     */
    selectBestContentTypes(trend, availableTypes) {
        // Score each content type based on trend characteristics
        const scores = [];
        for (const type of availableTypes) {
            let score = 50;
            // Emerging/fast trends favor quick content
            if (trend.status === 'emerging' || trend.status === 'rising') {
                if (type === 'social')
                    score += 30;
                if (type === 'video')
                    score += 20;
            }
            // High virality trends deserve comprehensive content
            if (trend.viralityScore >= 70) {
                if (type === 'blog')
                    score += 20;
                if (type === 'podcast')
                    score += 15;
            }
            // Data-heavy trends suit infographics
            if (trend.dataPoints.length > 20) {
                if (type === 'infographic')
                    score += 25;
            }
            // Platform-specific preferences
            if (trend.platforms.includes('twitter')) {
                if (type === 'social')
                    score += 15;
            }
            if (trend.platforms.includes('reddit')) {
                if (type === 'blog')
                    score += 10;
            }
            scores.push({ type, score });
        }
        return scores
            .sort((a, b) => b.score - a.score)
            .map(s => s.type);
    }
    /**
     * Select best template based on trend characteristics.
     */
    selectTemplate(templates, trend) {
        // Simple selection - in production use ML or more sophisticated matching
        const index = Math.abs(trend.keyword.length + trend.viralityScore) % templates.length;
        return templates[index];
    }
    /**
     * Fill template with values.
     */
    fillTemplate(template, values) {
        let result = template;
        for (const [key, value] of Object.entries(values)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return result;
    }
    /**
     * Generate description for content idea.
     */
    generateDescription(trend, contentType) {
        const descriptions = {
            blog: `Create an in-depth article about ${trend.keyword}, covering current trends, implications, and actionable insights for your audience.`,
            video: `Produce an engaging video that explains ${trend.keyword} in an accessible way, leveraging the current momentum around this topic.`,
            social: `Craft timely social media content about ${trend.keyword} to join the conversation and increase engagement with trending discussions.`,
            podcast: `Record a podcast episode diving deep into ${trend.keyword}, featuring expert perspectives or interviews.`,
            infographic: `Design a visual infographic presenting key data and insights about ${trend.keyword} in an easily shareable format.`,
        };
        return descriptions[contentType];
    }
    /**
     * Recommend platforms for content distribution.
     */
    recommendPlatforms(contentType, trend) {
        const platformMap = {
            blog: ['google_trends', 'reddit'],
            video: ['twitter', 'reddit'],
            social: ['twitter', 'reddit'],
            podcast: ['twitter', 'google_trends'],
            infographic: ['twitter', 'reddit'],
        };
        // Include platforms where trend is active
        const recommended = new Set(platformMap[contentType]);
        for (const platform of trend.platforms) {
            recommended.add(platform);
        }
        return Array.from(recommended);
    }
    /**
     * Estimate engagement potential.
     */
    estimateEngagement(trend, contentType) {
        let base = trend.viralityScore;
        // Content type multipliers
        const multipliers = {
            social: 1.2,
            video: 1.1,
            blog: 0.9,
            infographic: 1.0,
            podcast: 0.8,
        };
        base *= multipliers[contentType];
        // Timing multiplier
        if (trend.status === 'emerging')
            base *= 1.3;
        if (trend.status === 'rising')
            base *= 1.2;
        if (trend.status === 'declining')
            base *= 0.7;
        return Math.round(Math.min(100, base));
    }
    /**
     * Generate talking points for content.
     */
    generateTalkingPoints(trend) {
        const points = [];
        points.push(`Current trend status: ${trend.status}`);
        points.push(`Virality score: ${trend.viralityScore}/100`);
        if (trend.sentiment > 0.3) {
            points.push('Overall sentiment is positive - emphasize benefits and opportunities');
        }
        else if (trend.sentiment < -0.3) {
            points.push('Sentiment is mixed/negative - address concerns and provide balanced perspective');
        }
        if (trend.platforms.length > 2) {
            points.push(`Cross-platform trend - tailor message for each platform`);
        }
        if (trend.relatedKeywords.length > 0) {
            points.push(`Related topics to mention: ${trend.relatedKeywords.slice(0, 3).join(', ')}`);
        }
        if (trend.peakPrediction) {
            const hoursToGo = Math.round((trend.peakPrediction.getTime() - Date.now()) / (1000 * 60 * 60));
            points.push(`Estimated time to peak: ${hoursToGo} hours - publish before then for maximum impact`);
        }
        return points;
    }
    /**
     * Get content ideas by type.
     */
    filterByType(ideas, contentType) {
        return ideas.filter(idea => idea.contentType === contentType);
    }
    /**
     * Get urgent content ideas.
     */
    getUrgentIdeas(ideas) {
        return ideas.filter(idea => idea.urgency === 'immediate');
    }
}
// ============================================================================
// TrendPredictor - Main orchestrating class
// ============================================================================
export class TrendPredictor extends EventEmitter {
    config;
    collector;
    analyzer;
    scorer;
    industryMatcher;
    alertSystem;
    contentSuggester;
    trends;
    analysisInterval;
    lastAnalysis;
    isRunning;
    constructor(config) {
        super();
        this.config = config;
        this.collector = new TrendDataCollector(config.collectorConfig);
        this.analyzer = new TrendAnalyzer();
        this.scorer = new ViralityScorer();
        this.industryMatcher = new IndustryMatcher();
        this.alertSystem = new AlertSystem();
        this.contentSuggester = new ContentSuggester();
        this.trends = new Map();
        this.analysisInterval = null;
        this.lastAnalysis = null;
        this.isRunning = false;
        // Forward alert events
        this.alertSystem.on('alert', (data) => {
            this.emit('alert', data);
        });
    }
    /**
     * Start automated trend analysis.
     */
    start() {
        if (this.isRunning) {
            console.warn('[TrendPredictor] Already running');
            return;
        }
        this.isRunning = true;
        console.log('[TrendPredictor] Starting trend analysis service');
        // Run initial analysis
        this.runAnalysis().catch(err => {
            console.error('[TrendPredictor] Initial analysis failed:', err);
        });
        // Schedule periodic analysis
        this.analysisInterval = setInterval(() => {
            this.runAnalysis().catch(err => {
                console.error('[TrendPredictor] Scheduled analysis failed:', err);
            });
        }, this.config.analysisInterval);
        // Periodic cleanup
        setInterval(() => {
            this.alertSystem.cleanup();
        }, 60 * 60 * 1000); // Hourly
        this.emit('started');
    }
    /**
     * Stop automated trend analysis.
     */
    stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        console.log('[TrendPredictor] Stopped trend analysis service');
        this.emit('stopped');
    }
    /**
     * Run a single analysis cycle.
     */
    async runAnalysis() {
        try {
            const result = await this.analyze();
            this.lastAnalysis = new Date();
            this.emit('analysis_complete', result);
        }
        catch (error) {
            console.error('[TrendPredictor] Analysis error:', error);
            this.emit('analysis_error', error);
            throw error;
        }
    }
    /**
     * Analyze trends across all platforms.
     */
    async analyze(keywords) {
        console.log('[TrendPredictor] Starting trend analysis...');
        const startTime = Date.now();
        // Step 1: Collect data from all sources
        const rawData = await this.collector.collectAll(keywords);
        console.log(`[TrendPredictor] Collected ${rawData.length} raw trend data points`);
        // Step 2: Analyze patterns
        let trends = this.analyzer.analyze(rawData);
        console.log(`[TrendPredictor] Identified ${trends.length} trends`);
        // Step 3: Score virality
        trends = this.scorer.scoreAll(trends);
        // Step 4: Filter and store
        trends = trends
            .filter(t => t.viralityScore >= this.config.alertThreshold / 2)
            .slice(0, this.config.maxTrendsToTrack);
        for (const trend of trends) {
            this.trends.set(trend.id, trend);
        }
        // Step 5: Generate predictions
        const predictions = this.generatePredictions(trends);
        // Step 6: Generate alerts
        const alerts = this.alertSystem.generateAlerts(trends, this.industryMatcher);
        // Step 7: Generate content ideas for top trends
        const topTrends = trends.filter(t => t.viralityScore >= 70).slice(0, 10);
        const contentIdeas = this.contentSuggester.generateIdeas(topTrends);
        // Calculate confidence
        const platformsUsed = [...new Set(rawData.map(d => d.platform))];
        const confidence = Math.min(100, platformsUsed.length * 20 + Math.min(rawData.length, 50));
        const duration = Date.now() - startTime;
        console.log(`[TrendPredictor] Analysis completed in ${duration}ms`);
        return {
            trends,
            topTrends,
            emergingTrends: trends.filter(t => t.status === 'emerging'),
            predictions,
            alerts,
            contentIdeas,
            analysisTimestamp: new Date(),
            dataSourcesUsed: platformsUsed,
            confidence,
        };
    }
    /**
     * Generate predictions for trends.
     */
    predict(trendIds) {
        const trendsToPredict = trendIds
            ? trendIds.map(id => this.trends.get(id)).filter(Boolean)
            : Array.from(this.trends.values());
        return this.generatePredictions(trendsToPredict);
    }
    /**
     * Generate predictions for a list of trends.
     */
    generatePredictions(trends) {
        const predictions = [];
        const now = new Date();
        for (const trend of trends) {
            // Skip stable or declining trends
            if (trend.status === 'stable' || trend.status === 'declining') {
                continue;
            }
            const prediction = this.predictTrend(trend, now);
            if (prediction) {
                predictions.push(prediction);
            }
        }
        return predictions.sort((a, b) => b.predictedPeakScore - a.predictedPeakScore);
    }
    /**
     * Predict a single trend.
     */
    predictTrend(trend, now) {
        // Analyze data points for prediction
        const dataPoints = trend.dataPoints;
        if (dataPoints.length < 3) {
            return null;
        }
        // Calculate growth trajectory
        const recentPoints = dataPoints.slice(-10);
        const growthRate = this.calculateGrowthRate(recentPoints);
        // Predict peak score
        const currentScore = trend.viralityScore;
        const predictedPeakScore = Math.min(100, currentScore * (1 + growthRate));
        // Predict peak time
        const hoursToGrow = this.estimateHoursToPeak(trend.status, growthRate);
        const predictedPeakDate = new Date(now.getTime() + hoursToGrow * 60 * 60 * 1000);
        // Calculate optimal engagement window
        const timeToAction = Math.max(0, hoursToGrow - 6); // Engage 6 hours before peak
        // Assess risk
        const riskLevel = this.assessRisk(trend, growthRate);
        // Generate recommendation
        const recommendation = this.generateRecommendation(trend, timeToAction, predictedPeakScore, riskLevel);
        return {
            trendId: trend.id,
            keyword: trend.keyword,
            currentScore,
            predictedPeakScore: Math.round(predictedPeakScore),
            predictedPeakDate,
            timeToAction: Math.round(timeToAction),
            confidence: trend.confidence,
            riskLevel,
            recommendation,
        };
    }
    /**
     * Calculate growth rate from data points.
     */
    calculateGrowthRate(dataPoints) {
        if (dataPoints.length < 2)
            return 0;
        const first = dataPoints[0].value;
        const last = dataPoints[dataPoints.length - 1].value;
        if (first <= 0)
            return 0;
        return (last - first) / first;
    }
    /**
     * Estimate hours until peak.
     */
    estimateHoursToPeak(status, growthRate) {
        const baseHours = {
            emerging: 48,
            rising: 24,
            peaking: 6,
            declining: 0,
            stable: 72,
        }[status];
        // Adjust based on growth rate
        const multiplier = growthRate > 0.5 ? 0.5 : growthRate > 0.2 ? 0.75 : 1;
        return baseHours * multiplier;
    }
    /**
     * Assess risk level for engaging with trend.
     */
    assessRisk(trend, growthRate) {
        // High risk factors
        if (trend.sentiment < -0.5)
            return 'high';
        if (trend.confidence < 30)
            return 'high';
        if (growthRate > 2)
            return 'medium'; // Could be too volatile
        // Medium risk factors
        if (trend.sentiment < 0)
            return 'medium';
        if (trend.platforms.length < 2)
            return 'medium';
        if (growthRate < 0)
            return 'medium';
        return 'low';
    }
    /**
     * Generate engagement recommendation.
     */
    generateRecommendation(trend, timeToAction, predictedScore, riskLevel) {
        if (riskLevel === 'high')
            return 'monitor';
        if (predictedScore >= 80 && timeToAction <= 2) {
            return 'engage_now';
        }
        if (predictedScore >= 60 && timeToAction <= 12) {
            return 'prepare';
        }
        if (predictedScore < 50 || riskLevel === 'medium') {
            return 'monitor';
        }
        return 'prepare';
    }
    /**
     * Get trending topics filtered by industry.
     */
    getTrendsByIndustry(industryId, minRelevance) {
        const allTrends = Array.from(this.trends.values());
        return this.industryMatcher.filterByIndustry(allTrends, industryId, minRelevance);
    }
    /**
     * Get content suggestions for an industry.
     */
    getContentSuggestions(industryId, options) {
        const relevantTrends = this.getTrendsByIndustry(industryId);
        const ideas = this.contentSuggester.generateIdeas(relevantTrends.slice(0, 10), {
            industry: industryId,
            contentTypes: options?.contentTypes,
            maxIdeasPerTrend: 2,
        });
        return ideas.slice(0, options?.maxIdeas || 20);
    }
    /**
     * Subscribe to alerts.
     */
    subscribeToAlerts(userId, options) {
        this.alertSystem.subscribe(userId, options);
    }
    /**
     * Unsubscribe from alerts.
     */
    unsubscribeFromAlerts(userId) {
        this.alertSystem.unsubscribe(userId);
    }
    /**
     * Get active alerts.
     */
    getAlerts(userId) {
        return this.alertSystem.getActiveAlerts(userId);
    }
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId) {
        return this.alertSystem.acknowledgeAlert(alertId);
    }
    /**
     * Register custom industry profile.
     */
    registerIndustry(profile) {
        this.industryMatcher.registerProfile(profile);
    }
    /**
     * Get available industries.
     */
    getIndustries() {
        return this.industryMatcher.listIndustries();
    }
    /**
     * Get a specific trend by ID.
     */
    getTrend(trendId) {
        return this.trends.get(trendId);
    }
    /**
     * Get all tracked trends.
     */
    getAllTrends() {
        return Array.from(this.trends.values())
            .sort((a, b) => b.viralityScore - a.viralityScore);
    }
    /**
     * Get service status.
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastAnalysis: this.lastAnalysis,
            trackedTrends: this.trends.size,
            activeAlerts: this.alertSystem.getActiveAlerts().length,
            industries: this.getIndustries(),
        };
    }
    /**
     * Force refresh trend data.
     */
    async refresh() {
        this.collector.clearCache();
        return this.analyze();
    }
    /**
     * Get component instances for advanced usage.
     */
    getComponents() {
        return {
            collector: this.collector,
            analyzer: this.analyzer,
            scorer: this.scorer,
            industryMatcher: this.industryMatcher,
            alertSystem: this.alertSystem,
            contentSuggester: this.contentSuggester,
        };
    }
}
// ============================================================================
// Factory function and singleton
// ============================================================================
let trendPredictorInstance = null;
/**
 * Create a TrendPredictor instance with the provided configuration.
 */
export function createTrendPredictor(config) {
    return new TrendPredictor(config);
}
/**
 * Get or create a singleton TrendPredictor instance.
 */
export function getTrendPredictor(config) {
    if (!trendPredictorInstance) {
        if (!config) {
            // Default configuration
            config = {
                collectorConfig: {
                    googleTrends: { enabled: true },
                },
                analysisInterval: 15 * 60 * 1000, // 15 minutes
                alertThreshold: 60,
                maxTrendsToTrack: 100,
                predictionWindowHours: 72,
                cacheEnabled: true,
                cacheTTL: 300,
            };
        }
        trendPredictorInstance = new TrendPredictor(config);
    }
    return trendPredictorInstance;
}
export default TrendPredictor;
//# sourceMappingURL=TrendPredictor.js.map