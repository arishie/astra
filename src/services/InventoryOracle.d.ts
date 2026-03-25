import { EventEmitter } from 'events';
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
    trendStrength: number;
    volatility: number;
    lastCalculated: Date;
}
export interface SeasonalPattern {
    productId: string;
    season: SeasonType;
    multiplier: number;
    peakMonth: number;
    troughMonth: number;
    confidence: number;
    historicalData: Array<{
        month: number;
        avgSales: number;
    }>;
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
    factors: Array<{
        name: string;
        impact: number;
    }>;
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
export declare class SalesVelocityAnalyzer {
    private salesHistory;
    private velocityCache;
    private maxHistoryDays;
    constructor(maxHistoryDays?: number);
    /**
     * Record a sales transaction.
     */
    recordSale(productId: string, dataPoint: SalesDataPoint): void;
    /**
     * Bulk import sales data.
     */
    importSalesData(productId: string, dataPoints: SalesDataPoint[]): void;
    /**
     * Calculate sales velocity for a product.
     */
    calculateVelocity(productId: string): SalesVelocity | null;
    /**
     * Calculate daily average from data points.
     */
    private calculateDailyAverage;
    /**
     * Calculate trend direction and strength.
     */
    private calculateTrend;
    /**
     * Calculate volatility (coefficient of variation).
     */
    private calculateVolatility;
    /**
     * Get sales history for a product.
     */
    getSalesHistory(productId: string, days?: number): SalesDataPoint[];
    /**
     * Get all tracked product IDs.
     */
    getTrackedProducts(): string[];
    /**
     * Clear all data for a product.
     */
    clearProduct(productId: string): void;
    /**
     * Clear all data.
     */
    clearAll(): void;
}
export declare class SeasonalPatternDetector {
    private patterns;
    private salesAnalyzer;
    constructor(salesAnalyzer: SalesVelocityAnalyzer);
    /**
     * Detect seasonal patterns for a product.
     */
    detectPatterns(productId: string): SeasonalPattern | null;
    /**
     * Determine season type from peak month.
     */
    private determineSeasonType;
    /**
     * Calculate confidence in seasonal pattern.
     */
    private calculateSeasonalConfidence;
    /**
     * Get seasonal multiplier for a product at a given date.
     */
    getSeasonalMultiplier(productId: string, date?: Date): number;
    /**
     * Get pattern for a product.
     */
    getPattern(productId: string): SeasonalPattern | null;
    /**
     * Check if product is approaching peak season.
     */
    isApproachingPeakSeason(productId: string, withinDays?: number): boolean;
}
export declare class StockoutPredictor {
    private velocityAnalyzer;
    private seasonalDetector;
    private inventoryLevels;
    private products;
    constructor(velocityAnalyzer: SalesVelocityAnalyzer, seasonalDetector: SeasonalPatternDetector);
    /**
     * Update inventory level for a product.
     */
    updateInventory(level: InventoryLevel): void;
    /**
     * Update product information.
     */
    updateProduct(product: Product): void;
    /**
     * Predict stockout for a single product.
     */
    predictStockout(productId: string): StockoutPrediction | null;
    /**
     * Predict stockouts for all products.
     */
    predictAllStockouts(): StockoutPrediction[];
    /**
     * Calculate prediction confidence.
     */
    private calculatePredictionConfidence;
    /**
     * Determine risk level based on days until stockout and lead time.
     */
    private determineRiskLevel;
    /**
     * Identify factors contributing to stockout prediction.
     */
    private identifyFactors;
    /**
     * Get inventory level for a product.
     */
    getInventoryLevel(productId: string): InventoryLevel | null;
    /**
     * Get product information.
     */
    getProduct(productId: string): Product | null;
}
export declare class SafetyStockCalculator {
    private velocityAnalyzer;
    private defaultServiceLevel;
    constructor(velocityAnalyzer: SalesVelocityAnalyzer, defaultServiceLevel?: number);
    /**
     * Calculate safety stock for a product.
     */
    calculateSafetyStock(productId: string, leadTimeDays: number, serviceLevel?: number): {
        quantity: number;
        daysOfCover: number;
        formula: string;
    } | null;
    /**
     * Calculate reorder point (safety stock + lead time demand).
     */
    calculateReorderPoint(productId: string, leadTimeDays: number, serviceLevel?: number): {
        reorderPoint: number;
        safetyStock: number;
        leadTimeDemand: number;
    } | null;
    /**
     * Group sales data by day.
     */
    private groupByDay;
    /**
     * Calculate standard deviation.
     */
    private calculateStdDev;
    /**
     * Get Z-score for service level.
     */
    private getZScore;
}
export declare class ReorderCalculator {
    private stockoutPredictor;
    private safetyStockCalculator;
    private velocityAnalyzer;
    private seasonalDetector;
    constructor(stockoutPredictor: StockoutPredictor, safetyStockCalculator: SafetyStockCalculator, velocityAnalyzer: SalesVelocityAnalyzer, seasonalDetector: SeasonalPatternDetector);
    /**
     * Calculate reorder recommendation for a product.
     */
    calculateReorder(productId: string, config?: {
        targetDaysOfStock?: number;
        maxOrderQuantity?: number;
        minOrderQuantity?: number;
    }): ReorderRecommendation | null;
    /**
     * Calculate future demand with seasonal adjustments.
     */
    private calculateFutureDemand;
    /**
     * Determine order urgency.
     */
    private determineUrgency;
    /**
     * Generate reasoning for recommendation.
     */
    private generateReasoning;
    /**
     * Calculate recommendations for all products.
     */
    calculateAllReorders(): ReorderRecommendation[];
}
export declare class DemandForecaster {
    private velocityAnalyzer;
    private seasonalDetector;
    private forecastCache;
    constructor(velocityAnalyzer: SalesVelocityAnalyzer, seasonalDetector: SeasonalPatternDetector);
    /**
     * Generate demand forecast for a product.
     */
    forecast(productId: string, horizonDays?: number, method?: ForecastMethod): DemandForecast[];
    /**
     * Group sales by day.
     */
    private groupSalesByDay;
    /**
     * Simple moving average forecast.
     */
    private movingAverageForecast;
    /**
     * Exponential smoothing forecast.
     */
    private exponentialSmoothingForecast;
    /**
     * Ensemble forecast combining multiple methods.
     */
    private ensembleForecast;
    /**
     * Calculate forecast confidence.
     */
    private calculateForecastConfidence;
    /**
     * Get cached forecast.
     */
    getCachedForecast(productId: string): DemandForecast[];
}
export declare class AlertManager extends EventEmitter {
    private alerts;
    private alertHistory;
    private webhookUrl?;
    private maxHistorySize;
    constructor(webhookUrl?: string);
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
    }): StockAlert;
    /**
     * Generate alerts based on stockout predictions.
     */
    generateAlertsFromPredictions(predictions: StockoutPrediction[], config: {
        criticalThresholdDays: number;
        lowStockThresholdDays: number;
    }): StockAlert[];
    /**
     * Create velocity change alert.
     */
    createVelocityChangeAlert(productId: string, sku: string, productName: string, changePercent: number, direction: 'increase' | 'decrease'): StockAlert;
    /**
     * Create seasonal warning alert.
     */
    createSeasonalWarningAlert(productId: string, sku: string, productName: string, season: SeasonType, daysUntilPeak: number): StockAlert;
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string): boolean;
    /**
     * Dismiss an alert.
     */
    dismissAlert(alertId: string): boolean;
    /**
     * Get active alerts.
     */
    getActiveAlerts(severity?: AlertSeverity): StockAlert[];
    /**
     * Get alerts by product.
     */
    getAlertsByProduct(productId: string): StockAlert[];
    /**
     * Send webhook notification.
     */
    private sendWebhook;
    /**
     * Cleanup expired alerts.
     */
    cleanup(): number;
    /**
     * Get alert statistics.
     */
    getStats(): {
        totalAlerts: number;
        activeAlerts: number;
        bySeverity: Record<AlertSeverity, number>;
        byType: Record<string, number>;
    };
}
export declare class PlatformConnector {
    private credentials;
    private syncStatus;
    constructor();
    /**
     * Register platform credentials.
     */
    registerPlatform(credentials: PlatformCredentials): void;
    /**
     * Remove platform credentials.
     */
    removePlatform(platform: PlatformType): boolean;
    /**
     * Fetch products from a platform.
     */
    fetchProducts(platform: PlatformType): Promise<Product[]>;
    /**
     * Fetch inventory levels from a platform.
     */
    fetchInventoryLevels(platform: PlatformType): Promise<InventoryLevel[]>;
    /**
     * Fetch recent orders/sales from a platform.
     */
    fetchSalesData(platform: PlatformType, sinceDate: Date): Promise<Map<string, SalesDataPoint[]>>;
    private fetchShopifyProducts;
    private fetchWooCommerceProducts;
    private fetchMagentoProducts;
    private fetchBigCommerceProducts;
    private fetchAmazonProducts;
    private fetchCustomProducts;
    private fetchShopifyInventory;
    private fetchWooCommerceInventory;
    private fetchGenericInventory;
    private fetchShopifySales;
    private fetchWooCommerceSales;
    private fetchGenericSales;
    private generateMockProducts;
    private generateMockInventory;
    private generateMockSalesData;
    /**
     * Get sync status for all platforms.
     */
    getSyncStatus(): Map<PlatformType, {
        lastSync: Date;
        status: 'success' | 'error';
        error?: string;
    }>;
    /**
     * Get registered platforms.
     */
    getRegisteredPlatforms(): PlatformType[];
}
export declare class InventoryOracle extends EventEmitter {
    private config;
    private velocityAnalyzer;
    private seasonalDetector;
    private stockoutPredictor;
    private safetyStockCalculator;
    private reorderCalculator;
    private demandForecaster;
    private alertManager;
    private platformConnector;
    private analysisInterval;
    private lastAnalysis;
    private isRunning;
    constructor(config: InventoryOracleConfig);
    /**
     * Start automated inventory analysis.
     */
    start(): void;
    /**
     * Stop automated inventory analysis.
     */
    stop(): void;
    /**
     * Sync data from platforms and run analysis.
     */
    private syncAndAnalyze;
    /**
     * Sync data from all registered platforms.
     */
    private syncAllPlatforms;
    /**
     * Predict when a specific product will run out of stock.
     */
    predict(productId: string): StockoutPrediction | null;
    /**
     * Analyze all products and generate comprehensive report.
     */
    analyzeAll(): Promise<AnalysisResult>;
    /**
     * Calculate analysis summary.
     */
    private calculateSummary;
    /**
     * Get sales velocity for a product.
     */
    getVelocity(productId: string): SalesVelocity | null;
    /**
     * Get seasonal pattern for a product.
     */
    getSeasonalPattern(productId: string): SeasonalPattern | null;
    /**
     * Get reorder recommendation for a product.
     */
    getReorderRecommendation(productId: string): ReorderRecommendation | null;
    /**
     * Get demand forecast for a product.
     */
    getDemandForecast(productId: string, horizonDays?: number): DemandForecast[];
    /**
     * Get active alerts.
     */
    getAlerts(severity?: AlertSeverity): StockAlert[];
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId: string): boolean;
    /**
     * Register a platform.
     */
    registerPlatform(credentials: PlatformCredentials): void;
    /**
     * Get platform sync status.
     */
    getPlatformStatus(): Map<PlatformType, {
        lastSync: Date;
        status: 'success' | 'error';
        error?: string;
    }>;
    /**
     * Manually trigger sync for a platform.
     */
    syncPlatform(platform: PlatformType): Promise<void>;
    /**
     * Manually record a sale.
     */
    recordSale(productId: string, quantity: number, revenue: number, orderId?: string): void;
    /**
     * Update inventory level manually.
     */
    updateInventory(level: InventoryLevel): void;
    /**
     * Update product information manually.
     */
    updateProduct(product: Product): void;
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
    };
    /**
     * Force refresh all data.
     */
    refresh(): Promise<AnalysisResult>;
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
    };
}
/**
 * Create an InventoryOracle instance with the provided configuration.
 */
export declare function createInventoryOracle(config: InventoryOracleConfig): InventoryOracle;
/**
 * Get or create a singleton InventoryOracle instance.
 */
export declare function getInventoryOracle(config?: InventoryOracleConfig): InventoryOracle;
export default InventoryOracle;
//# sourceMappingURL=InventoryOracle.d.ts.map