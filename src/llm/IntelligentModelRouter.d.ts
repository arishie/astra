/**
 * IntelligentModelRouter - Advanced Model Auto-Linker for Astra
 *
 * Provides intelligent task-based routing with:
 * - Automatic model selection based on task type
 * - User feedback learning
 * - Cost vs quality optimization
 * - Fallback chains for graceful degradation
 * - Performance tracking per task type
 * - A/B testing capabilities
 */
import { ModelRegistry } from './ModelRegistry.js';
import { ModelRouter, BrainRole } from './ModelRouter.js';
export declare enum TaskType {
    CODING = "coding",
    CREATIVE = "creative",
    ANALYSIS = "analysis",
    CONVERSATION = "conversation",
    SUMMARIZATION = "summarization",
    TRANSLATION = "translation",
    REASONING = "reasoning",
    FACTUAL = "factual",
    INSTRUCTION = "instruction",
    MULTIMODAL = "multimodal"
}
export declare enum TaskComplexity {
    TRIVIAL = 1,
    SIMPLE = 2,
    MODERATE = 3,
    COMPLEX = 4,
    EXPERT = 5
}
export declare enum CostTier {
    FREE = 0,
    BUDGET = 1,
    STANDARD = 2,
    PREMIUM = 3,
    ENTERPRISE = 4
}
export interface TaskAnalysis {
    type: TaskType;
    complexity: TaskComplexity;
    estimatedTokens: number;
    requiresReasoning: boolean;
    requiresCreativity: boolean;
    requiresAccuracy: boolean;
    urgency: 'low' | 'medium' | 'high';
    contextSensitivity: number;
}
export interface ModelCapabilities {
    modelName: string;
    supportedTasks: TaskType[];
    maxContextLength: number;
    costPerMillionTokens: number;
    averageLatencyMs: number;
    qualityScore: number;
    reasoningStrength: number;
    creativityScore: number;
    codeQuality: number;
    factualAccuracy: number;
    isLocal: boolean;
}
export interface ModelPerformanceMetrics {
    modelName: string;
    taskType: TaskType;
    totalRequests: number;
    successfulRequests: number;
    averageLatencyMs: number;
    averageTokensUsed: number;
    userSatisfactionScore: number;
    errorRate: number;
    lastUpdated: Date;
}
export interface UserPreferences {
    userId: string;
    preferredModels: Map<TaskType, string>;
    costSensitivity: number;
    qualityPreference: number;
    localModelPreference: boolean;
    feedbackHistory: FeedbackEntry[];
}
export interface FeedbackEntry {
    requestId: string;
    modelName: string;
    taskType: TaskType;
    rating: number;
    wasHelpful: boolean;
    latencyAcceptable: boolean;
    timestamp: Date;
    comment?: string;
}
export interface RoutingDecision {
    selectedModel: string;
    fallbackChain: string[];
    reasoning: string;
    estimatedCost: number;
    estimatedLatency: number;
    confidence: number;
}
export interface ExecutionResult {
    requestId: string;
    modelUsed: string;
    response: string;
    latencyMs: number;
    tokensUsed: number;
    fallbacksAttempted: number;
    success: boolean;
    error?: string;
}
export interface ABTestConfig {
    testId: string;
    testName: string;
    taskType: TaskType;
    modelA: string;
    modelB: string;
    trafficSplit: number;
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
}
export interface ABTestResult {
    testId: string;
    modelA: {
        requests: number;
        avgRating: number;
        avgLatency: number;
        successRate: number;
    };
    modelB: {
        requests: number;
        avgRating: number;
        avgLatency: number;
        successRate: number;
    };
    statisticalSignificance: number;
    recommendedModel: string;
}
export declare class EnhancedTaskClassifier {
    private static readonly CODING_KEYWORDS;
    private static readonly CREATIVE_KEYWORDS;
    private static readonly ANALYSIS_KEYWORDS;
    private static readonly REASONING_KEYWORDS;
    private static readonly FACTUAL_KEYWORDS;
    private static readonly INSTRUCTION_KEYWORDS;
    /**
     * Classifies a query into a task type with detailed analysis
     */
    static classify(query: string): TaskAnalysis;
    private static determineTaskType;
    private static calculateKeywordScore;
    private static determineComplexity;
    private static estimateResponseTokens;
    private static requiresReasoning;
    private static determineUrgency;
    private static calculateContextSensitivity;
}
export declare class ModelSelector {
    private modelCapabilities;
    private registry;
    constructor(registry: ModelRegistry);
    private initializeDefaultCapabilities;
    /**
     * Register or update model capabilities
     */
    registerCapabilities(capabilities: ModelCapabilities): void;
    /**
     * Get capabilities for a model
     */
    getCapabilities(modelName: string): ModelCapabilities | undefined;
    /**
     * Select optimal model based on task analysis and user preferences
     */
    selectModel(task: TaskAnalysis, userPreferences: UserPreferences, availableModels: string[], performanceMetrics: Map<string, ModelPerformanceMetrics[]>): RoutingDecision;
    private calculateModelScore;
    private estimateCost;
    private generateReasoning;
}
export declare class CostOptimizer {
    private budgetLimits;
    private usageTracking;
    /**
     * Set budget limits for a user
     */
    setBudgetLimits(userId: string, daily: number, monthly: number): void;
    /**
     * Check if a request is within budget
     */
    isWithinBudget(userId: string, estimatedCost: number): boolean;
    /**
     * Record usage for a user
     */
    recordUsage(userId: string, cost: number): void;
    /**
     * Get optimal cost tier based on task and budget
     */
    getOptimalCostTier(userId: string, task: TaskAnalysis, remainingBudget?: number): CostTier;
    /**
     * Reset daily usage (should be called by a scheduler)
     */
    resetDailyUsage(): void;
    /**
     * Reset monthly usage (should be called by a scheduler)
     */
    resetMonthlyUsage(): void;
    /**
     * Get usage statistics for a user
     */
    getUsageStats(userId: string): {
        today: number;
        thisMonth: number;
        limits?: {
            daily: number;
            monthly: number;
        };
    };
}
export declare class FallbackChain {
    private maxAttempts;
    private retryDelayMs;
    private errorHandlers;
    constructor(maxAttempts?: number, retryDelayMs?: number);
    private initializeErrorHandlers;
    /**
     * Execute with fallback chain
     */
    execute<T>(primaryFn: () => Promise<T>, fallbackFns: Array<() => Promise<T>>, onFallback?: (attemptNumber: number, error: Error, nextModel?: string) => void): Promise<{
        result: T;
        attempts: number;
        fallbacksUsed: number;
    }>;
    private delay;
    /**
     * Get configuration
     */
    getConfig(): {
        maxAttempts: number;
        retryDelayMs: number;
    };
    /**
     * Update configuration
     */
    setConfig(maxAttempts?: number, retryDelayMs?: number): void;
}
export declare class PerformanceTracker {
    private metrics;
    private recentRequests;
    private readonly MAX_RECENT_REQUESTS;
    /**
     * Record a completed request
     */
    recordRequest(modelName: string, taskType: TaskType, latencyMs: number, tokensUsed: number, success: boolean, userRating?: number): void;
    private updateMetrics;
    /**
     * Get metrics for a specific model
     */
    getModelMetrics(modelName: string): ModelPerformanceMetrics[];
    /**
     * Get metrics for a specific model and task type
     */
    getTaskMetrics(modelName: string, taskType: TaskType): ModelPerformanceMetrics | undefined;
    /**
     * Get all metrics
     */
    getAllMetrics(): Map<string, ModelPerformanceMetrics[]>;
    /**
     * Get best performing model for a task type
     */
    getBestModelForTask(taskType: TaskType, minRequests?: number): string | undefined;
    /**
     * Get recent performance trend for a model
     */
    getRecentTrend(modelName: string, windowHours?: number): {
        successRate: number;
        avgLatency: number;
        requestCount: number;
    };
    /**
     * Export metrics for persistence
     */
    exportMetrics(): string;
    /**
     * Import metrics from persistence
     */
    importMetrics(data: string): void;
}
export declare class UserPreferenceLearner {
    private preferences;
    private readonly FEEDBACK_WEIGHT_DECAY;
    /**
     * Initialize preferences for a user
     */
    initializeUser(userId: string): UserPreferences;
    /**
     * Get user preferences
     */
    getPreferences(userId: string): UserPreferences;
    /**
     * Record user feedback
     */
    recordFeedback(userId: string, feedback: FeedbackEntry): void;
    private updatePreferencesFromFeedback;
    /**
     * Set explicit user preferences
     */
    setPreferences(userId: string, updates: Partial<Omit<UserPreferences, 'userId' | 'feedbackHistory'>>): void;
    /**
     * Get model recommendation based on learned preferences
     */
    getRecommendedModel(userId: string, taskType: TaskType): string | undefined;
    /**
     * Get feedback statistics for a user
     */
    getFeedbackStats(userId: string): {
        totalFeedback: number;
        averageRating: number;
        modelPreferences: Record<string, number>;
    };
    /**
     * Export preferences for persistence
     */
    exportPreferences(userId: string): string;
    /**
     * Import preferences from persistence
     */
    importPreferences(userId: string, data: string): void;
}
export declare class ModelBenchmarker {
    private activeTests;
    private testResults;
    /**
     * Create a new A/B test
     */
    createTest(config: Omit<ABTestConfig, 'testId'>): string;
    /**
     * Get the model to use for an A/B test
     */
    getTestModel(testId: string): 'A' | 'B' | null;
    /**
     * Get the actual model name for a test assignment
     */
    getModelName(testId: string, assignment: 'A' | 'B'): string | null;
    /**
     * Record a test result
     */
    recordTestResult(testId: string, variant: 'A' | 'B', latencyMs: number, success: boolean, rating?: number): void;
    /**
     * Get test results
     */
    getTestResults(testId: string): ABTestResult | null;
    private calculateSignificance;
    /**
     * Get all active tests for a task type
     */
    getActiveTestsForTask(taskType: TaskType): ABTestConfig[];
    /**
     * End a test
     */
    endTest(testId: string): ABTestResult | null;
    /**
     * List all tests
     */
    listTests(): ABTestConfig[];
}
export declare class IntelligentModelRouter {
    private baseRouter;
    private taskClassifier;
    private modelSelector;
    private costOptimizer;
    private fallbackChain;
    private performanceTracker;
    private preferenceLearner;
    private benchmarker;
    private database?;
    private requestCounter;
    constructor(baseRouter?: ModelRouter);
    /**
     * Connect to database for persistence
     */
    connectDatabase(): Promise<void>;
    private initializeDatabaseTables;
    /**
     * Main entry point - Generate response with intelligent routing
     */
    generateResponse(query: string, context: string, userId?: string, role?: BrainRole): Promise<ExecutionResult>;
    private executeModel;
    private findCheapestModel;
    private calculateActualCost;
    private persistMetrics;
    /**
     * Submit user feedback for a request
     */
    submitFeedback(userId: string, requestId: string, modelName: string, taskType: TaskType, rating: number, wasHelpful: boolean, latencyAcceptable: boolean, comment?: string): void;
    /**
     * Start an A/B test
     */
    startABTest(testName: string, taskType: TaskType, modelA: string, modelB: string, trafficSplit?: number, durationDays?: number): string;
    /**
     * Get A/B test results
     */
    getABTestResults(testId: string): ABTestResult | null;
    /**
     * End an A/B test
     */
    endABTest(testId: string): ABTestResult | null;
    /**
     * List all A/B tests
     */
    listABTests(): ABTestConfig[];
    /**
     * Set budget limits for a user
     */
    setBudgetLimits(userId: string, dailyLimit: number, monthlyLimit: number): void;
    /**
     * Get usage statistics for a user
     */
    getUsageStats(userId: string): {
        today: number;
        thisMonth: number;
        limits?: {
            daily: number;
            monthly: number;
        };
    };
    /**
     * Set user preferences
     */
    setUserPreferences(userId: string, preferences: {
        costSensitivity?: number;
        qualityPreference?: number;
        localModelPreference?: boolean;
        preferredModels?: Map<TaskType, string>;
    }): void;
    /**
     * Get user preferences
     */
    getUserPreferences(userId: string): UserPreferences;
    /**
     * Get model performance metrics
     */
    getModelPerformance(modelName: string): ModelPerformanceMetrics[];
    /**
     * Get best model for a specific task type
     */
    getBestModelForTask(taskType: TaskType): string | undefined;
    /**
     * Get recent performance trend
     */
    getRecentTrend(modelName: string, windowHours?: number): {
        successRate: number;
        avgLatency: number;
        requestCount: number;
    };
    /**
     * Register model capabilities
     */
    registerModelCapabilities(capabilities: ModelCapabilities): void;
    /**
     * Get model capabilities
     */
    getModelCapabilities(modelName: string): ModelCapabilities | undefined;
    /**
     * Get the underlying model registry
     */
    getRegistry(): ModelRegistry;
    /**
     * Get the base router for direct access
     */
    getBaseRouter(): ModelRouter;
    /**
     * Configure fallback behavior
     */
    configureFallback(maxAttempts?: number, retryDelayMs?: number): void;
    /**
     * Get fallback configuration
     */
    getFallbackConfig(): {
        maxAttempts: number;
        retryDelayMs: number;
    };
    /**
     * Analyze a query to get task details
     */
    analyzeTask(query: string): TaskAnalysis;
    /**
     * Export all state for backup
     */
    exportState(): {
        metrics: string;
        preferences: Map<string, string>;
    };
    /**
     * Import state from backup
     */
    importState(state: {
        metrics: string;
        preferences: Map<string, string>;
    }): void;
}
export declare function createIntelligentRouter(baseRouter?: ModelRouter): IntelligentModelRouter;
export default IntelligentModelRouter;
//# sourceMappingURL=IntelligentModelRouter.d.ts.map