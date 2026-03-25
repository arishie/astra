/**
 * MoralCompass - AI Ethics Layer for Astra
 *
 * Evaluates all AI actions against ethical guidelines before execution.
 * Provides transparency, audit logging, and configurable policies per organization.
 */
import { EventEmitter } from 'events';
/**
 * Categories of harmful content that the system can detect and block.
 */
export declare enum HarmCategory {
    ILLEGAL_ACTIVITIES = "illegal_activities",
    HARASSMENT_HATE_SPEECH = "harassment_hate_speech",
    PRIVACY_VIOLATIONS = "privacy_violations",
    MISINFORMATION = "misinformation",
    FINANCIAL_MANIPULATION = "financial_manipulation",
    BOT_ARMY_SPAM = "bot_army_spam",
    VIOLENCE = "violence",
    FRAUD = "fraud",
    WEAPONS = "weapons",
    HACKING = "hacking",
    CHILD_SAFETY = "child_safety",
    SELF_HARM = "self_harm"
}
/**
 * Severity levels for ethical violations.
 */
export declare enum Severity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
/**
 * Result of an ethical evaluation.
 */
export declare enum EvaluationResult {
    ALLOWED = "allowed",
    BLOCKED = "blocked",
    REQUIRES_REVIEW = "requires_review",
    MODIFIED = "modified"
}
/**
 * Types of actions that can be evaluated.
 */
export declare enum ActionType {
    TEXT_GENERATION = "text_generation",
    CODE_EXECUTION = "code_execution",
    FILE_OPERATION = "file_operation",
    WEB_REQUEST = "web_request",
    DATA_ACCESS = "data_access",
    AUTOMATION = "automation",
    MESSAGING = "messaging",
    IMAGE_GENERATION = "image_generation",
    TOOL_USE = "tool_use"
}
/**
 * Configuration for a specific harm category rule.
 */
export interface HarmRule {
    category: HarmCategory;
    enabled: boolean;
    severity: Severity;
    action: EvaluationResult;
    patterns?: RegExp[];
    keywords?: string[];
    customValidator?: (content: string, context: EvaluationContext) => boolean;
}
/**
 * Ethics policy configuration for an organization.
 */
export interface EthicsPolicy {
    id: string;
    name: string;
    organizationId: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    enabled: boolean;
    strictMode: boolean;
    defaultAction: EvaluationResult;
    rules: HarmRule[];
    allowedDomains?: string[];
    blockedDomains?: string[];
    allowedUsers?: string[];
    exemptActions?: ActionType[];
    confidenceThreshold: number;
    maxViolationsBeforeBlock: number;
    preEvaluationHook?: (action: ProposedAction) => Promise<ProposedAction>;
    postEvaluationHook?: (result: EvaluationResponse) => Promise<EvaluationResponse>;
}
/**
 * A proposed action to be evaluated.
 */
export interface ProposedAction {
    id: string;
    type: ActionType;
    userId: string;
    organizationId?: string;
    timestamp: Date;
    content: string;
    metadata?: Record<string, any>;
    context?: EvaluationContext;
    source: {
        platform: string;
        ip?: string;
        userAgent?: string;
    };
}
/**
 * Context for evaluation decisions.
 */
export interface EvaluationContext {
    conversationHistory?: string[];
    previousViolations?: ViolationRecord[];
    userTrustScore?: number;
    sessionId?: string;
    additionalContext?: Record<string, any>;
}
/**
 * Record of a policy violation.
 */
export interface ViolationRecord {
    id: string;
    actionId: string;
    userId: string;
    organizationId?: string;
    timestamp: Date;
    category: HarmCategory;
    severity: Severity;
    content: string;
    contentHash: string;
    reason: string;
    action: EvaluationResult;
    reviewed: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
}
/**
 * Result of content classification.
 */
export interface ClassificationResult {
    categories: Array<{
        category: HarmCategory;
        confidence: number;
        matchedPatterns?: string[];
        matchedKeywords?: string[];
    }>;
    overallRisk: Severity;
    flags: string[];
}
/**
 * Response from the ethical evaluation.
 */
export interface EvaluationResponse {
    actionId: string;
    result: EvaluationResult;
    timestamp: Date;
    classification: ClassificationResult;
    violations: Array<{
        category: HarmCategory;
        severity: Severity;
        reason: string;
    }>;
    explanation: string;
    suggestedModifications?: string;
    appealable: boolean;
    policyId: string;
    policyVersion: string;
    processingTimeMs: number;
    evaluatorVersion: string;
}
/**
 * Audit log entry for ethical decisions.
 */
export interface EthicsAuditEntry {
    id: string;
    timestamp: Date;
    actionId: string;
    userId: string;
    organizationId?: string;
    result: EvaluationResult;
    categories: HarmCategory[];
    severity: Severity;
    explanation: string;
    contentHash: string;
    contentSnippet?: string;
    policyId: string;
    policyVersion: string;
    reviewed: boolean;
    reviewedBy?: string;
    reviewNotes?: string;
}
/**
 * ContentClassifier - Detects harmful content categories using pattern matching
 * and keyword analysis. In production, this would integrate with ML models.
 */
export declare class ContentClassifier {
    private readonly patterns;
    private readonly keywords;
    constructor();
    /**
     * Initialize regex patterns for each harm category.
     */
    private initializePatterns;
    /**
     * Initialize keywords for each harm category.
     */
    private initializeKeywords;
    /**
     * Classify content against all harm categories.
     */
    classify(content: string, context?: EvaluationContext): ClassificationResult;
    /**
     * Classify content against a specific category.
     */
    private classifyCategory;
    /**
     * Get severity based on category and confidence.
     */
    private getCategorySeverity;
    /**
     * Compare two severity levels. Returns positive if a > b.
     */
    private compareSeverity;
}
/**
 * ActionEvaluator - Evaluates proposed actions against ethics policies.
 */
export declare class ActionEvaluator {
    private readonly classifier;
    constructor(classifier: ContentClassifier);
    /**
     * Evaluate a proposed action against a policy.
     */
    evaluate(action: ProposedAction, policy: EthicsPolicy): Promise<EvaluationResponse>;
    /**
     * Create an allowed response for exempt actions.
     */
    private createAllowedResponse;
    /**
     * Evaluate classification results against policy rules.
     */
    private evaluateAgainstRules;
    /**
     * Generate a human-readable reason for a violation.
     */
    private generateViolationReason;
    /**
     * Get the highest severity from a list of violations.
     */
    private getHighestSeverity;
    /**
     * Generate an explanation for a blocked action.
     */
    private generateBlockExplanation;
    /**
     * Generate an explanation for an action requiring review.
     */
    private generateReviewExplanation;
}
/**
 * AuditLogger - Logs all ethical decisions for compliance and review.
 */
export declare class EthicsAuditLogger {
    private readonly logs;
    private readonly maxInMemoryLogs;
    private persistCallback?;
    /**
     * Set a callback for persisting audit logs to external storage.
     */
    setPersistCallback(callback: (entry: EthicsAuditEntry) => Promise<void>): void;
    /**
     * Log an ethical evaluation result.
     */
    log(action: ProposedAction, response: EvaluationResponse): Promise<string>;
    /**
     * Get audit logs with optional filtering.
     */
    query(options: {
        userId?: string;
        organizationId?: string;
        result?: EvaluationResult;
        category?: HarmCategory;
        startDate?: Date;
        endDate?: Date;
        reviewed?: boolean;
        limit?: number;
        offset?: number;
    }): EthicsAuditEntry[];
    /**
     * Mark an audit entry as reviewed.
     */
    markReviewed(entryId: string, reviewedBy: string, notes?: string): boolean;
    /**
     * Get statistics for audit logs.
     */
    getStats(days?: number): {
        totalEvaluations: number;
        blocked: number;
        allowed: number;
        requiresReview: number;
        byCategory: Record<string, number>;
        bySeverity: Record<string, number>;
    };
    /**
     * Export logs for compliance reporting.
     */
    exportLogs(startDate: Date, endDate: Date, format?: 'json' | 'csv'): string;
    /**
     * Hash content for privacy-preserving storage.
     */
    private hashContent;
    /**
     * Truncate content for snippet storage.
     */
    private truncateContent;
}
/**
 * MoralCompass - The main AI Ethics Layer for Astra.
 *
 * Evaluates all AI actions against ethical guidelines before execution,
 * blocks harmful requests, provides transparency, and maintains audit logs.
 */
export declare class MoralCompass extends EventEmitter {
    private static instance;
    private readonly classifier;
    private readonly evaluator;
    private readonly auditLogger;
    private readonly policies;
    private defaultPolicy;
    private enabled;
    private constructor();
    /**
     * Get the singleton instance of MoralCompass.
     */
    static getInstance(): MoralCompass;
    /**
     * Create the default ethics policy.
     */
    private createDefaultPolicy;
    /**
     * Create default harm rules.
     */
    private createDefaultRules;
    /**
     * Enable or disable the ethics layer.
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if the ethics layer is enabled.
     */
    isEnabled(): boolean;
    /**
     * Evaluate a proposed action against ethical guidelines.
     * This is the main entry point for the ethics layer.
     */
    evaluate(content: string, actionType: ActionType, userId: string, options?: {
        organizationId?: string;
        context?: EvaluationContext;
        source?: ProposedAction['source'];
        metadata?: Record<string, any>;
    }): Promise<EvaluationResponse>;
    /**
     * Quick check if content is likely harmful (without full evaluation).
     */
    quickCheck(content: string): {
        isHarmful: boolean;
        categories: HarmCategory[];
    };
    /**
     * Register a custom ethics policy for an organization.
     */
    registerPolicy(policy: EthicsPolicy): void;
    /**
     * Update an existing policy.
     */
    updatePolicy(organizationId: string, updates: Partial<EthicsPolicy>): boolean;
    /**
     * Get the policy for an organization, falling back to default.
     */
    getPolicy(organizationId?: string): EthicsPolicy;
    /**
     * List all registered policies.
     */
    listPolicies(): EthicsPolicy[];
    /**
     * Remove a policy (revert to default).
     */
    removePolicy(organizationId: string): boolean;
    /**
     * Set the audit logger's persist callback for external storage.
     */
    setAuditPersistCallback(callback: (entry: EthicsAuditEntry) => Promise<void>): void;
    /**
     * Query audit logs.
     */
    queryAuditLogs(options: Parameters<EthicsAuditLogger['query']>[0]): EthicsAuditEntry[];
    /**
     * Get audit statistics.
     */
    getAuditStats(days?: number): ReturnType<EthicsAuditLogger['getStats']>;
    /**
     * Export audit logs.
     */
    exportAuditLogs(startDate: Date, endDate: Date, format?: 'json' | 'csv'): string;
    /**
     * Mark an audit entry as reviewed.
     */
    markAuditReviewed(entryId: string, reviewedBy: string, notes?: string): boolean;
    /**
     * Get the content classifier for direct access.
     */
    getClassifier(): ContentClassifier;
    /**
     * Get the action evaluator for direct access.
     */
    getEvaluator(): ActionEvaluator;
    /**
     * Get the audit logger for direct access.
     */
    getAuditLogger(): EthicsAuditLogger;
    /**
     * Increment a semantic version string.
     */
    private incrementVersion;
    /**
     * Middleware function for message processing pipelines.
     * Returns a function that can be used in message handlers.
     */
    createMiddleware(): (content: string, userId: string, next: () => Promise<void>) => Promise<{
        allowed: boolean;
        response?: EvaluationResponse;
    }>;
    /**
     * Hook for pre-action validation in the orchestrator.
     */
    validateAction(content: string, actionType: ActionType, userId: string, organizationId?: string): Promise<{
        valid: boolean;
        reason?: string;
        response?: EvaluationResponse;
    }>;
    /**
     * Register event handlers for orchestrator integration.
     */
    registerOrchestratorHooks(orchestrator: {
        on: (event: string, handler: (...args: any[]) => void) => void;
    }): void;
}
/**
 * Get the MoralCompass singleton instance.
 */
export declare function getMoralCompass(): MoralCompass;
/**
 * Create a new ethics policy with default values.
 */
export declare function createEthicsPolicy(organizationId: string, name: string, overrides?: Partial<Omit<EthicsPolicy, 'id' | 'organizationId' | 'name' | 'createdAt' | 'updatedAt'>>): EthicsPolicy;
export default MoralCompass;
//# sourceMappingURL=MoralCompass.d.ts.map