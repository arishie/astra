// @ts-nocheck
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

import { generateText } from 'ai';
import { ModelRegistry, type ModelConfig } from './ModelRegistry.js';
import { UniversalAdapter } from './UniversalAdapter.js';
import { ModelRouter, BrainRole } from './ModelRouter.js';
import { Database } from '../database/Database.js';

// ============================================================================
// Type Definitions
// ============================================================================

export enum TaskType {
    CODING = 'coding',
    CREATIVE = 'creative',
    ANALYSIS = 'analysis',
    CONVERSATION = 'conversation',
    SUMMARIZATION = 'summarization',
    TRANSLATION = 'translation',
    REASONING = 'reasoning',
    FACTUAL = 'factual',
    INSTRUCTION = 'instruction',
    MULTIMODAL = 'multimodal'
}

export enum TaskComplexity {
    TRIVIAL = 1,
    SIMPLE = 2,
    MODERATE = 3,
    COMPLEX = 4,
    EXPERT = 5
}

export enum CostTier {
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
    contextSensitivity: number; // 0-1 scale
}

export interface ModelCapabilities {
    modelName: string;
    supportedTasks: TaskType[];
    maxContextLength: number;
    costPerMillionTokens: number;
    averageLatencyMs: number;
    qualityScore: number; // 0-100
    reasoningStrength: number; // 0-100
    creativityScore: number; // 0-100
    codeQuality: number; // 0-100
    factualAccuracy: number; // 0-100
    isLocal: boolean;
}

export interface ModelPerformanceMetrics {
    modelName: string;
    taskType: TaskType;
    totalRequests: number;
    successfulRequests: number;
    averageLatencyMs: number;
    averageTokensUsed: number;
    userSatisfactionScore: number; // 0-5 rating
    errorRate: number;
    lastUpdated: Date;
}

export interface UserPreferences {
    userId: string;
    preferredModels: Map<TaskType, string>;
    costSensitivity: number; // 0-1, higher = more cost sensitive
    qualityPreference: number; // 0-1, higher = prefer quality over speed
    localModelPreference: boolean;
    feedbackHistory: FeedbackEntry[];
}

export interface FeedbackEntry {
    requestId: string;
    modelName: string;
    taskType: TaskType;
    rating: number; // 1-5
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
    confidence: number; // 0-1
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
    trafficSplit: number; // 0-1, percentage going to model A
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
}

export interface ABTestResult {
    testId: string;
    modelA: { requests: number; avgRating: number; avgLatency: number; successRate: number };
    modelB: { requests: number; avgRating: number; avgLatency: number; successRate: number };
    statisticalSignificance: number;
    recommendedModel: string;
}

// ============================================================================
// TaskClassifier - Enhanced task classification
// ============================================================================

export class EnhancedTaskClassifier {
    private static readonly CODING_KEYWORDS = [
        'code', 'function', 'class', 'implement', 'debug', 'fix', 'refactor',
        'api', 'endpoint', 'database', 'sql', 'algorithm', 'data structure',
        'typescript', 'javascript', 'python', 'java', 'rust', 'go', 'c++',
        'compile', 'runtime', 'error', 'exception', 'test', 'unit test'
    ];

    private static readonly CREATIVE_KEYWORDS = [
        'write', 'story', 'poem', 'creative', 'imagine', 'fiction', 'narrative',
        'dialogue', 'character', 'plot', 'scene', 'describe', 'artistic',
        'compose', 'lyrics', 'novel', 'essay', 'blog post', 'article'
    ];

    private static readonly ANALYSIS_KEYWORDS = [
        'analyze', 'analysis', 'compare', 'evaluate', 'assess', 'review',
        'investigate', 'examine', 'study', 'research', 'statistics', 'data',
        'trend', 'pattern', 'insight', 'correlation', 'cause', 'effect'
    ];

    private static readonly REASONING_KEYWORDS = [
        'why', 'how', 'explain', 'reason', 'logic', 'deduce', 'infer',
        'conclude', 'argument', 'premise', 'therefore', 'because', 'proof',
        'mathematical', 'theorem', 'solve', 'calculate', 'derive'
    ];

    private static readonly FACTUAL_KEYWORDS = [
        'what is', 'who is', 'when did', 'where is', 'define', 'fact',
        'history', 'date', 'number', 'statistic', 'wikipedia', 'encyclopedia'
    ];

    private static readonly INSTRUCTION_KEYWORDS = [
        'how to', 'step by step', 'tutorial', 'guide', 'instructions',
        'process', 'procedure', 'method', 'technique', 'recipe'
    ];

    /**
     * Classifies a query into a task type with detailed analysis
     */
    public static classify(query: string): TaskAnalysis {
        const lowerQuery = query.toLowerCase();
        const wordCount = query.split(/\s+/).length;

        // Determine task type
        const type = this.determineTaskType(lowerQuery);

        // Determine complexity
        const complexity = this.determineComplexity(query, type);

        // Estimate tokens (rough approximation: 1 token ~= 4 characters)
        const estimatedTokens = Math.ceil(query.length / 4) + this.estimateResponseTokens(type, complexity);

        return {
            type,
            complexity,
            estimatedTokens,
            requiresReasoning: this.requiresReasoning(lowerQuery, type),
            requiresCreativity: type === TaskType.CREATIVE || lowerQuery.includes('creative'),
            requiresAccuracy: type === TaskType.FACTUAL || type === TaskType.ANALYSIS || type === TaskType.CODING,
            urgency: this.determineUrgency(lowerQuery),
            contextSensitivity: this.calculateContextSensitivity(lowerQuery, type)
        };
    }

    private static determineTaskType(query: string): TaskType {
        const scores: Map<TaskType, number> = new Map();

        // Calculate keyword match scores
        scores.set(TaskType.CODING, this.calculateKeywordScore(query, this.CODING_KEYWORDS));
        scores.set(TaskType.CREATIVE, this.calculateKeywordScore(query, this.CREATIVE_KEYWORDS));
        scores.set(TaskType.ANALYSIS, this.calculateKeywordScore(query, this.ANALYSIS_KEYWORDS));
        scores.set(TaskType.REASONING, this.calculateKeywordScore(query, this.REASONING_KEYWORDS));
        scores.set(TaskType.FACTUAL, this.calculateKeywordScore(query, this.FACTUAL_KEYWORDS));
        scores.set(TaskType.INSTRUCTION, this.calculateKeywordScore(query, this.INSTRUCTION_KEYWORDS));

        // Check for translation
        if (query.includes('translate') || query.includes('in spanish') || query.includes('in french')) {
            scores.set(TaskType.TRANSLATION, 10);
        }

        // Check for summarization
        if (query.includes('summarize') || query.includes('summary') || query.includes('tldr')) {
            scores.set(TaskType.SUMMARIZATION, 10);
        }

        // Find highest scoring type
        let maxScore = 0;
        let selectedType = TaskType.CONVERSATION;

        for (const [type, score] of scores) {
            if (score > maxScore) {
                maxScore = score;
                selectedType = type;
            }
        }

        // Default to conversation if no strong match
        return maxScore >= 2 ? selectedType : TaskType.CONVERSATION;
    }

    private static calculateKeywordScore(query: string, keywords: string[]): number {
        let score = 0;
        for (const keyword of keywords) {
            if (query.includes(keyword)) {
                score += keyword.split(' ').length; // Multi-word keywords get higher scores
            }
        }
        return score;
    }

    private static determineComplexity(query: string, type: TaskType): TaskComplexity {
        const wordCount = query.split(/\s+/).length;
        const hasMultipleParts = query.includes(' and ') || query.includes(' then ') || query.includes('also');
        const hasConstraints = query.includes('must') || query.includes('should') || query.includes('require');

        let complexityScore = 1;

        // Word count contribution
        if (wordCount > 100) complexityScore += 2;
        else if (wordCount > 50) complexityScore += 1;

        // Multiple parts contribution
        if (hasMultipleParts) complexityScore += 1;

        // Constraints contribution
        if (hasConstraints) complexityScore += 1;

        // Task type base complexity
        if (type === TaskType.CODING || type === TaskType.ANALYSIS) {
            complexityScore += 1;
        }
        if (type === TaskType.REASONING) {
            complexityScore += 2;
        }

        // Clamp to valid range
        return Math.min(Math.max(complexityScore, 1), 5) as TaskComplexity;
    }

    private static estimateResponseTokens(type: TaskType, complexity: TaskComplexity): number {
        const baseTokens: Record<TaskType, number> = {
            [TaskType.CODING]: 500,
            [TaskType.CREATIVE]: 800,
            [TaskType.ANALYSIS]: 600,
            [TaskType.CONVERSATION]: 200,
            [TaskType.SUMMARIZATION]: 300,
            [TaskType.TRANSLATION]: 200,
            [TaskType.REASONING]: 500,
            [TaskType.FACTUAL]: 150,
            [TaskType.INSTRUCTION]: 400,
            [TaskType.MULTIMODAL]: 300
        };

        return baseTokens[type] * complexity;
    }

    private static requiresReasoning(query: string, type: TaskType): boolean {
        if (type === TaskType.REASONING || type === TaskType.ANALYSIS) return true;
        return query.includes('why') || query.includes('explain') || query.includes('reason');
    }

    private static determineUrgency(query: string): 'low' | 'medium' | 'high' {
        if (query.includes('urgent') || query.includes('asap') || query.includes('immediately')) {
            return 'high';
        }
        if (query.includes('quick') || query.includes('fast') || query.includes('soon')) {
            return 'medium';
        }
        return 'low';
    }

    private static calculateContextSensitivity(query: string, type: TaskType): number {
        let sensitivity = 0.5;

        if (query.includes('based on') || query.includes('given') || query.includes('context')) {
            sensitivity += 0.3;
        }

        if (type === TaskType.ANALYSIS || type === TaskType.SUMMARIZATION) {
            sensitivity += 0.2;
        }

        return Math.min(sensitivity, 1.0);
    }
}

// ============================================================================
// ModelSelector - Intelligent model selection
// ============================================================================

export class ModelSelector {
    private modelCapabilities: Map<string, ModelCapabilities> = new Map();
    private registry: ModelRegistry;

    constructor(registry: ModelRegistry) {
        this.registry = registry;
        this.initializeDefaultCapabilities();
    }

    private initializeDefaultCapabilities(): void {
        // Default capabilities for common models
        const defaultCapabilities: ModelCapabilities[] = [
            {
                modelName: 'gpt-4-turbo',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 128000,
                costPerMillionTokens: 10.0,
                averageLatencyMs: 2000,
                qualityScore: 95,
                reasoningStrength: 95,
                creativityScore: 90,
                codeQuality: 92,
                factualAccuracy: 90,
                isLocal: false
            },
            {
                modelName: 'gpt-4o',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 128000,
                costPerMillionTokens: 5.0,
                averageLatencyMs: 1500,
                qualityScore: 93,
                reasoningStrength: 92,
                creativityScore: 88,
                codeQuality: 90,
                factualAccuracy: 88,
                isLocal: false
            },
            {
                modelName: 'gpt-3.5-turbo',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 16385,
                costPerMillionTokens: 0.5,
                averageLatencyMs: 800,
                qualityScore: 75,
                reasoningStrength: 70,
                creativityScore: 72,
                codeQuality: 70,
                factualAccuracy: 68,
                isLocal: false
            },
            {
                modelName: 'claude-3-opus',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 200000,
                costPerMillionTokens: 15.0,
                averageLatencyMs: 3000,
                qualityScore: 98,
                reasoningStrength: 98,
                creativityScore: 95,
                codeQuality: 94,
                factualAccuracy: 95,
                isLocal: false
            },
            {
                modelName: 'claude-3-sonnet',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 200000,
                costPerMillionTokens: 3.0,
                averageLatencyMs: 1500,
                qualityScore: 88,
                reasoningStrength: 85,
                creativityScore: 85,
                codeQuality: 85,
                factualAccuracy: 85,
                isLocal: false
            },
            {
                modelName: 'claude-3-haiku',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 200000,
                costPerMillionTokens: 0.25,
                averageLatencyMs: 500,
                qualityScore: 72,
                reasoningStrength: 68,
                creativityScore: 70,
                codeQuality: 68,
                factualAccuracy: 70,
                isLocal: false
            },
            {
                modelName: 'gemini-1.5-pro',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 1000000,
                costPerMillionTokens: 3.5,
                averageLatencyMs: 2000,
                qualityScore: 90,
                reasoningStrength: 88,
                creativityScore: 85,
                codeQuality: 85,
                factualAccuracy: 87,
                isLocal: false
            },
            {
                modelName: 'gemini-1.5-flash',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 1000000,
                costPerMillionTokens: 0.35,
                averageLatencyMs: 600,
                qualityScore: 78,
                reasoningStrength: 75,
                creativityScore: 75,
                codeQuality: 75,
                factualAccuracy: 76,
                isLocal: false
            },
            {
                modelName: 'llama-3-70b',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 8192,
                costPerMillionTokens: 0.0,
                averageLatencyMs: 1200,
                qualityScore: 82,
                reasoningStrength: 80,
                creativityScore: 78,
                codeQuality: 80,
                factualAccuracy: 75,
                isLocal: true
            },
            {
                modelName: 'mixtral-8x7b',
                supportedTasks: Object.values(TaskType),
                maxContextLength: 32768,
                costPerMillionTokens: 0.0,
                averageLatencyMs: 800,
                qualityScore: 78,
                reasoningStrength: 75,
                creativityScore: 75,
                codeQuality: 75,
                factualAccuracy: 72,
                isLocal: true
            }
        ];

        for (const cap of defaultCapabilities) {
            this.modelCapabilities.set(cap.modelName, cap);
        }
    }

    /**
     * Register or update model capabilities
     */
    public registerCapabilities(capabilities: ModelCapabilities): void {
        this.modelCapabilities.set(capabilities.modelName, capabilities);
    }

    /**
     * Get capabilities for a model
     */
    public getCapabilities(modelName: string): ModelCapabilities | undefined {
        return this.modelCapabilities.get(modelName);
    }

    /**
     * Select optimal model based on task analysis and user preferences
     */
    public selectModel(
        task: TaskAnalysis,
        userPreferences: UserPreferences,
        availableModels: string[],
        performanceMetrics: Map<string, ModelPerformanceMetrics[]>
    ): RoutingDecision {
        const candidates: Array<{
            model: string;
            score: number;
            cost: number;
            latency: number;
        }> = [];

        for (const modelName of availableModels) {
            const capabilities = this.modelCapabilities.get(modelName);
            if (!capabilities) continue;

            // Check if model supports the task type
            if (!capabilities.supportedTasks.includes(task.type)) continue;

            // Check context length requirement
            if (capabilities.maxContextLength < task.estimatedTokens) continue;

            // Calculate composite score
            const score = this.calculateModelScore(
                capabilities,
                task,
                userPreferences,
                performanceMetrics.get(modelName) || []
            );

            candidates.push({
                model: modelName,
                score,
                cost: this.estimateCost(capabilities, task.estimatedTokens),
                latency: capabilities.averageLatencyMs
            });
        }

        // Sort by score (descending)
        candidates.sort((a, b) => b.score - a.score);

        if (candidates.length === 0) {
            // Fallback to any available model
            const fallbackModel = availableModels[0] || 'gemini-1.5-flash';
            return {
                selectedModel: fallbackModel,
                fallbackChain: availableModels.slice(1, 4),
                reasoning: 'No optimal model found, using fallback',
                estimatedCost: 0,
                estimatedLatency: 1000,
                confidence: 0.3
            };
        }

        const selected = candidates[0];
        const fallbacks = candidates.slice(1, 4).map(c => c.model);

        return {
            selectedModel: selected.model,
            fallbackChain: fallbacks,
            reasoning: this.generateReasoning(selected.model, task, userPreferences),
            estimatedCost: selected.cost,
            estimatedLatency: selected.latency,
            confidence: Math.min(selected.score / 100, 1.0)
        };
    }

    private calculateModelScore(
        capabilities: ModelCapabilities,
        task: TaskAnalysis,
        preferences: UserPreferences,
        metrics: ModelPerformanceMetrics[]
    ): number {
        let score = 0;

        // Base quality score (0-40 points)
        score += capabilities.qualityScore * 0.4;

        // Task-specific scoring (0-30 points)
        switch (task.type) {
            case TaskType.CODING:
                score += capabilities.codeQuality * 0.3;
                break;
            case TaskType.CREATIVE:
                score += capabilities.creativityScore * 0.3;
                break;
            case TaskType.REASONING:
            case TaskType.ANALYSIS:
                score += capabilities.reasoningStrength * 0.3;
                break;
            case TaskType.FACTUAL:
                score += capabilities.factualAccuracy * 0.3;
                break;
            default:
                score += capabilities.qualityScore * 0.15;
        }

        // Cost sensitivity adjustment (-20 to +10 points)
        const costFactor = capabilities.costPerMillionTokens;
        if (preferences.costSensitivity > 0.7) {
            score -= costFactor * 2;
        } else if (preferences.costSensitivity < 0.3) {
            score += Math.max(0, 10 - costFactor);
        }

        // Local model preference (+15 points if preferred and local)
        if (preferences.localModelPreference && capabilities.isLocal) {
            score += 15;
        }

        // Historical performance adjustment (-10 to +10 points)
        const relevantMetrics = metrics.filter(m => m.taskType === task.type);
        if (relevantMetrics.length > 0) {
            const avgSatisfaction = relevantMetrics.reduce((sum, m) => sum + m.userSatisfactionScore, 0) / relevantMetrics.length;
            score += (avgSatisfaction - 3) * 5; // Center around 3 (neutral)
        }

        // User preference bonus (+20 points if preferred for this task)
        if (preferences.preferredModels.get(task.type) === capabilities.modelName) {
            score += 20;
        }

        // Latency consideration for urgent tasks (-10 points for slow models)
        if (task.urgency === 'high' && capabilities.averageLatencyMs > 2000) {
            score -= 10;
        }

        // Complexity-quality matching
        if (task.complexity >= TaskComplexity.COMPLEX && capabilities.qualityScore < 80) {
            score -= 15;
        }

        return Math.max(0, score);
    }

    private estimateCost(capabilities: ModelCapabilities, tokens: number): number {
        return (tokens / 1_000_000) * capabilities.costPerMillionTokens;
    }

    private generateReasoning(modelName: string, task: TaskAnalysis, preferences: UserPreferences): string {
        const parts: string[] = [];

        parts.push(`Selected ${modelName} for ${task.type} task`);

        if (task.complexity >= TaskComplexity.COMPLEX) {
            parts.push('(high complexity requires capable model)');
        }

        if (task.urgency === 'high') {
            parts.push('with consideration for fast response');
        }

        if (preferences.costSensitivity > 0.7) {
            parts.push('optimized for cost efficiency');
        }

        return parts.join(' ');
    }
}

// ============================================================================
// CostOptimizer - Balance quality vs cost
// ============================================================================

export class CostOptimizer {
    private budgetLimits: Map<string, { daily: number; monthly: number }> = new Map();
    private usageTracking: Map<string, { today: number; thisMonth: number }> = new Map();

    /**
     * Set budget limits for a user
     */
    public setBudgetLimits(userId: string, daily: number, monthly: number): void {
        this.budgetLimits.set(userId, { daily, monthly });
    }

    /**
     * Check if a request is within budget
     */
    public isWithinBudget(userId: string, estimatedCost: number): boolean {
        const limits = this.budgetLimits.get(userId);
        if (!limits) return true; // No limits set

        const usage = this.usageTracking.get(userId) || { today: 0, thisMonth: 0 };

        return (
            usage.today + estimatedCost <= limits.daily &&
            usage.thisMonth + estimatedCost <= limits.monthly
        );
    }

    /**
     * Record usage for a user
     */
    public recordUsage(userId: string, cost: number): void {
        const current = this.usageTracking.get(userId) || { today: 0, thisMonth: 0 };
        current.today += cost;
        current.thisMonth += cost;
        this.usageTracking.set(userId, current);
    }

    /**
     * Get optimal cost tier based on task and budget
     */
    public getOptimalCostTier(
        userId: string,
        task: TaskAnalysis,
        remainingBudget?: number
    ): CostTier {
        const limits = this.budgetLimits.get(userId);
        const usage = this.usageTracking.get(userId);

        // Calculate remaining budget
        let available = Infinity;
        if (limits && usage) {
            const dailyRemaining = limits.daily - usage.today;
            const monthlyRemaining = limits.monthly - usage.thisMonth;
            available = Math.min(dailyRemaining, monthlyRemaining);
        }

        if (remainingBudget !== undefined) {
            available = Math.min(available, remainingBudget);
        }

        // Determine tier based on task importance and budget
        if (available <= 0) return CostTier.FREE;

        if (task.complexity >= TaskComplexity.EXPERT) {
            if (available >= 0.1) return CostTier.ENTERPRISE;
            if (available >= 0.05) return CostTier.PREMIUM;
        }

        if (task.complexity >= TaskComplexity.COMPLEX) {
            if (available >= 0.05) return CostTier.PREMIUM;
            if (available >= 0.01) return CostTier.STANDARD;
        }

        if (task.complexity >= TaskComplexity.MODERATE) {
            if (available >= 0.01) return CostTier.STANDARD;
            return CostTier.BUDGET;
        }

        return CostTier.BUDGET;
    }

    /**
     * Reset daily usage (should be called by a scheduler)
     */
    public resetDailyUsage(): void {
        for (const [userId, usage] of this.usageTracking) {
            usage.today = 0;
        }
    }

    /**
     * Reset monthly usage (should be called by a scheduler)
     */
    public resetMonthlyUsage(): void {
        for (const [userId, usage] of this.usageTracking) {
            usage.thisMonth = 0;
        }
    }

    /**
     * Get usage statistics for a user
     */
    public getUsageStats(userId: string): { today: number; thisMonth: number; limits?: { daily: number; monthly: number } } {
        const usage = this.usageTracking.get(userId) || { today: 0, thisMonth: 0 };
        const limits = this.budgetLimits.get(userId);
        return { ...usage, limits };
    }
}

// ============================================================================
// FallbackChain - Graceful degradation
// ============================================================================

export class FallbackChain {
    private maxAttempts: number;
    private retryDelayMs: number;
    private errorHandlers: Map<string, (error: Error) => boolean> = new Map();

    constructor(maxAttempts: number = 3, retryDelayMs: number = 1000) {
        this.maxAttempts = maxAttempts;
        this.retryDelayMs = retryDelayMs;
        this.initializeErrorHandlers();
    }

    private initializeErrorHandlers(): void {
        // Rate limit errors - should retry after delay
        this.errorHandlers.set('rate_limit', (error: Error) => {
            return error.message.toLowerCase().includes('rate limit') ||
                   error.message.toLowerCase().includes('too many requests');
        });

        // Auth errors - should not retry, fail immediately
        this.errorHandlers.set('auth', (error: Error) => {
            return error.message.toLowerCase().includes('unauthorized') ||
                   error.message.toLowerCase().includes('invalid api key') ||
                   error.message.toLowerCase().includes('authentication');
        });

        // Network errors - should retry
        this.errorHandlers.set('network', (error: Error) => {
            return error.message.toLowerCase().includes('network') ||
                   error.message.toLowerCase().includes('timeout') ||
                   error.message.toLowerCase().includes('connection');
        });

        // Model overloaded - should fallback to different model
        this.errorHandlers.set('overloaded', (error: Error) => {
            return error.message.toLowerCase().includes('overloaded') ||
                   error.message.toLowerCase().includes('capacity');
        });
    }

    /**
     * Execute with fallback chain
     */
    public async execute<T>(
        primaryFn: () => Promise<T>,
        fallbackFns: Array<() => Promise<T>>,
        onFallback?: (attemptNumber: number, error: Error, nextModel?: string) => void
    ): Promise<{ result: T; attempts: number; fallbacksUsed: number }> {
        let attempts = 0;
        let fallbacksUsed = 0;
        const allFunctions = [primaryFn, ...fallbackFns];

        for (let i = 0; i < allFunctions.length; i++) {
            const fn = allFunctions[i];
            let retryCount = 0;

            while (retryCount < this.maxAttempts) {
                attempts++;
                try {
                    const result = await fn();
                    return { result, attempts, fallbacksUsed };
                } catch (error) {
                    const err = error as Error;

                    // Check if this is an auth error - don't retry
                    if (this.errorHandlers.get('auth')!(err)) {
                        console.warn(`[FallbackChain] Auth error on attempt ${attempts}, moving to fallback`);
                        break; // Move to next fallback
                    }

                    // Check if rate limited - wait and retry
                    if (this.errorHandlers.get('rate_limit')!(err)) {
                        retryCount++;
                        if (retryCount < this.maxAttempts) {
                            console.warn(`[FallbackChain] Rate limited, waiting ${this.retryDelayMs}ms...`);
                            await this.delay(this.retryDelayMs * retryCount);
                            continue;
                        }
                    }

                    // Check if network error - retry with backoff
                    if (this.errorHandlers.get('network')!(err)) {
                        retryCount++;
                        if (retryCount < this.maxAttempts) {
                            console.warn(`[FallbackChain] Network error, retrying...`);
                            await this.delay(this.retryDelayMs * retryCount);
                            continue;
                        }
                    }

                    // Check if overloaded - move to fallback immediately
                    if (this.errorHandlers.get('overloaded')!(err)) {
                        console.warn(`[FallbackChain] Model overloaded, moving to fallback`);
                        break;
                    }

                    // Unknown error - retry once then fallback
                    retryCount++;
                    if (retryCount >= this.maxAttempts) {
                        break;
                    }
                    await this.delay(this.retryDelayMs);
                }
            }

            // Moving to fallback
            if (i < allFunctions.length - 1) {
                fallbacksUsed++;
                if (onFallback) {
                    onFallback(attempts, new Error('Moving to fallback'), `fallback_${i + 1}`);
                }
            }
        }

        throw new Error(`All ${allFunctions.length} models failed after ${attempts} total attempts`);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get configuration
     */
    public getConfig(): { maxAttempts: number; retryDelayMs: number } {
        return { maxAttempts: this.maxAttempts, retryDelayMs: this.retryDelayMs };
    }

    /**
     * Update configuration
     */
    public setConfig(maxAttempts?: number, retryDelayMs?: number): void {
        if (maxAttempts !== undefined) this.maxAttempts = maxAttempts;
        if (retryDelayMs !== undefined) this.retryDelayMs = retryDelayMs;
    }
}

// ============================================================================
// PerformanceTracker - Model success rates
// ============================================================================

export class PerformanceTracker {
    private metrics: Map<string, Map<TaskType, ModelPerformanceMetrics>> = new Map();
    private recentRequests: Array<{
        modelName: string;
        taskType: TaskType;
        latencyMs: number;
        tokensUsed: number;
        success: boolean;
        timestamp: Date;
    }> = [];
    private readonly MAX_RECENT_REQUESTS = 10000;

    /**
     * Record a completed request
     */
    public recordRequest(
        modelName: string,
        taskType: TaskType,
        latencyMs: number,
        tokensUsed: number,
        success: boolean,
        userRating?: number
    ): void {
        // Add to recent requests
        this.recentRequests.push({
            modelName,
            taskType,
            latencyMs,
            tokensUsed,
            success,
            timestamp: new Date()
        });

        // Trim if too many
        if (this.recentRequests.length > this.MAX_RECENT_REQUESTS) {
            this.recentRequests = this.recentRequests.slice(-this.MAX_RECENT_REQUESTS / 2);
        }

        // Update aggregated metrics
        this.updateMetrics(modelName, taskType, latencyMs, tokensUsed, success, userRating);
    }

    private updateMetrics(
        modelName: string,
        taskType: TaskType,
        latencyMs: number,
        tokensUsed: number,
        success: boolean,
        userRating?: number
    ): void {
        if (!this.metrics.has(modelName)) {
            this.metrics.set(modelName, new Map());
        }

        const modelMetrics = this.metrics.get(modelName)!;
        let taskMetrics = modelMetrics.get(taskType);

        if (!taskMetrics) {
            taskMetrics = {
                modelName,
                taskType,
                totalRequests: 0,
                successfulRequests: 0,
                averageLatencyMs: 0,
                averageTokensUsed: 0,
                userSatisfactionScore: 3.0, // Neutral default
                errorRate: 0,
                lastUpdated: new Date()
            };
            modelMetrics.set(taskType, taskMetrics);
        }

        // Update rolling averages
        const n = taskMetrics.totalRequests;
        taskMetrics.totalRequests++;
        taskMetrics.averageLatencyMs = (taskMetrics.averageLatencyMs * n + latencyMs) / (n + 1);
        taskMetrics.averageTokensUsed = (taskMetrics.averageTokensUsed * n + tokensUsed) / (n + 1);

        if (success) {
            taskMetrics.successfulRequests++;
        }
        taskMetrics.errorRate = 1 - (taskMetrics.successfulRequests / taskMetrics.totalRequests);

        if (userRating !== undefined) {
            // Weighted average for user satisfaction
            const ratingWeight = 0.1; // New ratings have 10% weight
            taskMetrics.userSatisfactionScore =
                taskMetrics.userSatisfactionScore * (1 - ratingWeight) +
                userRating * ratingWeight;
        }

        taskMetrics.lastUpdated = new Date();
    }

    /**
     * Get metrics for a specific model
     */
    public getModelMetrics(modelName: string): ModelPerformanceMetrics[] {
        const modelMetrics = this.metrics.get(modelName);
        if (!modelMetrics) return [];
        return Array.from(modelMetrics.values());
    }

    /**
     * Get metrics for a specific model and task type
     */
    public getTaskMetrics(modelName: string, taskType: TaskType): ModelPerformanceMetrics | undefined {
        return this.metrics.get(modelName)?.get(taskType);
    }

    /**
     * Get all metrics
     */
    public getAllMetrics(): Map<string, ModelPerformanceMetrics[]> {
        const result = new Map<string, ModelPerformanceMetrics[]>();
        for (const [model, taskMetrics] of this.metrics) {
            result.set(model, Array.from(taskMetrics.values()));
        }
        return result;
    }

    /**
     * Get best performing model for a task type
     */
    public getBestModelForTask(taskType: TaskType, minRequests: number = 10): string | undefined {
        let bestModel: string | undefined;
        let bestScore = -Infinity;

        for (const [modelName, taskMetrics] of this.metrics) {
            const metrics = taskMetrics.get(taskType);
            if (!metrics || metrics.totalRequests < minRequests) continue;

            // Composite score: success rate * user satisfaction * (1 / normalized latency)
            const score =
                (1 - metrics.errorRate) *
                (metrics.userSatisfactionScore / 5) *
                (1000 / Math.max(metrics.averageLatencyMs, 100));

            if (score > bestScore) {
                bestScore = score;
                bestModel = modelName;
            }
        }

        return bestModel;
    }

    /**
     * Get recent performance trend for a model
     */
    public getRecentTrend(modelName: string, windowHours: number = 24): {
        successRate: number;
        avgLatency: number;
        requestCount: number;
    } {
        const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
        const recent = this.recentRequests.filter(
            r => r.modelName === modelName && r.timestamp > cutoff
        );

        if (recent.length === 0) {
            return { successRate: 0, avgLatency: 0, requestCount: 0 };
        }

        const successCount = recent.filter(r => r.success).length;
        const totalLatency = recent.reduce((sum, r) => sum + r.latencyMs, 0);

        return {
            successRate: successCount / recent.length,
            avgLatency: totalLatency / recent.length,
            requestCount: recent.length
        };
    }

    /**
     * Export metrics for persistence
     */
    public exportMetrics(): string {
        const data: Record<string, ModelPerformanceMetrics[]> = {};
        for (const [model, taskMetrics] of this.metrics) {
            data[model] = Array.from(taskMetrics.values());
        }
        return JSON.stringify(data);
    }

    /**
     * Import metrics from persistence
     */
    public importMetrics(data: string): void {
        try {
            const parsed = JSON.parse(data) as Record<string, ModelPerformanceMetrics[]>;
            for (const [model, metricsArray] of Object.entries(parsed)) {
                const taskMap = new Map<TaskType, ModelPerformanceMetrics>();
                for (const metrics of metricsArray) {
                    metrics.lastUpdated = new Date(metrics.lastUpdated);
                    taskMap.set(metrics.taskType, metrics);
                }
                this.metrics.set(model, taskMap);
            }
        } catch (error) {
            console.error('[PerformanceTracker] Failed to import metrics:', error);
        }
    }
}

// ============================================================================
// UserPreferenceLearner - Adapt to user feedback
// ============================================================================

export class UserPreferenceLearner {
    private preferences: Map<string, UserPreferences> = new Map();
    private readonly FEEDBACK_WEIGHT_DECAY = 0.95; // Older feedback has less weight

    /**
     * Initialize preferences for a user
     */
    public initializeUser(userId: string): UserPreferences {
        const prefs: UserPreferences = {
            userId,
            preferredModels: new Map(),
            costSensitivity: 0.5,
            qualityPreference: 0.5,
            localModelPreference: false,
            feedbackHistory: []
        };
        this.preferences.set(userId, prefs);
        return prefs;
    }

    /**
     * Get user preferences
     */
    public getPreferences(userId: string): UserPreferences {
        return this.preferences.get(userId) || this.initializeUser(userId);
    }

    /**
     * Record user feedback
     */
    public recordFeedback(userId: string, feedback: FeedbackEntry): void {
        const prefs = this.getPreferences(userId);
        prefs.feedbackHistory.push(feedback);

        // Keep only last 1000 feedback entries
        if (prefs.feedbackHistory.length > 1000) {
            prefs.feedbackHistory = prefs.feedbackHistory.slice(-1000);
        }

        // Learn from feedback
        this.updatePreferencesFromFeedback(prefs, feedback);
    }

    private updatePreferencesFromFeedback(prefs: UserPreferences, feedback: FeedbackEntry): void {
        // Update preferred model for task type if rating is high
        if (feedback.rating >= 4) {
            const currentPreferred = prefs.preferredModels.get(feedback.taskType);
            const feedbacksForModel = prefs.feedbackHistory.filter(
                f => f.modelName === feedback.modelName && f.taskType === feedback.taskType
            );

            if (!currentPreferred || feedbacksForModel.length >= 3) {
                // Average rating for this model on this task
                const avgRating = feedbacksForModel.reduce((sum, f) => sum + f.rating, 0) / feedbacksForModel.length;
                if (avgRating >= 4) {
                    prefs.preferredModels.set(feedback.taskType, feedback.modelName);
                }
            }
        }

        // Update quality preference based on feedback patterns
        const recentFeedback = prefs.feedbackHistory.slice(-50);
        const highQualityRequests = recentFeedback.filter(f => f.rating >= 4 && !f.latencyAcceptable);
        const fastRequests = recentFeedback.filter(f => f.latencyAcceptable && f.rating < 4);

        if (highQualityRequests.length > fastRequests.length * 2) {
            prefs.qualityPreference = Math.min(prefs.qualityPreference + 0.05, 1.0);
        } else if (fastRequests.length > highQualityRequests.length * 2) {
            prefs.qualityPreference = Math.max(prefs.qualityPreference - 0.05, 0.0);
        }
    }

    /**
     * Set explicit user preferences
     */
    public setPreferences(
        userId: string,
        updates: Partial<Omit<UserPreferences, 'userId' | 'feedbackHistory'>>
    ): void {
        const prefs = this.getPreferences(userId);

        if (updates.costSensitivity !== undefined) {
            prefs.costSensitivity = updates.costSensitivity;
        }
        if (updates.qualityPreference !== undefined) {
            prefs.qualityPreference = updates.qualityPreference;
        }
        if (updates.localModelPreference !== undefined) {
            prefs.localModelPreference = updates.localModelPreference;
        }
        if (updates.preferredModels) {
            prefs.preferredModels = updates.preferredModels;
        }
    }

    /**
     * Get model recommendation based on learned preferences
     */
    public getRecommendedModel(userId: string, taskType: TaskType): string | undefined {
        const prefs = this.getPreferences(userId);

        // Check explicit preference first
        if (prefs.preferredModels.has(taskType)) {
            return prefs.preferredModels.get(taskType);
        }

        // Analyze feedback history
        const relevantFeedback = prefs.feedbackHistory
            .filter(f => f.taskType === taskType && f.rating >= 4)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (relevantFeedback.length > 0) {
            // Return most recent high-rated model
            return relevantFeedback[0].modelName;
        }

        return undefined;
    }

    /**
     * Get feedback statistics for a user
     */
    public getFeedbackStats(userId: string): {
        totalFeedback: number;
        averageRating: number;
        modelPreferences: Record<string, number>;
    } {
        const prefs = this.getPreferences(userId);
        const feedback = prefs.feedbackHistory;

        if (feedback.length === 0) {
            return { totalFeedback: 0, averageRating: 0, modelPreferences: {} };
        }

        const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;

        const modelCounts: Record<string, number> = {};
        for (const f of feedback.filter(f => f.rating >= 4)) {
            modelCounts[f.modelName] = (modelCounts[f.modelName] || 0) + 1;
        }

        return {
            totalFeedback: feedback.length,
            averageRating: avgRating,
            modelPreferences: modelCounts
        };
    }

    /**
     * Export preferences for persistence
     */
    public exportPreferences(userId: string): string {
        const prefs = this.getPreferences(userId);
        return JSON.stringify({
            ...prefs,
            preferredModels: Object.fromEntries(prefs.preferredModels)
        });
    }

    /**
     * Import preferences from persistence
     */
    public importPreferences(userId: string, data: string): void {
        try {
            const parsed = JSON.parse(data);
            const prefs: UserPreferences = {
                userId,
                preferredModels: new Map(Object.entries(parsed.preferredModels || {})),
                costSensitivity: parsed.costSensitivity ?? 0.5,
                qualityPreference: parsed.qualityPreference ?? 0.5,
                localModelPreference: parsed.localModelPreference ?? false,
                feedbackHistory: (parsed.feedbackHistory || []).map((f: any) => ({
                    ...f,
                    timestamp: new Date(f.timestamp)
                }))
            };
            this.preferences.set(userId, prefs);
        } catch (error) {
            console.error('[UserPreferenceLearner] Failed to import preferences:', error);
        }
    }
}

// ============================================================================
// ModelBenchmarker - A/B testing
// ============================================================================

export class ModelBenchmarker {
    private activeTests: Map<string, ABTestConfig> = new Map();
    private testResults: Map<string, {
        modelA: { requests: number; totalRating: number; totalLatency: number; successes: number };
        modelB: { requests: number; totalRating: number; totalLatency: number; successes: number };
    }> = new Map();

    /**
     * Create a new A/B test
     */
    public createTest(config: Omit<ABTestConfig, 'testId'>): string {
        const testId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const fullConfig: ABTestConfig = { ...config, testId };

        this.activeTests.set(testId, fullConfig);
        this.testResults.set(testId, {
            modelA: { requests: 0, totalRating: 0, totalLatency: 0, successes: 0 },
            modelB: { requests: 0, totalRating: 0, totalLatency: 0, successes: 0 }
        });

        console.log(`[ModelBenchmarker] Created A/B test: ${testId} (${config.modelA} vs ${config.modelB})`);
        return testId;
    }

    /**
     * Get the model to use for an A/B test
     */
    public getTestModel(testId: string): 'A' | 'B' | null {
        const config = this.activeTests.get(testId);
        if (!config || !config.isActive) return null;

        // Check if test has ended
        if (config.endDate && new Date() > config.endDate) {
            config.isActive = false;
            return null;
        }

        // Random assignment based on traffic split
        return Math.random() < config.trafficSplit ? 'A' : 'B';
    }

    /**
     * Get the actual model name for a test assignment
     */
    public getModelName(testId: string, assignment: 'A' | 'B'): string | null {
        const config = this.activeTests.get(testId);
        if (!config) return null;
        return assignment === 'A' ? config.modelA : config.modelB;
    }

    /**
     * Record a test result
     */
    public recordTestResult(
        testId: string,
        variant: 'A' | 'B',
        latencyMs: number,
        success: boolean,
        rating?: number
    ): void {
        const results = this.testResults.get(testId);
        if (!results) return;

        const variantResults = variant === 'A' ? results.modelA : results.modelB;
        variantResults.requests++;
        variantResults.totalLatency += latencyMs;
        if (success) variantResults.successes++;
        if (rating !== undefined) variantResults.totalRating += rating;
    }

    /**
     * Get test results
     */
    public getTestResults(testId: string): ABTestResult | null {
        const config = this.activeTests.get(testId);
        const results = this.testResults.get(testId);

        if (!config || !results) return null;

        const modelA = {
            requests: results.modelA.requests,
            avgRating: results.modelA.requests > 0
                ? results.modelA.totalRating / results.modelA.requests
                : 0,
            avgLatency: results.modelA.requests > 0
                ? results.modelA.totalLatency / results.modelA.requests
                : 0,
            successRate: results.modelA.requests > 0
                ? results.modelA.successes / results.modelA.requests
                : 0
        };

        const modelB = {
            requests: results.modelB.requests,
            avgRating: results.modelB.requests > 0
                ? results.modelB.totalRating / results.modelB.requests
                : 0,
            avgLatency: results.modelB.requests > 0
                ? results.modelB.totalLatency / results.modelB.requests
                : 0,
            successRate: results.modelB.requests > 0
                ? results.modelB.successes / results.modelB.requests
                : 0
        };

        // Simple statistical significance calculation (z-test for proportions)
        const significance = this.calculateSignificance(
            modelA.successRate, modelA.requests,
            modelB.successRate, modelB.requests
        );

        // Determine recommended model
        let recommendedModel = config.modelA;
        if (significance > 0.95) {
            recommendedModel = modelA.successRate > modelB.successRate ? config.modelA : config.modelB;
        }

        return {
            testId,
            modelA,
            modelB,
            statisticalSignificance: significance,
            recommendedModel
        };
    }

    private calculateSignificance(p1: number, n1: number, p2: number, n2: number): number {
        if (n1 < 30 || n2 < 30) return 0; // Not enough data

        const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
        const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));

        if (se === 0) return 0;

        const z = Math.abs(p1 - p2) / se;

        // Convert z-score to confidence level (simplified)
        if (z > 2.576) return 0.99;
        if (z > 1.96) return 0.95;
        if (z > 1.645) return 0.90;
        return z / 1.645 * 0.90;
    }

    /**
     * Get all active tests for a task type
     */
    public getActiveTestsForTask(taskType: TaskType): ABTestConfig[] {
        const tests: ABTestConfig[] = [];
        for (const config of this.activeTests.values()) {
            if (config.isActive && config.taskType === taskType) {
                tests.push(config);
            }
        }
        return tests;
    }

    /**
     * End a test
     */
    public endTest(testId: string): ABTestResult | null {
        const config = this.activeTests.get(testId);
        if (config) {
            config.isActive = false;
            config.endDate = new Date();
        }
        return this.getTestResults(testId);
    }

    /**
     * List all tests
     */
    public listTests(): ABTestConfig[] {
        return Array.from(this.activeTests.values());
    }
}

// ============================================================================
// IntelligentModelRouter - Main orchestrator
// ============================================================================

export class IntelligentModelRouter {
    private baseRouter: ModelRouter;
    private taskClassifier: typeof EnhancedTaskClassifier;
    private modelSelector: ModelSelector;
    private costOptimizer: CostOptimizer;
    private fallbackChain: FallbackChain;
    private performanceTracker: PerformanceTracker;
    private preferenceLearner: UserPreferenceLearner;
    private benchmarker: ModelBenchmarker;
    private database?: Database;

    private requestCounter: number = 0;

    constructor(baseRouter?: ModelRouter) {
        this.baseRouter = baseRouter || new ModelRouter();
        this.taskClassifier = EnhancedTaskClassifier;
        this.modelSelector = new ModelSelector(this.baseRouter.getRegistry());
        this.costOptimizer = new CostOptimizer();
        this.fallbackChain = new FallbackChain();
        this.performanceTracker = new PerformanceTracker();
        this.preferenceLearner = new UserPreferenceLearner();
        this.benchmarker = new ModelBenchmarker();

        console.log('[IntelligentModelRouter] Initialized with all subsystems');
    }

    /**
     * Connect to database for persistence
     */
    public async connectDatabase(): Promise<void> {
        try {
            this.database = Database.getInstance();
            if (!this.database.isReady()) {
                await this.database.connect();
            }
            await this.initializeDatabaseTables();
            console.log('[IntelligentModelRouter] Database connected');
        } catch (error) {
            console.warn('[IntelligentModelRouter] Database connection failed, using in-memory storage:', error);
        }
    }

    private async initializeDatabaseTables(): Promise<void> {
        if (!this.database) return;

        const createTablesSQL = `
            CREATE TABLE IF NOT EXISTS intelligent_router_metrics (
                id SERIAL PRIMARY KEY,
                model_name VARCHAR(255) NOT NULL,
                task_type VARCHAR(50) NOT NULL,
                total_requests INTEGER DEFAULT 0,
                successful_requests INTEGER DEFAULT 0,
                average_latency_ms FLOAT DEFAULT 0,
                average_tokens_used FLOAT DEFAULT 0,
                user_satisfaction_score FLOAT DEFAULT 3.0,
                error_rate FLOAT DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(model_name, task_type)
            );

            CREATE TABLE IF NOT EXISTS intelligent_router_user_preferences (
                user_id VARCHAR(255) PRIMARY KEY,
                cost_sensitivity FLOAT DEFAULT 0.5,
                quality_preference FLOAT DEFAULT 0.5,
                local_model_preference BOOLEAN DEFAULT FALSE,
                preferred_models JSONB DEFAULT '{}',
                feedback_history JSONB DEFAULT '[]',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS intelligent_router_ab_tests (
                test_id VARCHAR(255) PRIMARY KEY,
                test_name VARCHAR(255) NOT NULL,
                task_type VARCHAR(50) NOT NULL,
                model_a VARCHAR(255) NOT NULL,
                model_b VARCHAR(255) NOT NULL,
                traffic_split FLOAT DEFAULT 0.5,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                results JSONB DEFAULT '{}'
            );

            CREATE INDEX IF NOT EXISTS idx_metrics_model_task
                ON intelligent_router_metrics(model_name, task_type);
            CREATE INDEX IF NOT EXISTS idx_ab_tests_active
                ON intelligent_router_ab_tests(is_active, task_type);
        `;

        try {
            await this.database.query(createTablesSQL);
        } catch (error) {
            console.error('[IntelligentModelRouter] Failed to create tables:', error);
        }
    }

    /**
     * Main entry point - Generate response with intelligent routing
     */
    public async generateResponse(
        query: string,
        context: string,
        userId: string = 'default',
        role: BrainRole = BrainRole.CHAT
    ): Promise<ExecutionResult> {
        const requestId = `req_${++this.requestCounter}_${Date.now()}`;
        const startTime = Date.now();

        console.log(`[IntelligentModelRouter] Processing request ${requestId}`);

        // 1. Classify the task
        const taskAnalysis = this.taskClassifier.classify(query);
        console.log(`[IntelligentModelRouter] Task: ${taskAnalysis.type}, Complexity: ${taskAnalysis.complexity}`);

        // 2. Get user preferences
        const userPreferences = this.preferenceLearner.getPreferences(userId);

        // 3. Check for active A/B tests
        const activeTests = this.benchmarker.getActiveTestsForTask(taskAnalysis.type);
        let abTestId: string | undefined;
        let abVariant: 'A' | 'B' | undefined;

        // 4. Get available models
        const availableModels = this.baseRouter.getRegistry().listModels();

        // 5. Select optimal model
        const routingDecision = this.modelSelector.selectModel(
            taskAnalysis,
            userPreferences,
            availableModels,
            this.performanceTracker.getAllMetrics()
        );

        // 6. Check cost constraints
        if (!this.costOptimizer.isWithinBudget(userId, routingDecision.estimatedCost)) {
            console.warn(`[IntelligentModelRouter] User ${userId} over budget, using free tier`);
            // Force to cheapest model
            const cheapestModel = this.findCheapestModel(availableModels);
            if (cheapestModel) {
                routingDecision.selectedModel = cheapestModel;
            }
        }

        // 7. Override with A/B test if active
        if (activeTests.length > 0) {
            const test = activeTests[0];
            abTestId = test.testId;
            const assignment = this.benchmarker.getTestModel(test.testId);
            if (assignment) {
                abVariant = assignment;
                const testModel = this.benchmarker.getModelName(test.testId, assignment);
                if (testModel && availableModels.includes(testModel)) {
                    routingDecision.selectedModel = testModel;
                    console.log(`[IntelligentModelRouter] A/B test override: using ${testModel} (variant ${assignment})`);
                }
            }
        }

        console.log(`[IntelligentModelRouter] Selected: ${routingDecision.selectedModel}, Confidence: ${routingDecision.confidence.toFixed(2)}`);

        // 8. Execute with fallback chain
        let response: string;
        let modelUsed = routingDecision.selectedModel;
        let fallbacksAttempted = 0;
        let success = true;
        let error: string | undefined;
        let tokensUsed = 0;

        try {
            const result = await this.fallbackChain.execute(
                () => this.executeModel(routingDecision.selectedModel, query, context),
                routingDecision.fallbackChain.map(model => () => this.executeModel(model, query, context)),
                (attempt, err, nextModel) => {
                    console.log(`[IntelligentModelRouter] Fallback ${attempt}: ${err.message}`);
                    if (nextModel) fallbacksAttempted++;
                }
            );

            response = result.result;
            fallbacksAttempted = result.fallbacksUsed;

            // Determine which model actually succeeded
            if (fallbacksAttempted > 0 && fallbacksAttempted <= routingDecision.fallbackChain.length) {
                modelUsed = routingDecision.fallbackChain[fallbacksAttempted - 1];
            }

            // Estimate tokens used (rough approximation)
            tokensUsed = Math.ceil((query.length + response.length) / 4);

        } catch (e) {
            success = false;
            error = (e as Error).message;
            response = `Error: Unable to process request. ${error}`;
            console.error(`[IntelligentModelRouter] All models failed:`, error);
        }

        const latencyMs = Date.now() - startTime;

        // 9. Record metrics
        this.performanceTracker.recordRequest(
            modelUsed,
            taskAnalysis.type,
            latencyMs,
            tokensUsed,
            success
        );

        // 10. Record cost
        const actualCost = this.calculateActualCost(modelUsed, tokensUsed);
        this.costOptimizer.recordUsage(userId, actualCost);

        // 11. Record A/B test result
        if (abTestId && abVariant) {
            this.benchmarker.recordTestResult(abTestId, abVariant, latencyMs, success);
        }

        // 12. Persist metrics if database available
        await this.persistMetrics(modelUsed, taskAnalysis.type);

        return {
            requestId,
            modelUsed,
            response,
            latencyMs,
            tokensUsed,
            fallbacksAttempted,
            success,
            error
        };
    }

    private async executeModel(modelName: string, query: string, context: string): Promise<string> {
        const config = this.baseRouter.getRegistry().getConfig(modelName);
        if (!config) {
            throw new Error(`Model ${modelName} not found in registry`);
        }

        const model = UniversalAdapter.createModel(config);
        const systemPrompt = UniversalAdapter.translateSystemPrompt(
            `You are Astra, an advanced AI assistant.

CONTEXT FROM LOCAL FILES:
${context}

INSTRUCTIONS:
1. Answer the user's query based on the context provided.
2. Be concise and professional.`,
            config.providerType
        );

        const { text } = await generateText({
            model,
            system: systemPrompt,
            prompt: query
        });

        return text;
    }

    private findCheapestModel(models: string[]): string | undefined {
        let cheapest: string | undefined;
        let lowestCost = Infinity;

        for (const model of models) {
            const caps = this.modelSelector.getCapabilities(model);
            if (caps && caps.costPerMillionTokens < lowestCost) {
                lowestCost = caps.costPerMillionTokens;
                cheapest = model;
            }
        }

        return cheapest;
    }

    private calculateActualCost(modelName: string, tokens: number): number {
        const caps = this.modelSelector.getCapabilities(modelName);
        if (!caps) return 0;
        return (tokens / 1_000_000) * caps.costPerMillionTokens;
    }

    private async persistMetrics(modelName: string, taskType: TaskType): Promise<void> {
        if (!this.database) return;

        const metrics = this.performanceTracker.getTaskMetrics(modelName, taskType);
        if (!metrics) return;

        try {
            await this.database.query(`
                INSERT INTO intelligent_router_metrics
                    (model_name, task_type, total_requests, successful_requests,
                     average_latency_ms, average_tokens_used, user_satisfaction_score,
                     error_rate, last_updated)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                ON CONFLICT (model_name, task_type)
                DO UPDATE SET
                    total_requests = $3,
                    successful_requests = $4,
                    average_latency_ms = $5,
                    average_tokens_used = $6,
                    user_satisfaction_score = $7,
                    error_rate = $8,
                    last_updated = CURRENT_TIMESTAMP
            `, [
                metrics.modelName,
                metrics.taskType,
                metrics.totalRequests,
                metrics.successfulRequests,
                metrics.averageLatencyMs,
                metrics.averageTokensUsed,
                metrics.userSatisfactionScore,
                metrics.errorRate
            ]);
        } catch (error) {
            console.error('[IntelligentModelRouter] Failed to persist metrics:', error);
        }
    }

    // ========================================================================
    // Public API - User Feedback
    // ========================================================================

    /**
     * Submit user feedback for a request
     */
    public submitFeedback(
        userId: string,
        requestId: string,
        modelName: string,
        taskType: TaskType,
        rating: number,
        wasHelpful: boolean,
        latencyAcceptable: boolean,
        comment?: string
    ): void {
        const feedback: FeedbackEntry = {
            requestId,
            modelName,
            taskType,
            rating: Math.max(1, Math.min(5, rating)),
            wasHelpful,
            latencyAcceptable,
            timestamp: new Date(),
            comment
        };

        this.preferenceLearner.recordFeedback(userId, feedback);
        this.performanceTracker.recordRequest(modelName, taskType, 0, 0, wasHelpful, rating);

        console.log(`[IntelligentModelRouter] Recorded feedback from ${userId}: ${rating}/5 for ${modelName}`);
    }

    // ========================================================================
    // Public API - A/B Testing
    // ========================================================================

    /**
     * Start an A/B test
     */
    public startABTest(
        testName: string,
        taskType: TaskType,
        modelA: string,
        modelB: string,
        trafficSplit: number = 0.5,
        durationDays?: number
    ): string {
        const endDate = durationDays
            ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
            : undefined;

        return this.benchmarker.createTest({
            testName,
            taskType,
            modelA,
            modelB,
            trafficSplit,
            startDate: new Date(),
            endDate,
            isActive: true
        });
    }

    /**
     * Get A/B test results
     */
    public getABTestResults(testId: string): ABTestResult | null {
        return this.benchmarker.getTestResults(testId);
    }

    /**
     * End an A/B test
     */
    public endABTest(testId: string): ABTestResult | null {
        return this.benchmarker.endTest(testId);
    }

    /**
     * List all A/B tests
     */
    public listABTests(): ABTestConfig[] {
        return this.benchmarker.listTests();
    }

    // ========================================================================
    // Public API - Cost Management
    // ========================================================================

    /**
     * Set budget limits for a user
     */
    public setBudgetLimits(userId: string, dailyLimit: number, monthlyLimit: number): void {
        this.costOptimizer.setBudgetLimits(userId, dailyLimit, monthlyLimit);
    }

    /**
     * Get usage statistics for a user
     */
    public getUsageStats(userId: string): { today: number; thisMonth: number; limits?: { daily: number; monthly: number } } {
        return this.costOptimizer.getUsageStats(userId);
    }

    // ========================================================================
    // Public API - Preferences
    // ========================================================================

    /**
     * Set user preferences
     */
    public setUserPreferences(
        userId: string,
        preferences: {
            costSensitivity?: number;
            qualityPreference?: number;
            localModelPreference?: boolean;
            preferredModels?: Map<TaskType, string>;
        }
    ): void {
        this.preferenceLearner.setPreferences(userId, preferences);
    }

    /**
     * Get user preferences
     */
    public getUserPreferences(userId: string): UserPreferences {
        return this.preferenceLearner.getPreferences(userId);
    }

    // ========================================================================
    // Public API - Performance Analytics
    // ========================================================================

    /**
     * Get model performance metrics
     */
    public getModelPerformance(modelName: string): ModelPerformanceMetrics[] {
        return this.performanceTracker.getModelMetrics(modelName);
    }

    /**
     * Get best model for a specific task type
     */
    public getBestModelForTask(taskType: TaskType): string | undefined {
        return this.performanceTracker.getBestModelForTask(taskType);
    }

    /**
     * Get recent performance trend
     */
    public getRecentTrend(modelName: string, windowHours: number = 24): {
        successRate: number;
        avgLatency: number;
        requestCount: number;
    } {
        return this.performanceTracker.getRecentTrend(modelName, windowHours);
    }

    // ========================================================================
    // Public API - Model Management
    // ========================================================================

    /**
     * Register model capabilities
     */
    public registerModelCapabilities(capabilities: ModelCapabilities): void {
        this.modelSelector.registerCapabilities(capabilities);
    }

    /**
     * Get model capabilities
     */
    public getModelCapabilities(modelName: string): ModelCapabilities | undefined {
        return this.modelSelector.getCapabilities(modelName);
    }

    /**
     * Get the underlying model registry
     */
    public getRegistry(): ModelRegistry {
        return this.baseRouter.getRegistry();
    }

    /**
     * Get the base router for direct access
     */
    public getBaseRouter(): ModelRouter {
        return this.baseRouter;
    }

    // ========================================================================
    // Public API - Fallback Configuration
    // ========================================================================

    /**
     * Configure fallback behavior
     */
    public configureFallback(maxAttempts?: number, retryDelayMs?: number): void {
        this.fallbackChain.setConfig(maxAttempts, retryDelayMs);
    }

    /**
     * Get fallback configuration
     */
    public getFallbackConfig(): { maxAttempts: number; retryDelayMs: number } {
        return this.fallbackChain.getConfig();
    }

    // ========================================================================
    // Public API - Task Analysis
    // ========================================================================

    /**
     * Analyze a query to get task details
     */
    public analyzeTask(query: string): TaskAnalysis {
        return this.taskClassifier.classify(query);
    }

    // ========================================================================
    // Public API - Export/Import
    // ========================================================================

    /**
     * Export all state for backup
     */
    public exportState(): {
        metrics: string;
        preferences: Map<string, string>;
    } {
        const preferences = new Map<string, string>();
        // Note: In production, iterate over actual user IDs
        return {
            metrics: this.performanceTracker.exportMetrics(),
            preferences
        };
    }

    /**
     * Import state from backup
     */
    public importState(state: { metrics: string; preferences: Map<string, string> }): void {
        this.performanceTracker.importMetrics(state.metrics);
        for (const [userId, prefData] of state.preferences) {
            this.preferenceLearner.importPreferences(userId, prefData);
        }
    }
}

// ============================================================================
// Factory function for easy instantiation
// ============================================================================

export function createIntelligentRouter(baseRouter?: ModelRouter): IntelligentModelRouter {
    return new IntelligentModelRouter(baseRouter);
}

// Default export
export default IntelligentModelRouter;
