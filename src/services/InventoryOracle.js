// @ts-nocheck
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
// ============================================================================
// SalesVelocityAnalyzer - Tracks sales rates over time
// ============================================================================
export class SalesVelocityAnalyzer {
    salesHistory;
    velocityCache;
    maxHistoryDays;
    constructor(maxHistoryDays = 365) {
        this.salesHistory = new Map();
        this.velocityCache = new Map();
        this.maxHistoryDays = maxHistoryDays;
    }
    /**
     * Record a sales transaction.
     */
    recordSale(productId, dataPoint) {
        if (!this.salesHistory.has(productId)) {
            this.salesHistory.set(productId, []);
        }
        const history = this.salesHistory.get(productId);
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
    importSalesData(productId, dataPoints) {
        const existing = this.salesHistory.get(productId) || [];
        const combined = [...existing, ...dataPoints];
        // Sort by timestamp and deduplicate
        combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const unique = combined.filter((dp, index, arr) => index === 0 || dp.timestamp.getTime() !== arr[index - 1].timestamp.getTime());
        const cutoffDate = new Date(Date.now() - this.maxHistoryDays * 24 * 60 * 60 * 1000);
        const filtered = unique.filter(dp => dp.timestamp >= cutoffDate);
        this.salesHistory.set(productId, filtered);
        this.velocityCache.delete(productId);
    }
    /**
     * Calculate sales velocity for a product.
     */
    calculateVelocity(productId) {
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
        const last7Days = history.filter(dp => now.getTime() - dp.timestamp.getTime() <= 7 * dayMs);
        const last30Days = history.filter(dp => now.getTime() - dp.timestamp.getTime() <= 30 * dayMs);
        const last90Days = history.filter(dp => now.getTime() - dp.timestamp.getTime() <= 90 * dayMs);
        const dailyAverage = this.calculateDailyAverage(last7Days, 7);
        const weeklyAverage = this.calculateDailyAverage(last30Days, 30) * 7;
        const monthlyAverage = this.calculateDailyAverage(last90Days, 90) * 30;
        // Calculate trend
        const trend = this.calculateTrend(history);
        // Calculate volatility (coefficient of variation)
        const volatility = this.calculateVolatility(last30Days);
        const velocity = {
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
    calculateDailyAverage(dataPoints, days) {
        if (dataPoints.length === 0)
            return 0;
        const totalQuantity = dataPoints.reduce((sum, dp) => sum + dp.quantity, 0);
        return totalQuantity / days;
    }
    /**
     * Calculate trend direction and strength.
     */
    calculateTrend(history) {
        if (history.length < 14) {
            return { direction: 'stable', strength: 0 };
        }
        const dayMs = 24 * 60 * 60 * 1000;
        const now = Date.now();
        // Compare recent 7 days to previous 7 days
        const recent = history.filter(dp => now - dp.timestamp.getTime() <= 7 * dayMs);
        const previous = history.filter(dp => now - dp.timestamp.getTime() > 7 * dayMs &&
            now - dp.timestamp.getTime() <= 14 * dayMs);
        const recentAvg = recent.reduce((sum, dp) => sum + dp.quantity, 0) / 7;
        const previousAvg = previous.reduce((sum, dp) => sum + dp.quantity, 0) / 7;
        if (previousAvg === 0) {
            return { direction: recentAvg > 0 ? 'increasing' : 'stable', strength: 0 };
        }
        const changeRate = (recentAvg - previousAvg) / previousAvg;
        if (changeRate > 0.1) {
            return { direction: 'increasing', strength: Math.min(changeRate, 1) };
        }
        else if (changeRate < -0.1) {
            return { direction: 'decreasing', strength: Math.max(changeRate, -1) };
        }
        return { direction: 'stable', strength: changeRate };
    }
    /**
     * Calculate volatility (coefficient of variation).
     */
    calculateVolatility(dataPoints) {
        if (dataPoints.length < 2)
            return 0;
        // Group by day
        const dailySales = new Map();
        for (const dp of dataPoints) {
            const dayKey = dp.timestamp.toISOString().split('T')[0];
            dailySales.set(dayKey, (dailySales.get(dayKey) || 0) + dp.quantity);
        }
        const values = Array.from(dailySales.values());
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        if (mean === 0)
            return 0;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        // Coefficient of variation, capped at 1
        return Math.min(stdDev / mean, 1);
    }
    /**
     * Get sales history for a product.
     */
    getSalesHistory(productId, days) {
        const history = this.salesHistory.get(productId) || [];
        if (!days)
            return [...history];
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return history.filter(dp => dp.timestamp >= cutoffDate);
    }
    /**
     * Get all tracked product IDs.
     */
    getTrackedProducts() {
        return Array.from(this.salesHistory.keys());
    }
    /**
     * Clear all data for a product.
     */
    clearProduct(productId) {
        this.salesHistory.delete(productId);
        this.velocityCache.delete(productId);
    }
    /**
     * Clear all data.
     */
    clearAll() {
        this.salesHistory.clear();
        this.velocityCache.clear();
    }
}
// ============================================================================
// SeasonalPatternDetector - Identifies seasonal demand patterns
// ============================================================================
export class SeasonalPatternDetector {
    patterns;
    salesAnalyzer;
    constructor(salesAnalyzer) {
        this.patterns = new Map();
        this.salesAnalyzer = salesAnalyzer;
    }
    /**
     * Detect seasonal patterns for a product.
     */
    detectPatterns(productId) {
        const history = this.salesAnalyzer.getSalesHistory(productId);
        if (history.length < 90) {
            return null; // Need at least 3 months of data
        }
        // Group sales by month
        const monthlySales = new Map();
        for (let month = 1; month <= 12; month++) {
            monthlySales.set(month, []);
        }
        for (const dp of history) {
            const month = dp.timestamp.getMonth() + 1;
            const existing = monthlySales.get(month);
            existing.push(dp.quantity);
        }
        // Calculate monthly averages
        const monthlyAverages = [];
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
        const pattern = {
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
    determineSeasonType(peakMonth) {
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
    calculateSeasonalConfidence(history, monthlyAverages) {
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
        }
        else if (years === 1) {
            confidence += 20;
        }
        return Math.round(Math.min(confidence, 100));
    }
    /**
     * Get seasonal multiplier for a product at a given date.
     */
    getSeasonalMultiplier(productId, date = new Date()) {
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
    getPattern(productId) {
        return this.patterns.get(productId) || null;
    }
    /**
     * Check if product is approaching peak season.
     */
    isApproachingPeakSeason(productId, withinDays = 30) {
        const pattern = this.patterns.get(productId);
        if (!pattern)
            return false;
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
    velocityAnalyzer;
    seasonalDetector;
    inventoryLevels;
    products;
    constructor(velocityAnalyzer, seasonalDetector) {
        this.velocityAnalyzer = velocityAnalyzer;
        this.seasonalDetector = seasonalDetector;
        this.inventoryLevels = new Map();
        this.products = new Map();
    }
    /**
     * Update inventory level for a product.
     */
    updateInventory(level) {
        this.inventoryLevels.set(level.productId, level);
    }
    /**
     * Update product information.
     */
    updateProduct(product) {
        this.products.set(product.id, product);
    }
    /**
     * Predict stockout for a single product.
     */
    predictStockout(productId) {
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
    predictAllStockouts() {
        const predictions = [];
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
    calculatePredictionConfidence(velocity, seasonalMultiplier) {
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
    determineRiskLevel(daysUntilStockout, leadTimeDays) {
        const bufferRatio = daysUntilStockout / leadTimeDays;
        if (bufferRatio < 0.5 || daysUntilStockout <= 3) {
            return 'critical';
        }
        else if (bufferRatio < 1 || daysUntilStockout <= 7) {
            return 'high';
        }
        else if (bufferRatio < 1.5 || daysUntilStockout <= 14) {
            return 'medium';
        }
        return 'low';
    }
    /**
     * Identify factors contributing to stockout prediction.
     */
    identifyFactors(velocity, seasonalMultiplier, daysUntilStockout) {
        const factors = [];
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
    getInventoryLevel(productId) {
        return this.inventoryLevels.get(productId) || null;
    }
    /**
     * Get product information.
     */
    getProduct(productId) {
        return this.products.get(productId) || null;
    }
}
// ============================================================================
// SafetyStockCalculator - Calculates safety stock based on demand variability
// ============================================================================
export class SafetyStockCalculator {
    velocityAnalyzer;
    defaultServiceLevel; // 0-1, e.g., 0.95 = 95%
    constructor(velocityAnalyzer, defaultServiceLevel = 0.95) {
        this.velocityAnalyzer = velocityAnalyzer;
        this.defaultServiceLevel = defaultServiceLevel;
    }
    /**
     * Calculate safety stock for a product.
     */
    calculateSafetyStock(productId, leadTimeDays, serviceLevel) {
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
    calculateReorderPoint(productId, leadTimeDays, serviceLevel) {
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
    groupByDay(dataPoints) {
        const dailyMap = new Map();
        for (const dp of dataPoints) {
            const dayKey = dp.timestamp.toISOString().split('T')[0];
            dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + dp.quantity);
        }
        return Array.from(dailyMap.values());
    }
    /**
     * Calculate standard deviation.
     */
    calculateStdDev(values) {
        if (values.length < 2)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    /**
     * Get Z-score for service level.
     */
    getZScore(serviceLevel) {
        // Approximate Z-scores for common service levels
        const zScores = {
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
    stockoutPredictor;
    safetyStockCalculator;
    velocityAnalyzer;
    seasonalDetector;
    constructor(stockoutPredictor, safetyStockCalculator, velocityAnalyzer, seasonalDetector) {
        this.stockoutPredictor = stockoutPredictor;
        this.safetyStockCalculator = safetyStockCalculator;
        this.velocityAnalyzer = velocityAnalyzer;
        this.seasonalDetector = seasonalDetector;
    }
    /**
     * Calculate reorder recommendation for a product.
     */
    calculateReorder(productId, config = {}) {
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
        const reorderPointResult = this.safetyStockCalculator.calculateReorderPoint(productId, leadTimeDays);
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
        const reasoning = this.generateReasoning(currentStock, reorderPoint, safetyStock, velocity, urgency);
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
    calculateFutureDemand(productId, days) {
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);
        if (!velocity)
            return 0;
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
    determineUrgency(currentStock, reorderPoint, daysUntilStockout) {
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
    generateReasoning(currentStock, reorderPoint, safetyStock, velocity, urgency) {
        const reasons = [];
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
    calculateAllReorders() {
        const recommendations = [];
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
    velocityAnalyzer;
    seasonalDetector;
    forecastCache;
    constructor(velocityAnalyzer, seasonalDetector) {
        this.velocityAnalyzer = velocityAnalyzer;
        this.seasonalDetector = seasonalDetector;
        this.forecastCache = new Map();
    }
    /**
     * Generate demand forecast for a product.
     */
    forecast(productId, horizonDays = 30, method = 'exponential_smoothing') {
        const history = this.velocityAnalyzer.getSalesHistory(productId);
        const velocity = this.velocityAnalyzer.calculateVelocity(productId);
        if (!velocity || history.length < 14) {
            return [];
        }
        const forecasts = [];
        const now = new Date();
        // Group historical data by day
        const dailySales = this.groupSalesByDay(history);
        for (let i = 1; i <= horizonDays; i++) {
            const forecastDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
            let predictedDemand;
            let factors = [];
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
            const confidence = this.calculateForecastConfidence(history.length, velocity.volatility, i);
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
    groupSalesByDay(history) {
        const dailyMap = new Map();
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
    movingAverageForecast(dailySales) {
        const window = Math.min(7, dailySales.length);
        const recent = dailySales.slice(-window);
        return recent.reduce((a, b) => a + b, 0) / window;
    }
    /**
     * Exponential smoothing forecast.
     */
    exponentialSmoothingForecast(dailySales, alpha = 0.3) {
        if (dailySales.length === 0)
            return 0;
        let forecast = dailySales[0];
        for (let i = 1; i < dailySales.length; i++) {
            forecast = alpha * dailySales[i] + (1 - alpha) * forecast;
        }
        return forecast;
    }
    /**
     * Ensemble forecast combining multiple methods.
     */
    ensembleForecast(dailySales, velocity) {
        const ma = this.movingAverageForecast(dailySales);
        const es = this.exponentialSmoothingForecast(dailySales);
        const weightedAvg = velocity.dailyAverage;
        // Weighted combination
        return (ma * 0.3 + es * 0.4 + weightedAvg * 0.3);
    }
    /**
     * Calculate forecast confidence.
     */
    calculateForecastConfidence(dataPoints, volatility, daysAhead) {
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
    getCachedForecast(productId) {
        return this.forecastCache.get(productId) || [];
    }
}
// ============================================================================
// AlertManager - Low stock notifications
// ============================================================================
export class AlertManager extends EventEmitter {
    alerts;
    alertHistory;
    webhookUrl;
    maxHistorySize;
    constructor(webhookUrl) {
        super();
        this.alerts = new Map();
        this.alertHistory = [];
        this.webhookUrl = webhookUrl;
        this.maxHistorySize = 1000;
    }
    /**
     * Create a stock alert.
     */
    createAlert(params) {
        const alert = {
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
    generateAlertsFromPredictions(predictions, config) {
        const newAlerts = [];
        for (const prediction of predictions) {
            let alertType;
            let severity;
            let message;
            let suggestedAction;
            if (prediction.currentStock <= 0) {
                alertType = 'stockout';
                severity = 'urgent';
                message = `STOCKOUT: ${prediction.productName} has no available stock`;
                suggestedAction = 'Emergency reorder required immediately';
            }
            else if (prediction.daysUntilStockout <= config.criticalThresholdDays) {
                alertType = 'stockout_imminent';
                severity = 'critical';
                message = `${prediction.productName} will stock out in ${prediction.daysUntilStockout} days`;
                suggestedAction = `Place urgent order - ${Math.ceil(prediction.dailyVelocity * 14)} units recommended`;
            }
            else if (prediction.daysUntilStockout <= config.lowStockThresholdDays) {
                alertType = 'low_stock';
                severity = 'warning';
                message = `${prediction.productName} stock is low - ${prediction.daysUntilStockout} days remaining`;
                suggestedAction = 'Schedule reorder within the next few days';
            }
            else {
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
    createVelocityChangeAlert(productId, sku, productName, changePercent, direction) {
        const severity = Math.abs(changePercent) > 50 ? 'warning' : 'info';
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
    createSeasonalWarningAlert(productId, sku, productName, season, daysUntilPeak) {
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
     * Get active alerts.
     */
    getActiveAlerts(severity) {
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
    getAlertsByProduct(productId) {
        return Array.from(this.alerts.values())
            .filter(a => a.productId === productId);
    }
    /**
     * Send webhook notification.
     */
    async sendWebhook(alert) {
        if (!this.webhookUrl)
            return;
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
        }
        catch (error) {
            console.error('[AlertManager] Webhook request failed:', error);
        }
    }
    /**
     * Cleanup expired alerts.
     */
    cleanup() {
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
    getStats() {
        const alerts = Array.from(this.alerts.values());
        const now = new Date();
        const active = alerts.filter(a => a.expiresAt > now && !a.acknowledged);
        const bySeverity = {
            urgent: 0,
            critical: 0,
            warning: 0,
            info: 0,
        };
        const byType = {};
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
    credentials;
    syncStatus;
    constructor() {
        this.credentials = new Map();
        this.syncStatus = new Map();
    }
    /**
     * Register platform credentials.
     */
    registerPlatform(credentials) {
        this.credentials.set(credentials.platform, credentials);
    }
    /**
     * Remove platform credentials.
     */
    removePlatform(platform) {
        return this.credentials.delete(platform);
    }
    /**
     * Fetch products from a platform.
     */
    async fetchProducts(platform) {
        const creds = this.credentials.get(platform);
        if (!creds) {
            throw new Error(`Platform ${platform} not configured`);
        }
        try {
            let products;
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
        }
        catch (error) {
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
    async fetchInventoryLevels(platform) {
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
    async fetchSalesData(platform, sinceDate) {
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
    async fetchShopifyProducts(creds) {
        // In production, use Shopify Admin API
        // GET https://{shop}.myshopify.com/admin/api/2024-01/products.json
        console.log('[PlatformConnector] Fetching Shopify products...');
        return this.generateMockProducts('shopify');
    }
    async fetchWooCommerceProducts(creds) {
        // In production, use WooCommerce REST API
        // GET https://{site}/wp-json/wc/v3/products
        console.log('[PlatformConnector] Fetching WooCommerce products...');
        return this.generateMockProducts('woocommerce');
    }
    async fetchMagentoProducts(creds) {
        console.log('[PlatformConnector] Fetching Magento products...');
        return this.generateMockProducts('magento');
    }
    async fetchBigCommerceProducts(creds) {
        console.log('[PlatformConnector] Fetching BigCommerce products...');
        return this.generateMockProducts('bigcommerce');
    }
    async fetchAmazonProducts(creds) {
        console.log('[PlatformConnector] Fetching Amazon products...');
        return this.generateMockProducts('amazon');
    }
    async fetchCustomProducts(creds) {
        console.log('[PlatformConnector] Fetching custom platform products...');
        return this.generateMockProducts('custom');
    }
    async fetchShopifyInventory(creds) {
        // GET https://{shop}.myshopify.com/admin/api/2024-01/inventory_levels.json
        console.log('[PlatformConnector] Fetching Shopify inventory...');
        return this.generateMockInventory();
    }
    async fetchWooCommerceInventory(creds) {
        console.log('[PlatformConnector] Fetching WooCommerce inventory...');
        return this.generateMockInventory();
    }
    async fetchGenericInventory(creds, platform) {
        console.log(`[PlatformConnector] Fetching ${platform} inventory...`);
        return this.generateMockInventory();
    }
    async fetchShopifySales(creds, sinceDate) {
        // GET https://{shop}.myshopify.com/admin/api/2024-01/orders.json
        console.log('[PlatformConnector] Fetching Shopify sales...');
        return this.generateMockSalesData(sinceDate);
    }
    async fetchWooCommerceSales(creds, sinceDate) {
        console.log('[PlatformConnector] Fetching WooCommerce sales...');
        return this.generateMockSalesData(sinceDate);
    }
    async fetchGenericSales(creds, platform, sinceDate) {
        console.log(`[PlatformConnector] Fetching ${platform} sales...`);
        return this.generateMockSalesData(sinceDate);
    }
    // Mock data generators for development
    generateMockProducts(platform) {
        const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Beauty'];
        const products = [];
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
    generateMockInventory() {
        const levels = [];
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
    generateMockSalesData(sinceDate) {
        const salesMap = new Map();
        const platforms = ['shopify', 'woocommerce'];
        const now = Date.now();
        const sinceTime = sinceDate.getTime();
        for (const platform of platforms) {
            for (let i = 1; i <= 20; i++) {
                const productId = `${platform}-prod-${i}`;
                const dataPoints = [];
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
    getSyncStatus() {
        return new Map(this.syncStatus);
    }
    /**
     * Get registered platforms.
     */
    getRegisteredPlatforms() {
        return Array.from(this.credentials.keys());
    }
}
// ============================================================================
// InventoryOracle - Main orchestrating class
// ============================================================================
export class InventoryOracle extends EventEmitter {
    config;
    velocityAnalyzer;
    seasonalDetector;
    stockoutPredictor;
    safetyStockCalculator;
    reorderCalculator;
    demandForecaster;
    alertManager;
    platformConnector;
    analysisInterval;
    lastAnalysis;
    isRunning;
    constructor(config) {
        super();
        this.config = config;
        // Initialize components
        this.velocityAnalyzer = new SalesVelocityAnalyzer();
        this.seasonalDetector = new SeasonalPatternDetector(this.velocityAnalyzer);
        this.stockoutPredictor = new StockoutPredictor(this.velocityAnalyzer, this.seasonalDetector);
        this.safetyStockCalculator = new SafetyStockCalculator(this.velocityAnalyzer);
        this.reorderCalculator = new ReorderCalculator(this.stockoutPredictor, this.safetyStockCalculator, this.velocityAnalyzer, this.seasonalDetector);
        this.demandForecaster = new DemandForecaster(this.velocityAnalyzer, this.seasonalDetector);
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
    start() {
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
    stop() {
        if (!this.isRunning)
            return;
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
    async syncAndAnalyze() {
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
        }
        catch (error) {
            console.error('[InventoryOracle] Sync and analysis failed:', error);
            this.emit('analysis_error', error);
            throw error;
        }
    }
    /**
     * Sync data from all registered platforms.
     */
    async syncAllPlatforms() {
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
            }
            catch (error) {
                console.error(`[InventoryOracle] Failed to sync ${platform}:`, error);
            }
        }
    }
    /**
     * Predict when a specific product will run out of stock.
     */
    predict(productId) {
        return this.stockoutPredictor.predictStockout(productId);
    }
    /**
     * Analyze all products and generate comprehensive report.
     */
    async analyzeAll() {
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
        const forecasts = [];
        if (this.config.mlForecastingEnabled) {
            for (const productId of trackedProducts.slice(0, 50)) { // Limit for performance
                const productForecasts = this.demandForecaster.forecast(productId, this.config.forecastHorizonDays);
                forecasts.push(...productForecasts.slice(0, 7)); // First week per product
            }
        }
        // Generate alerts if enabled
        let alerts = [];
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
    calculateSummary(predictions, recommendations) {
        const healthyProducts = predictions.filter(p => p.riskLevel === 'low').length;
        const lowStockProducts = predictions.filter(p => p.riskLevel === 'medium').length;
        const criticalProducts = predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
        const overstockedProducts = predictions.filter(p => p.daysUntilStockout > 90 && p.currentStock > 0).length;
        // Calculate total inventory value (rough estimate)
        let totalInventoryValue = 0;
        for (const productId of this.velocityAnalyzer.getTrackedProducts()) {
            const inventory = this.stockoutPredictor.getInventoryLevel(productId);
            const product = this.stockoutPredictor.getProduct(productId);
            if (inventory && product) {
                totalInventoryValue += inventory.currentStock * product.cost;
            }
        }
        const projectedStockouts7Days = predictions.filter(p => p.daysUntilStockout <= 7 && p.currentStock > 0).length;
        const projectedStockouts30Days = predictions.filter(p => p.daysUntilStockout <= 30 && p.currentStock > 0).length;
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
    getVelocity(productId) {
        return this.velocityAnalyzer.calculateVelocity(productId);
    }
    /**
     * Get seasonal pattern for a product.
     */
    getSeasonalPattern(productId) {
        return this.seasonalDetector.getPattern(productId);
    }
    /**
     * Get reorder recommendation for a product.
     */
    getReorderRecommendation(productId) {
        return this.reorderCalculator.calculateReorder(productId);
    }
    /**
     * Get demand forecast for a product.
     */
    getDemandForecast(productId, horizonDays) {
        return this.demandForecaster.forecast(productId, horizonDays);
    }
    /**
     * Get active alerts.
     */
    getAlerts(severity) {
        return this.alertManager.getActiveAlerts(severity);
    }
    /**
     * Acknowledge an alert.
     */
    acknowledgeAlert(alertId) {
        return this.alertManager.acknowledgeAlert(alertId);
    }
    /**
     * Register a platform.
     */
    registerPlatform(credentials) {
        this.platformConnector.registerPlatform(credentials);
    }
    /**
     * Get platform sync status.
     */
    getPlatformStatus() {
        return this.platformConnector.getSyncStatus();
    }
    /**
     * Manually trigger sync for a platform.
     */
    async syncPlatform(platform) {
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
    recordSale(productId, quantity, revenue, orderId) {
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
    updateInventory(level) {
        this.stockoutPredictor.updateInventory(level);
    }
    /**
     * Update product information manually.
     */
    updateProduct(product) {
        this.stockoutPredictor.updateProduct(product);
    }
    /**
     * Get service status.
     */
    getStatus() {
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
    async refresh() {
        return this.syncAndAnalyze();
    }
    /**
     * Get component instances for advanced usage.
     */
    getComponents() {
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
let inventoryOracleInstance = null;
/**
 * Create an InventoryOracle instance with the provided configuration.
 */
export function createInventoryOracle(config) {
    return new InventoryOracle(config);
}
/**
 * Get or create a singleton InventoryOracle instance.
 */
export function getInventoryOracle(config) {
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
//# sourceMappingURL=InventoryOracle.js.map