// @ts-nocheck
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type PlatformType = 'shopify' | 'woocommerce' | 'magento' | 'bigcommerce' | 'amazon' | 'custom';
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'urgent';
export type SeasonType = 'spring' | 'summer' | 'fall' | 'winter' | 'holiday' | 'back_to_school' | 'none';
export type ForecastMethod = 'moving_average' | 'exponential_smoothing' | 'arima' | 'ml_ensemble';

export interface SalesDataPoint {
    timestamp: Date;
    quantity: number;
    revenue: number;
    orderId?: string;
    channel?: string;
    metadata?: Record<string, any>;
}

export interface InventoryLevel {
    productId: string;
    sku: string;
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    warehouseId?: string;
    lastUpdated: Date;
}

export interface Product {
    id: string;
    sku: string;
    name: string;
    category: string;
    subcategory?: string;
    price: number;
    cost: number;
    leadTimeDays: number;
    minOrderQuantity: number;
    supplierId?: string;
    isActive: boolean;
    createdAt: Date;
    metadata?: Record<string, any>;
}

export interface SalesVelocity {
    productId: string;
    dailyAverage: number;
    weeklyAverage: number;
    monthlyAverage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    trendStrength: number; // -1 to 1
    volatility: number; // 0 to 1
    lastCalculated: Date;
}

export interface SeasonalPattern {
    productId: string;
    season: SeasonType;
    multiplier: number; // e.g., 1.5 = 50% higher than baseline
    peakMonth: number; // 1-12
    troughMonth: number; // 1-12
    confidence: number; // 0-100
    historicalData: Array<{ month: number; avgSales: number }>;
}

export interface StockoutPrediction {
    productId: string;
    sku: string;
    productName: string;
    currentStock: number;
    dailyVelocity: number;
    predictedStockoutDate: Date;
    daysUntilStockout: number;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
}

export interface ReorderRecommendation {
    productId: string;
    sku: string;
    productName: string;
    currentStock: number;
    reorderPoint: number;
    recommendedQuantity: number;
    optimalOrderDate: Date;
    estimatedCost: number;
    urgency: 'low' | 'medium' | 'high' | 'immediate';
    reasoning: string[];
    safetyStockDays: number;
}

export interface StockAlert {
    id: string;
    productId: string;
    sku: string;
    productName: string;
    type: 'low_stock' | 'stockout_imminent' | 'stockout' | 'overstock' | 'velocity_change' | 'seasonal_warning';
    severity: AlertSeverity;
    message: string;
    currentStock: number;
    threshold: number;
    daysUntilIssue?: number;
    suggestedAction: string;
    createdAt: Date;
    expiresAt: Date;
    acknowledged: boolean;
    metadata?: Record<string, any>;
}

export interface DemandForecast {
    productId: string;
    forecastDate: Date;
    predictedDemand: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
    method: ForecastMethod;
    factors: Array<{ name: string; impact: number }>;
}

export interface PlatformCredentials {
    platform: PlatformType;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    shopUrl?: string;
    webhookSecret?: string;
    additionalConfig?: Record<string, any>;
}

export interface InventoryOracleConfig {
    platforms: PlatformCredentials[];
    analysisIntervalMs: number;
    defaultLeadTimeDays: number;
    safetyStockDays: number;
    lowStockThresholdDays: number;
    criticalStockThresholdDays: number;
    forecastHorizonDays: number;
    seasonalAnalysisEnabled: boolean;
    mlForecastingEnabled: boolean;
    alertingEnabled: boolean;
    webhookUrl?: string;
}

export interface AnalysisResult {
    timestamp: Date;
    productsAnalyzed: number;
    stockoutPredictions: StockoutPrediction[];
    reorderRecommendations: ReorderRecommendation[];
    alerts: StockAlert[];
    forecasts: DemandForecast[];
    summary: {
        healthyProducts: number;
        lowStockProducts: number;
        criticalProducts: number;
        overstockedProducts: number;
        totalInventoryValue: number;
        projectedStockouts7Days: number;
        projectedStockouts30Days: number;
    };
}

// ============================================================================
// SalesVelocityAnalyzer - Tracks sales rates over time
// ============================================================================

export class SalesVelocityAnalyzer {
    private salesHistory: Map<string, SalesDataPoint[]>;
    private velocityCache: Map<string, SalesVelocity>;
    private maxHistoryDays: number;

    constructor(maxHistoryDays: number = 365) {
        this.salesHistory = new Map();
        this.velocityCache = new Map();
        this.maxHistoryDays = maxHistoryDays;
    }

    /**
     * Record a sales transaction.
     */
    recordSale(productId: string, dataPoint: SalesDataPoint): void {
        if (!this.salesHistory.has(productId)) {
            this.salesHistory.set(productId, []);
        }

        const history = this.salesHistory.get(productId)!;
        history.push(dataPoint);

        // Cleanup old data
        const cutoffDate = new Date(Date.now() - this.maxHistoryDays * 24 * 60 * 60 * 1000);
        const filteredHistory = history.filter(dp => dp.timestamp >= cutoffDate);
        this.salesHistory.set(productId, filteredHistory);

        // Invalidate cache
        this.velocityCache.delete(productId);
    }

    /**
     * Bulk import sales data.
     */
    importSalesData(productId: string, dataPoints: SalesDataPoint[]): void {
        const existing = this.salesHistory.get(productId) || [];
        const combined = [...existing, ...dataPoints];

        // Sort by timestamp and deduplicate
        combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const unique = combined.filter((dp, index, arr) =>
            index === 0 || dp.timestamp.getTime() !== arr[index - 1].timestamp.getTime()
        );

        const cutoffDate = new Date(Date.now() - this.maxHistoryDays * 24 * 60 * 60 * 1000);
        const filtered = unique.filter(dp => dp.timestamp >= cutoffDate);

        this.salesHistory.set(productId, filtered);
        this.velocityCache.delete(productId);
    }

    /**
     * Calculate sales velocity for a product.
     */
    calculateVelocity(productId: string): SalesVelocity | null {
        // Check cache
        const cached = this.velocityCache.get(productId);
        if (cached && Date.now() - cached.lastCalculated.getTime() < 60 * 60 * 1000) {
            return cached;
        }

        const history = this.salesHistory.get(productId);
        if (!history || history.length < 7) {
            return null;
        }

        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;

        // Calculate daily, weekly, monthly averages
        const last7Days = history.filter(dp =>
            now.getTime() - dp.timestamp.getTime() <= 7 * dayMs
        );
        const last30Days = history.filter(dp =>
            now.getTime() - dp.timestamp.getTime() <= 30 * dayMs
        );
        const last90Days = history.filter(dp =>
            now.getTime() - dp.timestamp.getTime() <= 90 * dayMs
        );

        const dailyAverage = this.calculateDailyAverage(last7Days, 7);
        const weeklyAverage = this.calculateDailyAverage(last30Days, 30) * 7;
        const monthlyAverage = this.calculateDailyAverage(last90Days, 90) * 30;

        // Calculate trend
        const trend = this.calculateTrend(history);

        // Calculate volatility (coefficient of variation)
        const volatility = this.calculateVolatility(last30Days);

        const velocity: SalesVelocity = {
            productId,
            dailyAverage,
            weeklyAverage,
            monthlyAverage,
            trend: trend.direction,
            trendStrength: trend.strength,
            volatility,
            lastCalculated: now,
        };

        this.velocityCache.set(productId, velocity);
        return velocity;
    }

    /**
     * Calculate daily average from data points.
     */
    private calculateDailyAverage(dataPoints: SalesDataPoint[], days: number): number {
        if (dataPoints.length === 0) return 0;
        const totalQuantity = dataPoints.reduce((sum, dp) => sum + dp.quantity, 0);
        return totalQuantity / days;
    }

    /**
     * Calculate trend direction and strength.
     */
    private calculateTrend(history: SalesDataPoint[]): { direction: 'increasing' | 'stable' | 'decreasing'; strength: number } {
        if (history.length < 14) {
            return { direction: 'stable', strength: 0 };
        }

        const dayMs = 24 * 60 * 60 * 1000;
        const now = Date.now();

        // Compare recent 7 days to previous 7 days
        const recent = history.filter(dp =>
            now - dp.timestamp.getTime() <= 7 * dayMs
        );
        const previous = history.filter(dp =>
            now - dp.timestamp.getTime() > 7 * dayMs &&
            now - dp.timestamp.getTime() <= 14 * dayMs
        );

        const recentAvg = recent.reduce((sum, dp) => sum + dp.quantity, 0) / 7;
        const previousAvg = previous.reduce((sum, dp) => sum + dp.quantity, 0) / 7;

        if (previousAvg === 0) {
            return { direction: recentAvg > 0 ? 'increasing' : 'stable', strength: 0 };
        }

        const changeRate = (recentAvg - previousAvg) / previousAvg;

        if (changeRate > 0.1) {
            return { direction: 'increasing', strength: Math.min(changeRate, 1) };
        } else if (changeRate < -0.1) {
            return { direction: 'decreasing', strength: Math.max(changeRate, -1) };
        }

        return { direction: 'stable', strength: changeRate };
    }

    /**
     * Calculate volatility (coefficient of variation).
     */
    private calculateVolatility(dataPoints: SalesDataPoint[]): number {
        if (dataPoints.length < 2) return 0;

        // Group by day
        const dailySales = new Map<string, number>();
        for (const dp of dataPoints) {
            const dayKey = dp.timestamp.toISOString().split('T')[0];
            dailySales.set(dayKey, (dailySales.get(dayKey) || 0) + dp.quantity);
        }

        const values = Array.from(dailySales.values());
        const mean = values.reduce((a, b) => a + b, 0) / values.length;

        if (mean === 0) return 0;

        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        // Coefficient of variation, capped at 1
        return Math.min(stdDev / mean, 1);
    }

    /**
     * Get sales history for a product.
     */
    getSalesHistory(productId: string, days?: number): SalesDataPoint[] {
        const history = this.salesHistory.get(productId) || [];
        if (!days) return [...history];

        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return history.filter(dp => dp.timestamp >= cutoffDate);
    }

    /**
     * Get all tracked product IDs.
     */
    getTrackedProducts(): string[] {
        return Array.from(this.salesHistory.keys());
    }

    /**
     * Clear all data for a product.
     */
    clearProduct(productId: string): void {
        this.salesHistory.delete(productId);
        this.velocityCache.delete(productId);
    }

    /**
     * Clear all data.
     */
    clearAll(): void {
        this.salesHistory.clear();
        this.velocityCache.clear();
    }
}

// ============================================================================
// SeasonalPatternDetector - Identifies seasonal demand patterns
// ============================================================================

export class SeasonalPatternDetector {
    private patterns: Map<string, SeasonalPattern>;
    private salesAnalyzer: SalesVelocityAnalyzer;

    constructor(salesAnalyzer: SalesVelocityAnalyzer) {
        this.patterns = new Map();
        this.salesAnalyzer = salesAnalyzer;
    }

    /**
     * Detect seasonal patterns for a product.
     */
    detectPatterns(productId: string): SeasonalPattern | null {
        const history = this.salesAnalyzer.getSalesHistory(productId);

        if (history.length < 90) {
            return null; // Need at least 3 months of data
        }

        // Group sales by month
        const monthlySales = new Map<number, number[]>();
        for (let month = 1; month <= 12; month++) {
            monthlySales.set(month, []);
        }

        for (const dp of history) {
            const month = dp.timestamp.getMonth() + 1;
            const existing = monthlySales.get(month)!;
            existing.push(dp.quantity);
        }

        // Calculate monthly averages
        const monthlyAverages: Array<{ month: number; avgSales: number }> = [];
        for (const [month, sales] of monthlySales) {
            const avg = sales.length > 0
                ? sales.reduce((a, b) => a + b, 0) / sales.length
                : 0;
            monthlyAverages.push({ month, avgSales: avg });
        }

        // Calculate overall average
        const overallAvg = monthlyAverages.reduce((sum, m) => sum + m.avgSales, 0) / 12;

        if (overallAvg === 0) {
            return null;
        }

        // Find peak and trough
        const sorted = [...monthlyAverages].sort((a, b) => b.avgSales - a.avgSales);
        const peakMonth = sorted[0].month;
        const troughMonth = sorted[sorted.length - 1].month;

        // Calculate seasonality strength
        const maxMultiplier = sorted[0].avgSales / overallAvg;
        const minMultiplier = sorted[sorted.length - 1].avgSales / overallAvg;
        const seasonalityStrength = maxMultiplier - minMultiplier;

        // Determine season type based on peak
        const season = this.determineSeasonType(peakMonth);

        // Calculate confidence based on data volume and consistency
        const confidence = this.calculateSeasonalConfidence(history, monthlyAverages);

        const pattern: SeasonalPattern = {
            productId,
            season,
            multiplier: maxMultiplier,
            peakMonth,
            troughMonth,
            confidence,
            historicalData: monthlyAverages,
        };

        this.patterns.set(productId, pattern);
        return pattern;
    }

    /**
     * Determine season type from peak month.
     */
    private determineSeasonType(peakMonth: number): SeasonType {
        // Holiday season: November-December
        if (peakMonth === 11 || peakMonth === 12) {
            return 'holiday';
        }
        // Back to school: August-September
        if (peakMonth === 8 || peakMonth === 9) {
            return 'back_to_school';
        }
        // Spring: March-May
        if (peakMonth >= 3 && peakMonth <= 5) {
            return 'spring';
        }
        // Summer: June-August
        if (peakMonth >= 6 && peakMonth <= 8) {
            return 'summer';
        }
        // Fall: September-November
        if (peakMonth >= 9 && peakMonth <= 11) {
            return 'fall';
        }
        // Winter: December-February
        return 'winter';
    }

    /**
     * Calculate confidence in seasonal pattern.
     */
    private calculateSeasonalConfidence(
        history: SalesDataPoint[],
        monthlyAverages: Array<{ month: number; avgSales: number }>
    ): number {
        let confidence = 0;

        // Data volume factor (30 points max)
        const dataPoints = history.length;
        confidence += Math.min(dataPoints / 365 * 30, 30);

        // Months with data factor (30 points max)
        const monthsWithData = monthlyAverages.filter(m => m.avgSales > 0).length;
        confidence += (monthsWithData / 12) * 30;

        // Consistency factor (40 points max)
        // Check if pattern repeats year over year
        const years = new Set(history.map(dp => dp.timestamp.getFullYear())).size;
        if (years >= 2) {
            confidence += 40;
        } else if (years === 1) {
            confidence += 20;
        }

        return Math.round(Math.min(confidence, 100));
    }

    /**
     * Get seasonal multiplier for a product at a given date.
     */
    getSeasonalMultiplier(productId: string, date: Date = new Date()): number {
        const pattern = this.patterns.get(productId);
        if (!pattern || pattern.confidence < 50) {
            return 1.0; // No seasonal adjustment
        }

        const month = date.getMonth() + 1;
        const monthData = pattern.historicalData.find(m => m.month === month);

        if (!monthData) {
            return 1.0;
        }

        const overallAvg = pattern.historicalData.reduce((sum, m) => sum + m.avgSales, 0) / 12;
        if (overallAvg === 0) {
            return 1.0;
        }

        return monthData.avgSales / overallAvg;
    }

    /**
     * Get pattern for a product.
     */
    getPattern(productId: string): SeasonalPattern | null {
        return this.patterns.get(productId) || null;
    }

    /**
     * Check if product is approaching peak season.
     */
    isApproachingPeakSeason(productId: string, withinDays: number = 30): boolean {
        const pattern = this.patterns.get(productId);
        if (!pattern) return false;

        const now = new Date();
        const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

        const currentMonth = now.getMonth() + 1;
        const futureMonth = futureDate.getMonth() + 1;

        return currentMonth <= pattern.peakMonth && futureMonth >= pattern.peakMonth;
    }
}

// ============================================================================
// StockoutPredictor - Time series forecasting for stockouts
// ============================================================================

export class StockoutPredictor {
    private velocityAnalyzer: SalesVelocityAnalyzer;
    private seasonalDetector: SeasonalPatternDetector;
    private inventoryLevels: Map<string, InventoryLevel>;
    private products: Map<string, Product>;

    constructor(
        velocityAnalyzer: SalesVelocityAnalyzer,
        seasonalDetector: SeasonalPatternDetector
    ) {
        this.velocityAnalyzer = velocityAnalyzer;
        this.seasonalDetector = seasonalDetector;
        this.inventoryLevels = new Map();
        this.products = new Map();
    }

    /**
     * Update inventory level for a product.
     */
    updateInventory(level: InventoryLevel): void {
        this.inventoryLevels.set(level.productId, level);
    }

    /**
     * Update product information.
     */
    updateProduct(product: Product): void {
        this.products.set(product.id, product);
    }

    /**
     * Predict stockout for a single product.
     */
    predictStockout(productId: string): StockoutPrediction | null {
        const inventory = this.inventoryLevels.get(productId);
        const product = this.products.get(productId);
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);

        if (!inventory || !velocity) {
            return null;
        }

        const currentStock = inventory.availableStock;
        const dailyVelocity = velocity.dailyAverage;

        if (dailyVelocity <= 0) {
            // No sales, no stockout risk
            return {
                productId,
                sku: inventory.sku,
                productName: product?.name || inventory.sku,
                currentStock,
                dailyVelocity: 0,
                predictedStockoutDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                daysUntilStockout: 365,
                confidence: 30,
                riskLevel: 'low',
                factors: ['No recent sales activity'],
            };
        }

        // Apply seasonal adjustment
        const seasonalMultiplier = this.seasonalDetector.getSeasonalMultiplier(productId);
        const adjustedVelocity = dailyVelocity * seasonalMultiplier;

        // Calculate days until stockout
        const daysUntilStockout = Math.floor(currentStock / adjustedVelocity);
        const predictedStockoutDate = new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000);

        // Calculate confidence
        const confidence = this.calculatePredictionConfidence(velocity, seasonalMultiplier);

        // Determine risk level
        const riskLevel = this.determineRiskLevel(daysUntilStockout, product?.leadTimeDays || 7);

        // Identify contributing factors
        const factors = this.identifyFactors(velocity, seasonalMultiplier, daysUntilStockout);

        return {
            productId,
            sku: inventory.sku,
            productName: product?.name || inventory.sku,
            currentStock,
            dailyVelocity: adjustedVelocity,
            predictedStockoutDate,
            daysUntilStockout,
            confidence,
            riskLevel,
            factors,
        };
    }

    /**
     * Predict stockouts for all products.
     */
    predictAllStockouts(): StockoutPrediction[] {
        const predictions: StockoutPrediction[] = [];

        for (const productId of this.inventoryLevels.keys()) {
            const prediction = this.predictStockout(productId);
            if (prediction) {
                predictions.push(prediction);
            }
        }

        // Sort by days until stockout (most urgent first)
        return predictions.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
    }

    /**
     * Calculate prediction confidence.
     */
    private calculatePredictionConfidence(velocity: SalesVelocity, seasonalMultiplier: number): number {
        let confidence = 70; // Base confidence

        // Reduce confidence for high volatility
        confidence -= velocity.volatility * 30;

        // Reduce confidence for strong trends (harder to predict)
        confidence -= Math.abs(velocity.trendStrength) * 10;

        // Reduce confidence for strong seasonal adjustments
        if (Math.abs(seasonalMultiplier - 1) > 0.3) {
            confidence -= 10;
        }

        return Math.round(Math.max(20, Math.min(95, confidence)));
    }

    /**
     * Determine risk level based on days until stockout and lead time.
     */
    private determineRiskLevel(
        daysUntilStockout: number,
        leadTimeDays: number
    ): StockoutPrediction['riskLevel'] {
        const bufferRatio = daysUntilStockout / leadTimeDays;

        if (bufferRatio < 0.5 || daysUntilStockout <= 3) {
            return 'critical';
        } else if (bufferRatio < 1 || daysUntilStockout <= 7) {
            return 'high';
        } else if (bufferRatio < 1.5 || daysUntilStockout <= 14) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Identify factors contributing to stockout prediction.
     */
    private identifyFactors(
        velocity: SalesVelocity,
        seasonalMultiplier: number,
        daysUntilStockout: number
    ): string[] {
        const factors: string[] = [];

        if (velocity.trend === 'increasing') {
            factors.push(`Sales velocity is increasing (${(velocity.trendStrength * 100).toFixed(0)}% trend)`);
        }

        if (seasonalMultiplier > 1.2) {
            factors.push(`Entering high season (${((seasonalMultiplier - 1) * 100).toFixed(0)}% above baseline)`);
        }

        if (velocity.volatility > 0.5) {
            factors.push('High sales volatility detected');
        }

        if (daysUntilStockout <= 7) {
            factors.push('Critical stock level - immediate action required');
        }

        if (factors.length === 0) {
            factors.push('Normal consumption pattern');
        }

        return factors;
    }

    /**
     * Get inventory level for a product.
     */
    getInventoryLevel(productId: string): InventoryLevel | null {
        return this.inventoryLevels.get(productId) || null;
    }

    /**
     * Get product information.
     */
    getProduct(productId: string): Product | null {
        return this.products.get(productId) || null;
    }
}

// ============================================================================
// SafetyStockCalculator - Calculates safety stock based on demand variability
// ============================================================================

export class SafetyStockCalculator {
    private velocityAnalyzer: SalesVelocityAnalyzer;
    private defaultServiceLevel: number; // 0-1, e.g., 0.95 = 95%

    constructor(velocityAnalyzer: SalesVelocityAnalyzer, defaultServiceLevel: number = 0.95) {
        this.velocityAnalyzer = velocityAnalyzer;
        this.defaultServiceLevel = defaultServiceLevel;
    }

    /**
     * Calculate safety stock for a product.
     */
    calculateSafetyStock(
        productId: string,
        leadTimeDays: number,
        serviceLevel?: number
    ): { quantity: number; daysOfCover: number; formula: string } | null {
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);
        if (!velocity) {
            return null;
        }

        const history = this.velocityAnalyzer.getSalesHistory(productId, 90);
        if (history.length < 14) {
            return null;
        }

        // Calculate daily demand standard deviation
        const dailySales = this.groupByDay(history);
        const stdDev = this.calculateStdDev(dailySales);

        // Z-score for service level
        const z = this.getZScore(serviceLevel || this.defaultServiceLevel);

        // Safety stock formula: Z * stdDev * sqrt(leadTime)
        const safetyStock = Math.ceil(z * stdDev * Math.sqrt(leadTimeDays));

        // Days of cover
        const daysOfCover = velocity.dailyAverage > 0
            ? safetyStock / velocity.dailyAverage
            : 0;

        return {
            quantity: safetyStock,
            daysOfCover: Math.round(daysOfCover * 10) / 10,
            formula: `${z.toFixed(2)} x ${stdDev.toFixed(2)} x sqrt(${leadTimeDays})`,
        };
    }

    /**
     * Calculate reorder point (safety stock + lead time demand).
     */
    calculateReorderPoint(
        productId: string,
        leadTimeDays: number,
        serviceLevel?: number
    ): { reorderPoint: number; safetyStock: number; leadTimeDemand: number } | null {
        const safetyStockResult = this.calculateSafetyStock(productId, leadTimeDays, serviceLevel);
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);

        if (!safetyStockResult || !velocity) {
            return null;
        }

        const leadTimeDemand = Math.ceil(velocity.dailyAverage * leadTimeDays);
        const reorderPoint = safetyStockResult.quantity + leadTimeDemand;

        return {
            reorderPoint,
            safetyStock: safetyStockResult.quantity,
            leadTimeDemand,
        };
    }

    /**
     * Group sales data by day.
     */
    private groupByDay(dataPoints: SalesDataPoint[]): number[] {
        const dailyMap = new Map<string, number>();

        for (const dp of dataPoints) {
            const dayKey = dp.timestamp.toISOString().split('T')[0];
            dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + dp.quantity);
        }

        return Array.from(dailyMap.values());
    }

    /**
     * Calculate standard deviation.
     */
    private calculateStdDev(values: number[]): number {
        if (values.length < 2) return 0;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

        return Math.sqrt(variance);
    }

    /**
     * Get Z-score for service level.
     */
    private getZScore(serviceLevel: number): number {
        // Approximate Z-scores for common service levels
        const zScores: Record<number, number> = {
            0.80: 0.84,
            0.85: 1.04,
            0.90: 1.28,
            0.95: 1.65,
            0.97: 1.88,
            0.98: 2.05,
            0.99: 2.33,
        };

        // Find closest service level
        const levels = Object.keys(zScores).map(Number).sort((a, b) => a - b);
        let closest = levels[0];

        for (const level of levels) {
            if (Math.abs(level - serviceLevel) < Math.abs(closest - serviceLevel)) {
                closest = level;
            }
        }

        return zScores[closest] || 1.65;
    }
}

// ============================================================================
// ReorderCalculator - Suggests optimal reorder quantities
// ============================================================================

export class ReorderCalculator {
    private stockoutPredictor: StockoutPredictor;
    private safetyStockCalculator: SafetyStockCalculator;
    private velocityAnalyzer: SalesVelocityAnalyzer;
    private seasonalDetector: SeasonalPatternDetector;

    constructor(
        stockoutPredictor: StockoutPredictor,
        safetyStockCalculator: SafetyStockCalculator,
        velocityAnalyzer: SalesVelocityAnalyzer,
        seasonalDetector: SeasonalPatternDetector
    ) {
        this.stockoutPredictor = stockoutPredictor;
        this.safetyStockCalculator = safetyStockCalculator;
        this.velocityAnalyzer = velocityAnalyzer;
        this.seasonalDetector = seasonalDetector;
    }

    /**
     * Calculate reorder recommendation for a product.
     */
    calculateReorder(
        productId: string,
        config: {
            targetDaysOfStock?: number;
            maxOrderQuantity?: number;
            minOrderQuantity?: number;
        } = {}
    ): ReorderRecommendation | null {
        const product = this.stockoutPredictor.getProduct(productId);
        const inventory = this.stockoutPredictor.getInventoryLevel(productId);
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);

        if (!inventory || !velocity) {
            return null;
        }

        const leadTimeDays = product?.leadTimeDays || 7;
        const targetDays = config.targetDaysOfStock || 30;
        const minQty = config.minOrderQuantity || product?.minOrderQuantity || 1;

        // Calculate reorder point
        const reorderPointResult = this.safetyStockCalculator.calculateReorderPoint(
            productId,
            leadTimeDays
        );

        if (!reorderPointResult) {
            return null;
        }

        const { reorderPoint, safetyStock } = reorderPointResult;
        const currentStock = inventory.availableStock;

        // Calculate when to order
        const prediction = this.stockoutPredictor.predictStockout(productId);
        const daysUntilReorderPoint = velocity.dailyAverage > 0
            ? Math.max(0, (currentStock - reorderPoint) / velocity.dailyAverage)
            : 365;

        // Apply seasonal adjustments for future demand
        const futureDemand = this.calculateFutureDemand(productId, targetDays);

        // Calculate recommended quantity
        let recommendedQuantity = Math.ceil(futureDemand + safetyStock - currentStock);
        recommendedQuantity = Math.max(recommendedQuantity, minQty);

        if (config.maxOrderQuantity) {
            recommendedQuantity = Math.min(recommendedQuantity, config.maxOrderQuantity);
        }

        // Determine urgency
        const urgency = this.determineUrgency(currentStock, reorderPoint, prediction?.daysUntilStockout || 365);

        // Calculate optimal order date
        const optimalOrderDate = new Date(Date.now() + Math.max(0, daysUntilReorderPoint - leadTimeDays) * 24 * 60 * 60 * 1000);

        // Calculate estimated cost
        const estimatedCost = recommendedQuantity * (product?.cost || 0);

        // Generate reasoning
        const reasoning = this.generateReasoning(
            currentStock,
            reorderPoint,
            safetyStock,
            velocity,
            urgency
        );

        return {
            productId,
            sku: inventory.sku,
            productName: product?.name || inventory.sku,
            currentStock,
            reorderPoint,
            recommendedQuantity,
            optimalOrderDate,
            estimatedCost,
            urgency,
            reasoning,
            safetyStockDays: safetyStock / Math.max(velocity.dailyAverage, 0.1),
        };
    }

    /**
     * Calculate future demand with seasonal adjustments.
     */
    private calculateFutureDemand(productId: string, days: number): number {
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);
        if (!velocity) return 0;

        let totalDemand = 0;
        const now = new Date();

        // Sum daily demand with seasonal adjustments
        for (let i = 0; i < days; i++) {
            const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
            const multiplier = this.seasonalDetector.getSeasonalMultiplier(productId, futureDate);
            totalDemand += velocity.dailyAverage * multiplier;
        }

        return totalDemand;
    }

    /**
     * Determine order urgency.
     */
    private determineUrgency(
        currentStock: number,
        reorderPoint: number,
        daysUntilStockout: number
    ): ReorderRecommendation['urgency'] {
        if (currentStock <= 0 || daysUntilStockout <= 3) {
            return 'immediate';
        }
        if (currentStock < reorderPoint || daysUntilStockout <= 7) {
            return 'high';
        }
        if (currentStock < reorderPoint * 1.2 || daysUntilStockout <= 14) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Generate reasoning for recommendation.
     */
    private generateReasoning(
        currentStock: number,
        reorderPoint: number,
        safetyStock: number,
        velocity: SalesVelocity,
        urgency: ReorderRecommendation['urgency']
    ): string[] {
        const reasons: string[] = [];

        if (currentStock < reorderPoint) {
            reasons.push(`Current stock (${currentStock}) is below reorder point (${reorderPoint})`);
        }

        if (velocity.trend === 'increasing') {
            reasons.push(`Sales velocity is trending upward (${(velocity.trendStrength * 100).toFixed(0)}%)`);
        }

        if (velocity.volatility > 0.5) {
            reasons.push('High demand variability requires additional safety stock');
        }

        reasons.push(`Safety stock of ${safetyStock} units provides buffer against variability`);

        if (urgency === 'immediate') {
            reasons.push('URGENT: Stock critically low - order immediately');
        }

        return reasons;
    }

    /**
     * Calculate recommendations for all products.
     */
    calculateAllReorders(): ReorderRecommendation[] {
        const recommendations: ReorderRecommendation[] = [];
        const trackedProducts = this.velocityAnalyzer.getTrackedProducts();

        for (const productId of trackedProducts) {
            const recommendation = this.calculateReorder(productId);
            if (recommendation && recommendation.urgency !== 'low') {
                recommendations.push(recommendation);
            }
        }

        // Sort by urgency
        const urgencyOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
        return recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    }
}

// ============================================================================
// DemandForecaster - ML-based demand predictions
// ============================================================================

export class DemandForecaster {
    private velocityAnalyzer: SalesVelocityAnalyzer;
    private seasonalDetector: SeasonalPatternDetector;
    private forecastCache: Map<string, DemandForecast[]>;

    constructor(
        velocityAnalyzer: SalesVelocityAnalyzer,
        seasonalDetector: SeasonalPatternDetector
    ) {
        this.velocityAnalyzer = velocityAnalyzer;
        this.seasonalDetector = seasonalDetector;
        this.forecastCache = new Map();
    }

    /**
     * Generate demand forecast for a product.
     */
    forecast(
        productId: string,
        horizonDays: number = 30,
        method: ForecastMethod = 'exponential_smoothing'
    ): DemandForecast[] {
        const history = this.velocityAnalyzer.getSalesHistory(productId);
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);

        if (!velocity || history.length < 14) {
            return [];
        }

        const forecasts: DemandForecast[] = [];
        const now = new Date();

        // Group historical data by day
        const dailySales = this.groupSalesByDay(history);

        for (let i = 1; i <= horizonDays; i++) {
            const forecastDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);

            let predictedDemand: number;
            let factors: Array<{ name: string; impact: number }> = [];

            switch (method) {
                case 'moving_average':
                    predictedDemand = this.movingAverageForecast(dailySales);
                    factors.push({ name: 'Moving Average (7-day)', impact: 1.0 });
                    break;
                case 'exponential_smoothing':
                    predictedDemand = this.exponentialSmoothingForecast(dailySales);
                    factors.push({ name: 'Exponential Smoothing (alpha=0.3)', impact: 1.0 });
                    break;
                case 'ml_ensemble':
                    predictedDemand = this.ensembleForecast(dailySales, velocity);
                    factors.push({ name: 'Ensemble Model', impact: 1.0 });
                    break;
                default:
                    predictedDemand = velocity.dailyAverage;
            }

            // Apply seasonal adjustment
            const seasonalMultiplier = this.seasonalDetector.getSeasonalMultiplier(productId, forecastDate);
            if (seasonalMultiplier !== 1.0) {
                predictedDemand *= seasonalMultiplier;
                factors.push({
                    name: 'Seasonal Adjustment',
                    impact: seasonalMultiplier - 1
                });
            }

            // Apply trend adjustment
            if (velocity.trend !== 'stable') {
                const trendFactor = 1 + (velocity.trendStrength * i / horizonDays * 0.5);
                predictedDemand *= trendFactor;
                factors.push({
                    name: 'Trend Adjustment',
                    impact: trendFactor - 1
                });
            }

            // Calculate confidence intervals
            const stdDev = velocity.volatility * velocity.dailyAverage;
            const lowerBound = Math.max(0, predictedDemand - 1.96 * stdDev);
            const upperBound = predictedDemand + 1.96 * stdDev;

            // Calculate confidence
            const confidence = this.calculateForecastConfidence(
                history.length,
                velocity.volatility,
                i
            );

            forecasts.push({
                productId,
                forecastDate,
                predictedDemand: Math.round(predictedDemand * 100) / 100,
                lowerBound: Math.round(lowerBound * 100) / 100,
                upperBound: Math.round(upperBound * 100) / 100,
                confidence,
                method,
                factors,
            });
        }

        this.forecastCache.set(productId, forecasts);
        return forecasts;
    }

    /**
     * Group sales by day.
     */
    private groupSalesByDay(history: SalesDataPoint[]): number[] {
        const dailyMap = new Map<string, number>();

        for (const dp of history) {
            const dayKey = dp.timestamp.toISOString().split('T')[0];
            dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + dp.quantity);
        }

        // Get last 30 days
        const values = Array.from(dailyMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-30)
            .map(e => e[1]);

        return values;
    }

    /**
     * Simple moving average forecast.
     */
    private movingAverageForecast(dailySales: number[]): number {
        const window = Math.min(7, dailySales.length);
        const recent = dailySales.slice(-window);
        return recent.reduce((a, b) => a + b, 0) / window;
    }

    /**
     * Exponential smoothing forecast.
     */
    private exponentialSmoothingForecast(dailySales: number[], alpha: number = 0.3): number {
        if (dailySales.length === 0) return 0;

        let forecast = dailySales[0];

        for (let i = 1; i < dailySales.length; i++) {
            forecast = alpha * dailySales[i] + (1 - alpha) * forecast;
        }

        return forecast;
    }

    /**
     * Ensemble forecast combining multiple methods.
     */
    private ensembleForecast(dailySales: number[], velocity: SalesVelocity): number {
        const ma = this.movingAverageForecast(dailySales);
        const es = this.exponentialSmoothingForecast(dailySales);
        const weightedAvg = velocity.dailyAverage;

        // Weighted combination
        return (ma * 0.3 + es * 0.4 + weightedAvg * 0.3);
    }

    /**
     * Calculate forecast confidence.
     */
    private calculateForecastConfidence(
        dataPoints: number,
        volatility: number,
        daysAhead: number
    ): number {
        let confidence = 80;

        // More data = higher confidence
        confidence += Math.min(dataPoints / 100 * 10, 10);

        // Lower volatility = higher confidence
        confidence -= volatility * 20;

        // Further ahead = lower confidence
        confidence -= (daysAhead / 30) * 15;

        return Math.round(Math.max(30, Math.min(95, confidence)));
    }

    /**
     * Get cached forecast.
     */
    getCachedForecast(productId: string): DemandForecast[] {
        return this.forecastCache.get(productId) || [];
    }
}

// ============================================================================
// AlertManager - Low stock notifications
// ============================================================================

export class AlertManager extends EventEmitter {
    private alerts: Map<string, StockAlert>;
    private alertHistory: StockAlert[];
    private webhookUrl?: string;
    private maxHistorySize: number;

    constructor(webhookUrl?: string) {
        super();
        this.alerts = new Map();
        this.alertHistory = [];
        this.webhookUrl = webhookUrl;
        this.maxHistorySize = 1000;
    }

    /**
     * Create a stock alert.
     */
    createAlert(params: {
        productId: string;
        sku: string;
        productName: string;
        type: StockAlert['type'];
        severity: AlertSeverity;
        message: string;
        currentStock: number;
        threshold: number;
        daysUntilIssue?: number;
        suggestedAction: string;
        metadata?: Record<string, any>;
    }): StockAlert {
        const alert: StockAlert = {
            id: crypto.randomUUID(),
            ...params,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            acknowledged: false,
        };

        // Check for duplicate
        const existingKey = `${params.productId}:${params.type}`;
        const existing = this.alerts.get(existingKey);

        if (existing && !existing.acknowledged) {
            // Update existing alert
            existing.currentStock = params.currentStock;
            existing.severity = params.severity;
            existing.message = params.message;
            existing.daysUntilIssue = params.daysUntilIssue;
            return existing;
        }

        this.alerts.set(alert.id, alert);
        this.alertHistory.push(alert);

        // Trim history
        if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory = this.alertHistory.slice(-this.maxHistorySize / 2);
        }

        // Emit event
        this.emit('alert', alert);

        // Send webhook if configured
        this.sendWebhook(alert).catch(err => {
            console.error('[AlertManager] Webhook failed:', err);
        });

        return alert;
    }

    /**
     * Generate alerts based on stockout predictions.
     */
    generateAlertsFromPredictions(
        predictions: StockoutPrediction[],
        config: {
            criticalThresholdDays: number;
            lowStockThresholdDays: number;
        }
    ): StockAlert[] {
        const newAlerts: StockAlert[] = [];

        for (const prediction of predictions) {
            let alertType: StockAlert['type'];
            let severity: AlertSeverity;
            let message: string;
            let suggestedAction: string;

            if (prediction.currentStock <= 0) {
                alertType = 'stockout';
                severity = 'urgent';
                message = `STOCKOUT: ${prediction.productName} has no available stock`;
                suggestedAction = 'Emergency reorder required immediately';
            } else if (prediction.daysUntilStockout <= config.criticalThresholdDays) {
                alertType = 'stockout_imminent';
                severity = 'critical';
                message = `${prediction.productName} will stock out in ${prediction.daysUntilStockout} days`;
                suggestedAction = `Place urgent order - ${Math.ceil(prediction.dailyVelocity * 14)} units recommended`;
            } else if (prediction.daysUntilStockout <= config.lowStockThresholdDays) {
                alertType = 'low_stock';
                severity = 'warning';
                message = `${prediction.productName} stock is low - ${prediction.daysUntilStockout} days remaining`;
                suggestedAction = 'Schedule reorder within the next few days';
            } else {
                continue; // No alert needed
            }

            const alert = this.createAlert({
                productId: prediction.productId,
                sku: prediction.sku,
                productName: prediction.productName,
                type: alertType,
                severity,
                message,
                currentStock: prediction.currentStock,
                threshold: Math.ceil(prediction.dailyVelocity * config.lowStockThresholdDays),
                daysUntilIssue: prediction.daysUntilStockout,
                suggestedAction,
                metadata: {
                    dailyVelocity: prediction.dailyVelocity,
                    riskLevel: prediction.riskLevel,
                    factors: prediction.factors,
                },
            });

            newAlerts.push(alert);
        }

        return newAlerts;
    }

    /**
     * Create velocity change alert.
     */
    createVelocityChangeAlert(
        productId: string,
        sku: string,
        productName: string,
        changePercent: number,
        direction: 'increase' | 'decrease'
    ): StockAlert {
        const severity: AlertSeverity = Math.abs(changePercent) > 50 ? 'warning' : 'info';

        return this.createAlert({
            productId,
            sku,
            productName,
            type: 'velocity_change',
            severity,
            message: `${productName} sales velocity ${direction}d by ${changePercent.toFixed(0)}%`,
            currentStock: 0,
            threshold: 0,
            suggestedAction: direction === 'increase'
                ? 'Review inventory levels and consider increasing safety stock'
                : 'Monitor for continued trend - may need to reduce orders',
        });
    }

    /**
     * Create seasonal warning alert.
     */
    createSeasonalWarningAlert(
        productId: string,
        sku: string,
        productName: string,
        season: SeasonType,
        daysUntilPeak: number
    ): StockAlert {
        return this.createAlert({
            productId,
            sku,
            productName,
            type: 'seasonal_warning',
            severity: 'info',
            message: `${productName} peak ${season} season approaching in ${daysUntilPeak} days`,
            currentStock: 0,
            threshold: 0,
            daysUntilIssue: daysUntilPeak,
            suggestedAction: 'Consider pre-ordering additional inventory for seasonal demand',
        });
    }

    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string): boolean {
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
    dismissAlert(alertId: string): boolean {
        return this.alerts.delete(alertId);
    }

    /**
     * Get active alerts.
     */
    getActiveAlerts(severity?: AlertSeverity): StockAlert[] {
        const now = new Date();
        let alerts = Array.from(this.alerts.values())
            .filter(a => a.expiresAt > now && !a.acknowledged);

        if (severity) {
            alerts = alerts.filter(a => a.severity === severity);
        }

        // Sort by severity
        const severityOrder = { urgent: 0, critical: 1, warning: 2, info: 3 };
        return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    }

    /**
     * Get alerts by product.
     */
    getAlertsByProduct(productId: string): StockAlert[] {
        return Array.from(this.alerts.values())
            .filter(a => a.productId === productId);
    }

    /**
     * Send webhook notification.
     */
    private async sendWebhook(alert: StockAlert): Promise<void> {
        if (!this.webhookUrl) return;

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'inventory_alert',
                    alert,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                console.error('[AlertManager] Webhook returned error:', response.status);
            }
        } catch (error) {
            console.error('[AlertManager] Webhook request failed:', error);
        }
    }

    /**
     * Cleanup expired alerts.
     */
    cleanup(): number {
        const now = new Date();
        let removed = 0;

        for (const [id, alert] of this.alerts) {
            if (alert.expiresAt < now || alert.acknowledged) {
                this.alerts.delete(id);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Get alert statistics.
     */
    getStats(): {
        totalAlerts: number;
        activeAlerts: number;
        bySeverity: Record<AlertSeverity, number>;
        byType: Record<string, number>;
    } {
        const alerts = Array.from(this.alerts.values());
        const now = new Date();
        const active = alerts.filter(a => a.expiresAt > now && !a.acknowledged);

        const bySeverity: Record<AlertSeverity, number> = {
            urgent: 0,
            critical: 0,
            warning: 0,
            info: 0,
        };

        const byType: Record<string, number> = {};

        for (const alert of active) {
            bySeverity[alert.severity]++;
            byType[alert.type] = (byType[alert.type] || 0) + 1;
        }

        return {
            totalAlerts: alerts.length,
            activeAlerts: active.length,
            bySeverity,
            byType,
        };
    }
}

// ============================================================================
// PlatformConnector - E-commerce platform integration
// ============================================================================

export class PlatformConnector {
    private credentials: Map<PlatformType, PlatformCredentials>;
    private syncStatus: Map<PlatformType, { lastSync: Date; status: 'success' | 'error'; error?: string }>;

    constructor() {
        this.credentials = new Map();
        this.syncStatus = new Map();
    }

    /**
     * Register platform credentials.
     */
    registerPlatform(credentials: PlatformCredentials): void {
        this.credentials.set(credentials.platform, credentials);
    }

    /**
     * Remove platform credentials.
     */
    removePlatform(platform: PlatformType): boolean {
        return this.credentials.delete(platform);
    }

    /**
     * Fetch products from a platform.
     */
    async fetchProducts(platform: PlatformType): Promise<Product[]> {
        const creds = this.credentials.get(platform);
        if (!creds) {
            throw new Error(`Platform ${platform} not configured`);
        }

        try {
            let products: Product[];

            switch (platform) {
                case 'shopify':
                    products = await this.fetchShopifyProducts(creds);
                    break;
                case 'woocommerce':
                    products = await this.fetchWooCommerceProducts(creds);
                    break;
                case 'magento':
                    products = await this.fetchMagentoProducts(creds);
                    break;
                case 'bigcommerce':
                    products = await this.fetchBigCommerceProducts(creds);
                    break;
                case 'amazon':
                    products = await this.fetchAmazonProducts(creds);
                    break;
                default:
                    products = await this.fetchCustomProducts(creds);
            }

            this.syncStatus.set(platform, { lastSync: new Date(), status: 'success' });
            return products;
        } catch (error) {
            this.syncStatus.set(platform, {
                lastSync: new Date(),
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Fetch inventory levels from a platform.
     */
    async fetchInventoryLevels(platform: PlatformType): Promise<InventoryLevel[]> {
        const creds = this.credentials.get(platform);
        if (!creds) {
            throw new Error(`Platform ${platform} not configured`);
        }

        switch (platform) {
            case 'shopify':
                return this.fetchShopifyInventory(creds);
            case 'woocommerce':
                return this.fetchWooCommerceInventory(creds);
            default:
                return this.fetchGenericInventory(creds, platform);
        }
    }

    /**
     * Fetch recent orders/sales from a platform.
     */
    async fetchSalesData(
        platform: PlatformType,
        sinceDate: Date
    ): Promise<Map<string, SalesDataPoint[]>> {
        const creds = this.credentials.get(platform);
        if (!creds) {
            throw new Error(`Platform ${platform} not configured`);
        }

        switch (platform) {
            case 'shopify':
                return this.fetchShopifySales(creds, sinceDate);
            case 'woocommerce':
                return this.fetchWooCommerceSales(creds, sinceDate);
            default:
                return this.fetchGenericSales(creds, platform, sinceDate);
        }
    }

    // Platform-specific implementations

    private async fetchShopifyProducts(creds: PlatformCredentials): Promise<Product[]> {
        // In production, use Shopify Admin API
        // GET https://{shop}.myshopify.com/admin/api/2024-01/products.json
        console.log('[PlatformConnector] Fetching Shopify products...');
        return this.generateMockProducts('shopify');
    }

    private async fetchWooCommerceProducts(creds: PlatformCredentials): Promise<Product[]> {
        // In production, use WooCommerce REST API
        // GET https://{site}/wp-json/wc/v3/products
        console.log('[PlatformConnector] Fetching WooCommerce products...');
        return this.generateMockProducts('woocommerce');
    }

    private async fetchMagentoProducts(creds: PlatformCredentials): Promise<Product[]> {
        console.log('[PlatformConnector] Fetching Magento products...');
        return this.generateMockProducts('magento');
    }

    private async fetchBigCommerceProducts(creds: PlatformCredentials): Promise<Product[]> {
        console.log('[PlatformConnector] Fetching BigCommerce products...');
        return this.generateMockProducts('bigcommerce');
    }

    private async fetchAmazonProducts(creds: PlatformCredentials): Promise<Product[]> {
        console.log('[PlatformConnector] Fetching Amazon products...');
        return this.generateMockProducts('amazon');
    }

    private async fetchCustomProducts(creds: PlatformCredentials): Promise<Product[]> {
        console.log('[PlatformConnector] Fetching custom platform products...');
        return this.generateMockProducts('custom');
    }

    private async fetchShopifyInventory(creds: PlatformCredentials): Promise<InventoryLevel[]> {
        // GET https://{shop}.myshopify.com/admin/api/2024-01/inventory_levels.json
        console.log('[PlatformConnector] Fetching Shopify inventory...');
        return this.generateMockInventory();
    }

    private async fetchWooCommerceInventory(creds: PlatformCredentials): Promise<InventoryLevel[]> {
        console.log('[PlatformConnector] Fetching WooCommerce inventory...');
        return this.generateMockInventory();
    }

    private async fetchGenericInventory(creds: PlatformCredentials, platform: PlatformType): Promise<InventoryLevel[]> {
        console.log(`[PlatformConnector] Fetching ${platform} inventory...`);
        return this.generateMockInventory();
    }

    private async fetchShopifySales(creds: PlatformCredentials, sinceDate: Date): Promise<Map<string, SalesDataPoint[]>> {
        // GET https://{shop}.myshopify.com/admin/api/2024-01/orders.json
        console.log('[PlatformConnector] Fetching Shopify sales...');
        return this.generateMockSalesData(sinceDate);
    }

    private async fetchWooCommerceSales(creds: PlatformCredentials, sinceDate: Date): Promise<Map<string, SalesDataPoint[]>> {
        console.log('[PlatformConnector] Fetching WooCommerce sales...');
        return this.generateMockSalesData(sinceDate);
    }

    private async fetchGenericSales(creds: PlatformCredentials, platform: PlatformType, sinceDate: Date): Promise<Map<string, SalesDataPoint[]>> {
        console.log(`[PlatformConnector] Fetching ${platform} sales...`);
        return this.generateMockSalesData(sinceDate);
    }

    // Mock data generators for development

    private generateMockProducts(platform: string): Product[] {
        const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Beauty'];
        const products: Product[] = [];

        for (let i = 1; i <= 20; i++) {
            products.push({
                id: `${platform}-prod-${i}`,
                sku: `SKU-${platform.toUpperCase()}-${String(i).padStart(4, '0')}`,
                name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Product ${i}`,
                category: categories[i % categories.length],
                price: Math.round((10 + Math.random() * 200) * 100) / 100,
                cost: Math.round((5 + Math.random() * 100) * 100) / 100,
                leadTimeDays: Math.floor(3 + Math.random() * 14),
                minOrderQuantity: Math.floor(1 + Math.random() * 50),
                supplierId: `supplier-${Math.floor(Math.random() * 5) + 1}`,
                isActive: true,
                createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            });
        }

        return products;
    }

    private generateMockInventory(): InventoryLevel[] {
        const levels: InventoryLevel[] = [];
        const platforms = ['shopify', 'woocommerce', 'magento'];

        for (const platform of platforms) {
            for (let i = 1; i <= 20; i++) {
                const currentStock = Math.floor(Math.random() * 500);
                const reservedStock = Math.floor(currentStock * Math.random() * 0.2);

                levels.push({
                    productId: `${platform}-prod-${i}`,
                    sku: `SKU-${platform.toUpperCase()}-${String(i).padStart(4, '0')}`,
                    currentStock,
                    reservedStock,
                    availableStock: currentStock - reservedStock,
                    lastUpdated: new Date(),
                });
            }
        }

        return levels;
    }

    private generateMockSalesData(sinceDate: Date): Map<string, SalesDataPoint[]> {
        const salesMap = new Map<string, SalesDataPoint[]>();
        const platforms = ['shopify', 'woocommerce'];
        const now = Date.now();
        const sinceTime = sinceDate.getTime();

        for (const platform of platforms) {
            for (let i = 1; i <= 20; i++) {
                const productId = `${platform}-prod-${i}`;
                const dataPoints: SalesDataPoint[] = [];

                // Generate random sales over the time period
                const avgDailySales = Math.random() * 10;
                let currentTime = sinceTime;

                while (currentTime < now) {
                    if (Math.random() < 0.7) { // 70% chance of sale each day
                        const quantity = Math.floor(1 + Math.random() * avgDailySales * 2);
                        const revenue = quantity * (10 + Math.random() * 50);

                        dataPoints.push({
                            timestamp: new Date(currentTime + Math.random() * 24 * 60 * 60 * 1000),
                            quantity,
                            revenue,
                            orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            channel: platform,
                        });
                    }
                    currentTime += 24 * 60 * 60 * 1000; // Next day
                }

                if (dataPoints.length > 0) {
                    salesMap.set(productId, dataPoints);
                }
            }
        }

        return salesMap;
    }

    /**
     * Get sync status for all platforms.
     */
    getSyncStatus(): Map<PlatformType, { lastSync: Date; status: 'success' | 'error'; error?: string }> {
        return new Map(this.syncStatus);
    }

    /**
     * Get registered platforms.
     */
    getRegisteredPlatforms(): PlatformType[] {
        return Array.from(this.credentials.keys());
    }
}

// ============================================================================
// InventoryOracle - Main orchestrating class
// ============================================================================

export class InventoryOracle extends EventEmitter {
    private config: InventoryOracleConfig;
    private velocityAnalyzer: SalesVelocityAnalyzer;
    private seasonalDetector: SeasonalPatternDetector;
    private stockoutPredictor: StockoutPredictor;
    private safetyStockCalculator: SafetyStockCalculator;
    private reorderCalculator: ReorderCalculator;
    private demandForecaster: DemandForecaster;
    private alertManager: AlertManager;
    private platformConnector: PlatformConnector;

    private analysisInterval: NodeJS.Timeout | null;
    private lastAnalysis: Date | null;
    private isRunning: boolean;

    constructor(config: InventoryOracleConfig) {
        super();
        this.config = config;

        // Initialize components
        this.velocityAnalyzer = new SalesVelocityAnalyzer();
        this.seasonalDetector = new SeasonalPatternDetector(this.velocityAnalyzer);
        this.stockoutPredictor = new StockoutPredictor(
            this.velocityAnalyzer,
            this.seasonalDetector
        );
        this.safetyStockCalculator = new SafetyStockCalculator(this.velocityAnalyzer);
        this.reorderCalculator = new ReorderCalculator(
            this.stockoutPredictor,
            this.safetyStockCalculator,
            this.velocityAnalyzer,
            this.seasonalDetector
        );
        this.demandForecaster = new DemandForecaster(
            this.velocityAnalyzer,
            this.seasonalDetector
        );
        this.alertManager = new AlertManager(config.webhookUrl);
        this.platformConnector = new PlatformConnector();

        // Register platforms
        for (const platform of config.platforms) {
            this.platformConnector.registerPlatform(platform);
        }

        // Forward alert events
        this.alertManager.on('alert', (alert) => {
            this.emit('alert', alert);
        });

        this.analysisInterval = null;
        this.lastAnalysis = null;
        this.isRunning = false;
    }

    /**
     * Start automated inventory analysis.
     */
    start(): void {
        if (this.isRunning) {
            console.warn('[InventoryOracle] Already running');
            return;
        }

        this.isRunning = true;
        console.log('[InventoryOracle] Starting inventory analysis service');

        // Run initial sync and analysis
        this.syncAndAnalyze().catch(err => {
            console.error('[InventoryOracle] Initial sync failed:', err);
        });

        // Schedule periodic analysis
        this.analysisInterval = setInterval(() => {
            this.syncAndAnalyze().catch(err => {
                console.error('[InventoryOracle] Scheduled analysis failed:', err);
            });
        }, this.config.analysisIntervalMs);

        // Periodic cleanup
        setInterval(() => {
            this.alertManager.cleanup();
        }, 60 * 60 * 1000); // Hourly

        this.emit('started');
    }

    /**
     * Stop automated inventory analysis.
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;

        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }

        console.log('[InventoryOracle] Stopped inventory analysis service');
        this.emit('stopped');
    }

    /**
     * Sync data from platforms and run analysis.
     */
    private async syncAndAnalyze(): Promise<AnalysisResult> {
        console.log('[InventoryOracle] Starting sync and analysis...');
        const startTime = Date.now();

        try {
            // Sync from all platforms
            await this.syncAllPlatforms();

            // Run analysis
            const result = await this.analyzeAll();

            this.lastAnalysis = new Date();
            const duration = Date.now() - startTime;
            console.log(`[InventoryOracle] Sync and analysis completed in ${duration}ms`);

            this.emit('analysis_complete', result);
            return result;
        } catch (error) {
            console.error('[InventoryOracle] Sync and analysis failed:', error);
            this.emit('analysis_error', error);
            throw error;
        }
    }

    /**
     * Sync data from all registered platforms.
     */
    private async syncAllPlatforms(): Promise<void> {
        const platforms = this.platformConnector.getRegisteredPlatforms();
        const sinceDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Last 90 days

        for (const platform of platforms) {
            try {
                // Fetch products
                const products = await this.platformConnector.fetchProducts(platform);
                for (const product of products) {
                    this.stockoutPredictor.updateProduct(product);
                }

                // Fetch inventory
                const inventory = await this.platformConnector.fetchInventoryLevels(platform);
                for (const level of inventory) {
                    this.stockoutPredictor.updateInventory(level);
                }

                // Fetch sales
                const sales = await this.platformConnector.fetchSalesData(platform, sinceDate);
                for (const [productId, dataPoints] of sales) {
                    this.velocityAnalyzer.importSalesData(productId, dataPoints);
                }

                console.log(`[InventoryOracle] Synced ${platform}: ${products.length} products, ${inventory.length} inventory levels`);
            } catch (error) {
                console.error(`[InventoryOracle] Failed to sync ${platform}:`, error);
            }
        }
    }

    /**
     * Predict when a specific product will run out of stock.
     */
    predict(productId: string): StockoutPrediction | null {
        return this.stockoutPredictor.predictStockout(productId);
    }

    /**
     * Analyze all products and generate comprehensive report.
     */
    async analyzeAll(): Promise<AnalysisResult> {
        const trackedProducts = this.velocityAnalyzer.getTrackedProducts();
        console.log(`[InventoryOracle] Analyzing ${trackedProducts.length} products...`);

        // Calculate velocities
        for (const productId of trackedProducts) {
            this.velocityAnalyzer.calculateVelocity(productId);
        }

        // Detect seasonal patterns if enabled
        if (this.config.seasonalAnalysisEnabled) {
            for (const productId of trackedProducts) {
                this.seasonalDetector.detectPatterns(productId);
            }
        }

        // Generate stockout predictions
        const stockoutPredictions = this.stockoutPredictor.predictAllStockouts();

        // Generate reorder recommendations
        const reorderRecommendations = this.reorderCalculator.calculateAllReorders();

        // Generate forecasts if ML enabled
        const forecasts: DemandForecast[] = [];
        if (this.config.mlForecastingEnabled) {
            for (const productId of trackedProducts.slice(0, 50)) { // Limit for performance
                const productForecasts = this.demandForecaster.forecast(
                    productId,
                    this.config.forecastHorizonDays
                );
                forecasts.push(...productForecasts.slice(0, 7)); // First week per product
            }
        }

        // Generate alerts if enabled
        let alerts: StockAlert[] = [];
        if (this.config.alertingEnabled) {
            alerts = this.alertManager.generateAlertsFromPredictions(stockoutPredictions, {
                criticalThresholdDays: this.config.criticalStockThresholdDays,
                lowStockThresholdDays: this.config.lowStockThresholdDays,
            });
        }

        // Calculate summary
        const summary = this.calculateSummary(stockoutPredictions, reorderRecommendations);

        return {
            timestamp: new Date(),
            productsAnalyzed: trackedProducts.length,
            stockoutPredictions,
            reorderRecommendations,
            alerts,
            forecasts,
            summary,
        };
    }

    /**
     * Calculate analysis summary.
     */
    private calculateSummary(
        predictions: StockoutPrediction[],
        recommendations: ReorderRecommendation[]
    ): AnalysisResult['summary'] {
        const healthyProducts = predictions.filter(p => p.riskLevel === 'low').length;
        const lowStockProducts = predictions.filter(p => p.riskLevel === 'medium').length;
        const criticalProducts = predictions.filter(p =>
            p.riskLevel === 'high' || p.riskLevel === 'critical'
        ).length;

        const overstockedProducts = predictions.filter(p =>
            p.daysUntilStockout > 90 && p.currentStock > 0
        ).length;

        // Calculate total inventory value (rough estimate)
        let totalInventoryValue = 0;
        for (const productId of this.velocityAnalyzer.getTrackedProducts()) {
            const inventory = this.stockoutPredictor.getInventoryLevel(productId);
            const product = this.stockoutPredictor.getProduct(productId);
            if (inventory && product) {
                totalInventoryValue += inventory.currentStock * product.cost;
            }
        }

        const projectedStockouts7Days = predictions.filter(p =>
            p.daysUntilStockout <= 7 && p.currentStock > 0
        ).length;

        const projectedStockouts30Days = predictions.filter(p =>
            p.daysUntilStockout <= 30 && p.currentStock > 0
        ).length;

        return {
            healthyProducts,
            lowStockProducts,
            criticalProducts,
            overstockedProducts,
            totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
            projectedStockouts7Days,
            projectedStockouts30Days,
        };
    }

    /**
     * Get sales velocity for a product.
     */
    getVelocity(productId: string): SalesVelocity | null {
        return this.velocityAnalyzer.calculateVelocity(productId);
    }

    /**
     * Get seasonal pattern for a product.
     */
    getSeasonalPattern(productId: string): SeasonalPattern | null {
        return this.seasonalDetector.getPattern(productId);
    }

    /**
     * Get reorder recommendation for a product.
     */
    getReorderRecommendation(productId: string): ReorderRecommendation | null {
        return this.reorderCalculator.calculateReorder(productId);
    }

    /**
     * Get demand forecast for a product.
     */
    getDemandForecast(productId: string, horizonDays?: number): DemandForecast[] {
        return this.demandForecaster.forecast(productId, horizonDays);
    }

    /**
     * Get active alerts.
     */
    getAlerts(severity?: AlertSeverity): StockAlert[] {
        return this.alertManager.getActiveAlerts(severity);
    }

    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string): boolean {
        return this.alertManager.acknowledgeAlert(alertId);
    }

    /**
     * Register a platform.
     */
    registerPlatform(credentials: PlatformCredentials): void {
        this.platformConnector.registerPlatform(credentials);
    }

    /**
     * Get platform sync status.
     */
    getPlatformStatus(): Map<PlatformType, { lastSync: Date; status: 'success' | 'error'; error?: string }> {
        return this.platformConnector.getSyncStatus();
    }

    /**
     * Manually trigger sync for a platform.
     */
    async syncPlatform(platform: PlatformType): Promise<void> {
        const sinceDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const products = await this.platformConnector.fetchProducts(platform);
        for (const product of products) {
            this.stockoutPredictor.updateProduct(product);
        }

        const inventory = await this.platformConnector.fetchInventoryLevels(platform);
        for (const level of inventory) {
            this.stockoutPredictor.updateInventory(level);
        }

        const sales = await this.platformConnector.fetchSalesData(platform, sinceDate);
        for (const [productId, dataPoints] of sales) {
            this.velocityAnalyzer.importSalesData(productId, dataPoints);
        }
    }

    /**
     * Manually record a sale.
     */
    recordSale(productId: string, quantity: number, revenue: number, orderId?: string): void {
        this.velocityAnalyzer.recordSale(productId, {
            timestamp: new Date(),
            quantity,
            revenue,
            orderId,
        });
    }

    /**
     * Update inventory level manually.
     */
    updateInventory(level: InventoryLevel): void {
        this.stockoutPredictor.updateInventory(level);
    }

    /**
     * Update product information manually.
     */
    updateProduct(product: Product): void {
        this.stockoutPredictor.updateProduct(product);
    }

    /**
     * Get service status.
     */
    getStatus(): {
        isRunning: boolean;
        lastAnalysis: Date | null;
        trackedProducts: number;
        registeredPlatforms: PlatformType[];
        activeAlerts: number;
        alertStats: ReturnType<AlertManager['getStats']>;
    } {
        return {
            isRunning: this.isRunning,
            lastAnalysis: this.lastAnalysis,
            trackedProducts: this.velocityAnalyzer.getTrackedProducts().length,
            registeredPlatforms: this.platformConnector.getRegisteredPlatforms(),
            activeAlerts: this.alertManager.getActiveAlerts().length,
            alertStats: this.alertManager.getStats(),
        };
    }

    /**
     * Force refresh all data.
     */
    async refresh(): Promise<AnalysisResult> {
        return this.syncAndAnalyze();
    }

    /**
     * Get component instances for advanced usage.
     */
    getComponents(): {
        velocityAnalyzer: SalesVelocityAnalyzer;
        seasonalDetector: SeasonalPatternDetector;
        stockoutPredictor: StockoutPredictor;
        safetyStockCalculator: SafetyStockCalculator;
        reorderCalculator: ReorderCalculator;
        demandForecaster: DemandForecaster;
        alertManager: AlertManager;
        platformConnector: PlatformConnector;
    } {
        return {
            velocityAnalyzer: this.velocityAnalyzer,
            seasonalDetector: this.seasonalDetector,
            stockoutPredictor: this.stockoutPredictor,
            safetyStockCalculator: this.safetyStockCalculator,
            reorderCalculator: this.reorderCalculator,
            demandForecaster: this.demandForecaster,
            alertManager: this.alertManager,
            platformConnector: this.platformConnector,
        };
    }
}

// ============================================================================
// Factory function and singleton
// ============================================================================

let inventoryOracleInstance: InventoryOracle | null = null;

/**
 * Create an InventoryOracle instance with the provided configuration.
 */
export function createInventoryOracle(config: InventoryOracleConfig): InventoryOracle {
    return new InventoryOracle(config);
}

/**
 * Get or create a singleton InventoryOracle instance.
 */
export function getInventoryOracle(config?: InventoryOracleConfig): InventoryOracle {
    if (!inventoryOracleInstance) {
        if (!config) {
            // Default configuration
            config = {
                platforms: [],
                analysisIntervalMs: 30 * 60 * 1000, // 30 minutes
                defaultLeadTimeDays: 7,
                safetyStockDays: 7,
                lowStockThresholdDays: 14,
                criticalStockThresholdDays: 5,
                forecastHorizonDays: 30,
                seasonalAnalysisEnabled: true,
                mlForecastingEnabled: true,
                alertingEnabled: true,
            };
        }
        inventoryOracleInstance = new InventoryOracle(config);
    }
    return inventoryOracleInstance;
}

export default InventoryOracle;
