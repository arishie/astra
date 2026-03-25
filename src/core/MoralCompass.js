// @ts-nocheck
/**
 * MoralCompass - AI Ethics Layer for Astra
 *
 * Evaluates all AI actions against ethical guidelines before execution.
 * Provides transparency, audit logging, and configurable policies per organization.
 */
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
// ============================================================================
// Enums and Types
// ============================================================================
/**
 * Categories of harmful content that the system can detect and block.
 */
export var HarmCategory;
(function (HarmCategory) {
    HarmCategory["ILLEGAL_ACTIVITIES"] = "illegal_activities";
    HarmCategory["HARASSMENT_HATE_SPEECH"] = "harassment_hate_speech";
    HarmCategory["PRIVACY_VIOLATIONS"] = "privacy_violations";
    HarmCategory["MISINFORMATION"] = "misinformation";
    HarmCategory["FINANCIAL_MANIPULATION"] = "financial_manipulation";
    HarmCategory["BOT_ARMY_SPAM"] = "bot_army_spam";
    HarmCategory["VIOLENCE"] = "violence";
    HarmCategory["FRAUD"] = "fraud";
    HarmCategory["WEAPONS"] = "weapons";
    HarmCategory["HACKING"] = "hacking";
    HarmCategory["CHILD_SAFETY"] = "child_safety";
    HarmCategory["SELF_HARM"] = "self_harm";
})(HarmCategory || (HarmCategory = {}));
/**
 * Severity levels for ethical violations.
 */
export var Severity;
(function (Severity) {
    Severity["LOW"] = "low";
    Severity["MEDIUM"] = "medium";
    Severity["HIGH"] = "high";
    Severity["CRITICAL"] = "critical";
})(Severity || (Severity = {}));
/**
 * Result of an ethical evaluation.
 */
export var EvaluationResult;
(function (EvaluationResult) {
    EvaluationResult["ALLOWED"] = "allowed";
    EvaluationResult["BLOCKED"] = "blocked";
    EvaluationResult["REQUIRES_REVIEW"] = "requires_review";
    EvaluationResult["MODIFIED"] = "modified";
})(EvaluationResult || (EvaluationResult = {}));
/**
 * Types of actions that can be evaluated.
 */
export var ActionType;
(function (ActionType) {
    ActionType["TEXT_GENERATION"] = "text_generation";
    ActionType["CODE_EXECUTION"] = "code_execution";
    ActionType["FILE_OPERATION"] = "file_operation";
    ActionType["WEB_REQUEST"] = "web_request";
    ActionType["DATA_ACCESS"] = "data_access";
    ActionType["AUTOMATION"] = "automation";
    ActionType["MESSAGING"] = "messaging";
    ActionType["IMAGE_GENERATION"] = "image_generation";
    ActionType["TOOL_USE"] = "tool_use";
})(ActionType || (ActionType = {}));
// ============================================================================
// Content Classifier
// ============================================================================
/**
 * ContentClassifier - Detects harmful content categories using pattern matching
 * and keyword analysis. In production, this would integrate with ML models.
 */
export class ContentClassifier {
    patterns = new Map();
    keywords = new Map();
    constructor() {
        this.initializePatterns();
        this.initializeKeywords();
    }
    /**
     * Initialize regex patterns for each harm category.
     */
    initializePatterns() {
        // Illegal activities patterns
        this.patterns.set(HarmCategory.ILLEGAL_ACTIVITIES, [
            /\b(counterfeit|forge|launder|money\s*launder)/gi,
            /\b(drug\s*deal|sell\s*drugs|buy\s*drugs)/gi,
            /\b(illegal\s*gambling|underground\s*casino)/gi,
            /\b(human\s*traffic)/gi,
        ]);
        // Fraud patterns
        this.patterns.set(HarmCategory.FRAUD, [
            /\b(phishing|spoof|impersonate.*bank)/gi,
            /\b(steal\s*credit\s*card|card\s*skimming)/gi,
            /\b(ponzi|pyramid\s*scheme)/gi,
            /\b(fake\s*invoice|fraudulent\s*claim)/gi,
            /\b(identity\s*theft|steal\s*identity)/gi,
        ]);
        // Hacking patterns
        this.patterns.set(HarmCategory.HACKING, [
            /\b(sql\s*inject|xss\s*attack|exploit\s*vulnerab)/gi,
            /\b(brute\s*force\s*password|crack\s*password)/gi,
            /\b(ddos\s*attack|denial\s*of\s*service)/gi,
            /\b(ransomware|malware|trojan|keylogger)/gi,
            /\b(bypass\s*security|break\s*into\s*system)/gi,
            /\b(zero\s*day\s*exploit)/gi,
        ]);
        // Weapons patterns
        this.patterns.set(HarmCategory.WEAPONS, [
            /\b(build\s*bomb|make\s*explosive|create\s*weapon)/gi,
            /\b(3d\s*print.*gun|ghost\s*gun)/gi,
            /\b(chemical\s*weapon|biological\s*weapon)/gi,
            /\b(poison.*recipe|toxic.*create)/gi,
        ]);
        // Harassment patterns
        this.patterns.set(HarmCategory.HARASSMENT_HATE_SPEECH, [
            /\b(dox|doxx|reveal.*address.*of)/gi,
            /\b(harass|stalk|threaten.*harm)/gi,
            /\b(hate\s*speech|racial\s*slur)/gi,
            /\b(kill\s*yourself|kys)/gi,
        ]);
        // Privacy violation patterns
        this.patterns.set(HarmCategory.PRIVACY_VIOLATIONS, [
            /\b(ssn|social\s*security\s*number).*\d{3}[-\s]?\d{2}[-\s]?\d{4}/gi,
            /\b(credit\s*card\s*number|cvv|ccv)/gi,
            /\b(spy\s*on|surveil|track\s*location)/gi,
            /\b(access.*private.*email|read.*private.*message)/gi,
        ]);
        // Misinformation patterns
        this.patterns.set(HarmCategory.MISINFORMATION, [
            /\b(fake\s*news|spread\s*lies|disinformation\s*campaign)/gi,
            /\b(election\s*fraud.*help|manipulate\s*vote)/gi,
            /\b(vaccine.*microchip|covid.*hoax)/gi,
        ]);
        // Financial manipulation patterns
        this.patterns.set(HarmCategory.FINANCIAL_MANIPULATION, [
            /\b(pump\s*and\s*dump|market\s*manipulat)/gi,
            /\b(insider\s*trad|front\s*run)/gi,
            /\b(wash\s*trad|spoof.*order)/gi,
            /\b(artificially\s*inflate.*price)/gi,
        ]);
        // Bot army/spam patterns
        this.patterns.set(HarmCategory.BOT_ARMY_SPAM, [
            /\b(create.*bot.*army|automate.*spam)/gi,
            /\b(fake\s*account.*bulk|mass\s*register)/gi,
            /\b(astroturf|fake\s*review.*generate)/gi,
            /\b(click\s*farm|like\s*farm)/gi,
        ]);
        // Violence patterns
        this.patterns.set(HarmCategory.VIOLENCE, [
            /\b(kill|murder|assassinate).*person/gi,
            /\b(torture|inflict\s*pain)/gi,
            /\b(mass\s*shoot|bomb\s*threat)/gi,
            /\b(terroris[mt]|terror\s*attack)/gi,
        ]);
        // Child safety patterns
        this.patterns.set(HarmCategory.CHILD_SAFETY, [
            /\b(csam|child\s*abuse\s*material)/gi,
            /\b(minor.*exploit|groom.*child)/gi,
        ]);
        // Self-harm patterns
        this.patterns.set(HarmCategory.SELF_HARM, [
            /\b(how\s*to\s*commit\s*suicide)/gi,
            /\b(self\s*harm.*method|cut\s*yourself)/gi,
            /\b(suicide.*method|end.*my.*life.*how)/gi,
        ]);
    }
    /**
     * Initialize keywords for each harm category.
     */
    initializeKeywords() {
        this.keywords.set(HarmCategory.ILLEGAL_ACTIVITIES, new Set([
            'illegal', 'contraband', 'smuggle', 'trafficking', 'bribery',
        ]));
        this.keywords.set(HarmCategory.FRAUD, new Set([
            'scam', 'phish', 'impersonate', 'counterfeit', 'forgery',
        ]));
        this.keywords.set(HarmCategory.HACKING, new Set([
            'exploit', 'vulnerability', 'backdoor', 'rootkit', 'botnet',
        ]));
        this.keywords.set(HarmCategory.WEAPONS, new Set([
            'explosive', 'detonator', 'bioweapon', 'nerve agent',
        ]));
        this.keywords.set(HarmCategory.HARASSMENT_HATE_SPEECH, new Set([
            'harassment', 'stalking', 'doxxing', 'intimidate',
        ]));
        this.keywords.set(HarmCategory.PRIVACY_VIOLATIONS, new Set([
            'surveillance', 'wiretap', 'spy', 'eavesdrop',
        ]));
        this.keywords.set(HarmCategory.MISINFORMATION, new Set([
            'disinformation', 'propaganda', 'conspiracy', 'hoax',
        ]));
        this.keywords.set(HarmCategory.FINANCIAL_MANIPULATION, new Set([
            'manipulation', 'insider', 'ponzi', 'pyramid',
        ]));
        this.keywords.set(HarmCategory.BOT_ARMY_SPAM, new Set([
            'botnet', 'spam', 'astroturf', 'sockpuppet',
        ]));
        this.keywords.set(HarmCategory.VIOLENCE, new Set([
            'murder', 'assassinate', 'massacre', 'genocide',
        ]));
        this.keywords.set(HarmCategory.CHILD_SAFETY, new Set([
            'csam', 'grooming', 'pedophile',
        ]));
        this.keywords.set(HarmCategory.SELF_HARM, new Set([
            'suicide', 'self-harm', 'self-injury',
        ]));
    }
    /**
     * Classify content against all harm categories.
     */
    classify(content, context) {
        const categories = [];
        const flags = [];
        let highestSeverity = Severity.LOW;
        const normalizedContent = content.toLowerCase();
        for (const category of Object.values(HarmCategory)) {
            const result = this.classifyCategory(category, content, normalizedContent);
            if (result.confidence > 0) {
                categories.push({
                    category,
                    confidence: result.confidence,
                    matchedPatterns: result.matchedPatterns,
                    matchedKeywords: result.matchedKeywords,
                });
                // Update highest severity based on category and confidence
                const categorySeverity = this.getCategorySeverity(category, result.confidence);
                if (this.compareSeverity(categorySeverity, highestSeverity) > 0) {
                    highestSeverity = categorySeverity;
                }
                // Add flags for significant matches
                if (result.confidence >= 0.7) {
                    flags.push(`HIGH_CONFIDENCE_${category.toUpperCase()}`);
                }
            }
        }
        // Check for context-based escalation
        if (context?.previousViolations && context.previousViolations.length > 0) {
            flags.push('REPEAT_OFFENDER');
            if (highestSeverity === Severity.LOW) {
                highestSeverity = Severity.MEDIUM;
            }
        }
        return {
            categories: categories.sort((a, b) => b.confidence - a.confidence),
            overallRisk: highestSeverity,
            flags,
        };
    }
    /**
     * Classify content against a specific category.
     */
    classifyCategory(category, content, normalizedContent) {
        const matchedPatterns = [];
        const matchedKeywords = [];
        let score = 0;
        // Check patterns
        const patterns = this.patterns.get(category) || [];
        for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
                matchedPatterns.push(...matches);
                score += 0.3 * matches.length;
            }
        }
        // Check keywords
        const keywords = this.keywords.get(category) || new Set();
        for (const keyword of keywords) {
            if (normalizedContent.includes(keyword.toLowerCase())) {
                matchedKeywords.push(keyword);
                score += 0.15;
            }
        }
        // Calculate confidence (capped at 1.0)
        const confidence = Math.min(score, 1.0);
        return { confidence, matchedPatterns, matchedKeywords };
    }
    /**
     * Get severity based on category and confidence.
     */
    getCategorySeverity(category, confidence) {
        // Critical categories always start at HIGH
        const criticalCategories = [
            HarmCategory.CHILD_SAFETY,
            HarmCategory.VIOLENCE,
            HarmCategory.WEAPONS,
        ];
        if (criticalCategories.includes(category)) {
            return confidence >= 0.5 ? Severity.CRITICAL : Severity.HIGH;
        }
        // High-risk categories
        const highRiskCategories = [
            HarmCategory.ILLEGAL_ACTIVITIES,
            HarmCategory.FRAUD,
            HarmCategory.HACKING,
        ];
        if (highRiskCategories.includes(category)) {
            if (confidence >= 0.7)
                return Severity.HIGH;
            if (confidence >= 0.4)
                return Severity.MEDIUM;
            return Severity.LOW;
        }
        // Standard categories
        if (confidence >= 0.8)
            return Severity.HIGH;
        if (confidence >= 0.5)
            return Severity.MEDIUM;
        return Severity.LOW;
    }
    /**
     * Compare two severity levels. Returns positive if a > b.
     */
    compareSeverity(a, b) {
        const order = {
            [Severity.LOW]: 0,
            [Severity.MEDIUM]: 1,
            [Severity.HIGH]: 2,
            [Severity.CRITICAL]: 3,
        };
        return order[a] - order[b];
    }
}
// ============================================================================
// Action Evaluator
// ============================================================================
/**
 * ActionEvaluator - Evaluates proposed actions against ethics policies.
 */
export class ActionEvaluator {
    classifier;
    constructor(classifier) {
        this.classifier = classifier;
    }
    /**
     * Evaluate a proposed action against a policy.
     */
    async evaluate(action, policy) {
        const startTime = Date.now();
        // Run pre-evaluation hook if defined
        let processedAction = action;
        if (policy.preEvaluationHook) {
            try {
                processedAction = await policy.preEvaluationHook(action);
            }
            catch (error) {
                console.error('[ActionEvaluator] Pre-evaluation hook failed:', error);
            }
        }
        // Check if action type is exempt
        if (policy.exemptActions?.includes(processedAction.type)) {
            return this.createAllowedResponse(processedAction, policy, startTime);
        }
        // Check if user is in allowlist
        if (policy.allowedUsers?.includes(processedAction.userId)) {
            return this.createAllowedResponse(processedAction, policy, startTime);
        }
        // Classify the content
        const classification = this.classifier.classify(processedAction.content, processedAction.context);
        // Evaluate against policy rules
        const violations = this.evaluateAgainstRules(classification, policy);
        // Determine final result
        let result = EvaluationResult.ALLOWED;
        let explanation = 'Action permitted - no policy violations detected.';
        if (violations.length > 0) {
            const highestSeverity = this.getHighestSeverity(violations);
            if (highestSeverity === Severity.CRITICAL ||
                (policy.strictMode && highestSeverity === Severity.HIGH)) {
                result = EvaluationResult.BLOCKED;
                explanation = this.generateBlockExplanation(violations);
            }
            else if (highestSeverity === Severity.HIGH) {
                result = EvaluationResult.REQUIRES_REVIEW;
                explanation = this.generateReviewExplanation(violations);
            }
            else if (highestSeverity === Severity.MEDIUM && policy.strictMode) {
                result = EvaluationResult.REQUIRES_REVIEW;
                explanation = this.generateReviewExplanation(violations);
            }
        }
        // Check violation count threshold
        const previousViolationCount = processedAction.context?.previousViolations?.length || 0;
        if (previousViolationCount >= policy.maxViolationsBeforeBlock && result === EvaluationResult.ALLOWED) {
            if (violations.length > 0) {
                result = EvaluationResult.BLOCKED;
                explanation = `Action blocked due to repeated violations (${previousViolationCount} previous). ${explanation}`;
            }
        }
        let response = {
            actionId: processedAction.id,
            result,
            timestamp: new Date(),
            classification,
            violations,
            explanation,
            appealable: result === EvaluationResult.BLOCKED && violations.every(v => v.severity !== Severity.CRITICAL),
            policyId: policy.id,
            policyVersion: policy.version,
            processingTimeMs: Date.now() - startTime,
            evaluatorVersion: '1.0.0',
        };
        // Run post-evaluation hook if defined
        if (policy.postEvaluationHook) {
            try {
                response = await policy.postEvaluationHook(response);
            }
            catch (error) {
                console.error('[ActionEvaluator] Post-evaluation hook failed:', error);
            }
        }
        return response;
    }
    /**
     * Create an allowed response for exempt actions.
     */
    createAllowedResponse(action, policy, startTime) {
        return {
            actionId: action.id,
            result: EvaluationResult.ALLOWED,
            timestamp: new Date(),
            classification: {
                categories: [],
                overallRisk: Severity.LOW,
                flags: ['EXEMPT'],
            },
            violations: [],
            explanation: 'Action permitted - user or action type is exempt from policy.',
            appealable: false,
            policyId: policy.id,
            policyVersion: policy.version,
            processingTimeMs: Date.now() - startTime,
            evaluatorVersion: '1.0.0',
        };
    }
    /**
     * Evaluate classification results against policy rules.
     */
    evaluateAgainstRules(classification, policy) {
        const violations = [];
        for (const detected of classification.categories) {
            // Find matching rule in policy
            const rule = policy.rules.find(r => r.category === detected.category);
            if (!rule || !rule.enabled) {
                continue;
            }
            // Check if confidence exceeds threshold
            if (detected.confidence >= policy.confidenceThreshold) {
                violations.push({
                    category: detected.category,
                    severity: rule.severity,
                    reason: this.generateViolationReason(detected, rule),
                });
            }
        }
        return violations;
    }
    /**
     * Generate a human-readable reason for a violation.
     */
    generateViolationReason(detected, rule) {
        const categoryName = detected.category.replace(/_/g, ' ').toLowerCase();
        const confidence = Math.round(detected.confidence * 100);
        let reason = `Detected ${categoryName} with ${confidence}% confidence.`;
        if (detected.matchedPatterns && detected.matchedPatterns.length > 0) {
            reason += ` Matched patterns: "${detected.matchedPatterns.slice(0, 3).join('", "')}"`;
        }
        if (detected.matchedKeywords && detected.matchedKeywords.length > 0) {
            reason += ` Keywords found: ${detected.matchedKeywords.slice(0, 3).join(', ')}`;
        }
        return reason;
    }
    /**
     * Get the highest severity from a list of violations.
     */
    getHighestSeverity(violations) {
        const order = {
            [Severity.LOW]: 0,
            [Severity.MEDIUM]: 1,
            [Severity.HIGH]: 2,
            [Severity.CRITICAL]: 3,
        };
        let highest = Severity.LOW;
        for (const v of violations) {
            if (order[v.severity] > order[highest]) {
                highest = v.severity;
            }
        }
        return highest;
    }
    /**
     * Generate an explanation for a blocked action.
     */
    generateBlockExplanation(violations) {
        const categories = violations.map(v => v.category.replace(/_/g, ' ')).join(', ');
        return `Action blocked due to policy violations in the following categories: ${categories}. ` +
            `This action has been logged for audit purposes. ` +
            violations.map(v => v.reason).join(' ');
    }
    /**
     * Generate an explanation for an action requiring review.
     */
    generateReviewExplanation(violations) {
        const categories = violations.map(v => v.category.replace(/_/g, ' ')).join(', ');
        return `Action requires human review due to potential policy violations: ${categories}. ` +
            `The action has been queued for manual approval.`;
    }
}
// ============================================================================
// Audit Logger
// ============================================================================
/**
 * AuditLogger - Logs all ethical decisions for compliance and review.
 */
export class EthicsAuditLogger {
    logs = [];
    maxInMemoryLogs = 10000;
    persistCallback;
    /**
     * Set a callback for persisting audit logs to external storage.
     */
    setPersistCallback(callback) {
        this.persistCallback = callback;
    }
    /**
     * Log an ethical evaluation result.
     */
    async log(action, response) {
        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            actionId: action.id,
            userId: action.userId,
            organizationId: action.organizationId,
            result: response.result,
            categories: response.violations.map(v => v.category),
            severity: response.classification.overallRisk,
            explanation: response.explanation,
            contentHash: this.hashContent(action.content),
            contentSnippet: this.truncateContent(action.content),
            policyId: response.policyId,
            policyVersion: response.policyVersion,
            reviewed: false,
        };
        // Store in memory
        this.logs.push(entry);
        // Trim old logs if exceeding limit
        if (this.logs.length > this.maxInMemoryLogs) {
            this.logs.splice(0, this.logs.length - this.maxInMemoryLogs);
        }
        // Persist to external storage if configured
        if (this.persistCallback) {
            try {
                await this.persistCallback(entry);
            }
            catch (error) {
                console.error('[EthicsAuditLogger] Failed to persist audit log:', error);
            }
        }
        // Log to console for visibility
        const logLevel = response.result === EvaluationResult.BLOCKED ? 'warn' : 'info';
        console[logLevel](`[EthicsAudit] ${response.result.toUpperCase()} - User: ${action.userId.substring(0, 8)}... ` +
            `Categories: ${entry.categories.join(', ') || 'none'} - ${response.explanation.substring(0, 100)}`);
        return entry.id;
    }
    /**
     * Get audit logs with optional filtering.
     */
    query(options) {
        let filtered = [...this.logs];
        if (options.userId) {
            filtered = filtered.filter(e => e.userId === options.userId);
        }
        if (options.organizationId) {
            filtered = filtered.filter(e => e.organizationId === options.organizationId);
        }
        if (options.result) {
            filtered = filtered.filter(e => e.result === options.result);
        }
        if (options.category) {
            filtered = filtered.filter(e => e.categories.includes(options.category));
        }
        if (options.startDate) {
            filtered = filtered.filter(e => e.timestamp >= options.startDate);
        }
        if (options.endDate) {
            filtered = filtered.filter(e => e.timestamp <= options.endDate);
        }
        if (options.reviewed !== undefined) {
            filtered = filtered.filter(e => e.reviewed === options.reviewed);
        }
        // Sort by timestamp descending
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply pagination
        const offset = options.offset || 0;
        const limit = Math.min(options.limit || 100, 1000);
        return filtered.slice(offset, offset + limit);
    }
    /**
     * Mark an audit entry as reviewed.
     */
    markReviewed(entryId, reviewedBy, notes) {
        const entry = this.logs.find(e => e.id === entryId);
        if (!entry) {
            return false;
        }
        entry.reviewed = true;
        entry.reviewedBy = reviewedBy;
        entry.reviewNotes = notes;
        return true;
    }
    /**
     * Get statistics for audit logs.
     */
    getStats(days = 30) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const recentLogs = this.logs.filter(e => e.timestamp >= cutoff);
        const byCategory = {};
        const bySeverity = {};
        let blocked = 0;
        let allowed = 0;
        let requiresReview = 0;
        for (const entry of recentLogs) {
            switch (entry.result) {
                case EvaluationResult.BLOCKED:
                    blocked++;
                    break;
                case EvaluationResult.ALLOWED:
                    allowed++;
                    break;
                case EvaluationResult.REQUIRES_REVIEW:
                    requiresReview++;
                    break;
            }
            for (const category of entry.categories) {
                byCategory[category] = (byCategory[category] || 0) + 1;
            }
            bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
        }
        return {
            totalEvaluations: recentLogs.length,
            blocked,
            allowed,
            requiresReview,
            byCategory,
            bySeverity,
        };
    }
    /**
     * Export logs for compliance reporting.
     */
    exportLogs(startDate, endDate, format = 'json') {
        const logs = this.query({ startDate, endDate, limit: 10000 });
        if (format === 'csv') {
            const headers = [
                'id', 'timestamp', 'actionId', 'userId', 'organizationId',
                'result', 'categories', 'severity', 'explanation', 'policyId',
                'reviewed', 'reviewedBy', 'reviewNotes'
            ];
            const rows = logs.map(entry => [
                entry.id,
                entry.timestamp.toISOString(),
                entry.actionId,
                entry.userId,
                entry.organizationId || '',
                entry.result,
                entry.categories.join(';'),
                entry.severity,
                `"${entry.explanation.replace(/"/g, '""')}"`,
                entry.policyId,
                entry.reviewed.toString(),
                entry.reviewedBy || '',
                entry.reviewNotes || '',
            ]);
            return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        }
        return JSON.stringify(logs, null, 2);
    }
    /**
     * Hash content for privacy-preserving storage.
     */
    hashContent(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    /**
     * Truncate content for snippet storage.
     */
    truncateContent(content, maxLength = 200) {
        if (content.length <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength) + '...';
    }
}
// ============================================================================
// Moral Compass (Main Class)
// ============================================================================
/**
 * MoralCompass - The main AI Ethics Layer for Astra.
 *
 * Evaluates all AI actions against ethical guidelines before execution,
 * blocks harmful requests, provides transparency, and maintains audit logs.
 */
export class MoralCompass extends EventEmitter {
    static instance;
    classifier;
    evaluator;
    auditLogger;
    policies = new Map();
    defaultPolicy;
    enabled = true;
    constructor() {
        super();
        this.classifier = new ContentClassifier();
        this.evaluator = new ActionEvaluator(this.classifier);
        this.auditLogger = new EthicsAuditLogger();
        this.defaultPolicy = this.createDefaultPolicy();
        this.policies.set(this.defaultPolicy.id, this.defaultPolicy);
    }
    /**
     * Get the singleton instance of MoralCompass.
     */
    static getInstance() {
        if (!MoralCompass.instance) {
            MoralCompass.instance = new MoralCompass();
        }
        return MoralCompass.instance;
    }
    /**
     * Create the default ethics policy.
     */
    createDefaultPolicy() {
        return {
            id: 'default',
            name: 'Astra Default Ethics Policy',
            organizationId: 'system',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date(),
            enabled: true,
            strictMode: false,
            defaultAction: EvaluationResult.ALLOWED,
            rules: this.createDefaultRules(),
            confidenceThreshold: 0.5,
            maxViolationsBeforeBlock: 3,
        };
    }
    /**
     * Create default harm rules.
     */
    createDefaultRules() {
        return [
            // Critical - Always block
            {
                category: HarmCategory.CHILD_SAFETY,
                enabled: true,
                severity: Severity.CRITICAL,
                action: EvaluationResult.BLOCKED,
            },
            {
                category: HarmCategory.VIOLENCE,
                enabled: true,
                severity: Severity.CRITICAL,
                action: EvaluationResult.BLOCKED,
            },
            {
                category: HarmCategory.WEAPONS,
                enabled: true,
                severity: Severity.CRITICAL,
                action: EvaluationResult.BLOCKED,
            },
            // High severity
            {
                category: HarmCategory.ILLEGAL_ACTIVITIES,
                enabled: true,
                severity: Severity.HIGH,
                action: EvaluationResult.BLOCKED,
            },
            {
                category: HarmCategory.FRAUD,
                enabled: true,
                severity: Severity.HIGH,
                action: EvaluationResult.BLOCKED,
            },
            {
                category: HarmCategory.HACKING,
                enabled: true,
                severity: Severity.HIGH,
                action: EvaluationResult.BLOCKED,
            },
            {
                category: HarmCategory.HARASSMENT_HATE_SPEECH,
                enabled: true,
                severity: Severity.HIGH,
                action: EvaluationResult.BLOCKED,
            },
            {
                category: HarmCategory.SELF_HARM,
                enabled: true,
                severity: Severity.HIGH,
                action: EvaluationResult.BLOCKED,
            },
            // Medium severity - Require review
            {
                category: HarmCategory.PRIVACY_VIOLATIONS,
                enabled: true,
                severity: Severity.MEDIUM,
                action: EvaluationResult.REQUIRES_REVIEW,
            },
            {
                category: HarmCategory.MISINFORMATION,
                enabled: true,
                severity: Severity.MEDIUM,
                action: EvaluationResult.REQUIRES_REVIEW,
            },
            {
                category: HarmCategory.FINANCIAL_MANIPULATION,
                enabled: true,
                severity: Severity.MEDIUM,
                action: EvaluationResult.REQUIRES_REVIEW,
            },
            {
                category: HarmCategory.BOT_ARMY_SPAM,
                enabled: true,
                severity: Severity.MEDIUM,
                action: EvaluationResult.BLOCKED,
            },
        ];
    }
    /**
     * Enable or disable the ethics layer.
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[MoralCompass] Ethics layer ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Check if the ethics layer is enabled.
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Evaluate a proposed action against ethical guidelines.
     * This is the main entry point for the ethics layer.
     */
    async evaluate(content, actionType, userId, options) {
        // If disabled, allow all actions (but still log)
        if (!this.enabled) {
            const bypassResponse = {
                actionId: crypto.randomUUID(),
                result: EvaluationResult.ALLOWED,
                timestamp: new Date(),
                classification: {
                    categories: [],
                    overallRisk: Severity.LOW,
                    flags: ['ETHICS_DISABLED'],
                },
                violations: [],
                explanation: 'Ethics layer is disabled. Action permitted without evaluation.',
                appealable: false,
                policyId: 'none',
                policyVersion: 'none',
                processingTimeMs: 0,
                evaluatorVersion: '1.0.0',
            };
            // Still emit event for monitoring
            this.emit('evaluation', {
                action: { content: '[redacted]', type: actionType, userId },
                response: bypassResponse
            });
            return bypassResponse;
        }
        // Create the proposed action
        const action = {
            id: crypto.randomUUID(),
            type: actionType,
            userId,
            organizationId: options?.organizationId,
            timestamp: new Date(),
            content,
            metadata: options?.metadata,
            context: options?.context,
            source: options?.source || {
                platform: 'unknown',
            },
        };
        // Get the appropriate policy
        const policy = this.getPolicy(options?.organizationId);
        // Evaluate the action
        const response = await this.evaluator.evaluate(action, policy);
        // Log the decision
        await this.auditLogger.log(action, response);
        // Emit events for monitoring and integration
        this.emit('evaluation', { action, response });
        if (response.result === EvaluationResult.BLOCKED) {
            this.emit('blocked', { action, response });
        }
        else if (response.result === EvaluationResult.REQUIRES_REVIEW) {
            this.emit('reviewRequired', { action, response });
        }
        return response;
    }
    /**
     * Quick check if content is likely harmful (without full evaluation).
     */
    quickCheck(content) {
        const classification = this.classifier.classify(content);
        const harmfulCategories = classification.categories
            .filter(c => c.confidence >= 0.5)
            .map(c => c.category);
        return {
            isHarmful: harmfulCategories.length > 0,
            categories: harmfulCategories,
        };
    }
    /**
     * Register a custom ethics policy for an organization.
     */
    registerPolicy(policy) {
        this.policies.set(policy.organizationId, policy);
        console.log(`[MoralCompass] Registered policy "${policy.name}" for organization ${policy.organizationId}`);
        this.emit('policyRegistered', policy);
    }
    /**
     * Update an existing policy.
     */
    updatePolicy(organizationId, updates) {
        const existing = this.policies.get(organizationId);
        if (!existing) {
            return false;
        }
        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date(),
            version: this.incrementVersion(existing.version),
        };
        this.policies.set(organizationId, updated);
        console.log(`[MoralCompass] Updated policy for organization ${organizationId} to version ${updated.version}`);
        this.emit('policyUpdated', updated);
        return true;
    }
    /**
     * Get the policy for an organization, falling back to default.
     */
    getPolicy(organizationId) {
        if (organizationId && this.policies.has(organizationId)) {
            return this.policies.get(organizationId);
        }
        return this.defaultPolicy;
    }
    /**
     * List all registered policies.
     */
    listPolicies() {
        return Array.from(this.policies.values());
    }
    /**
     * Remove a policy (revert to default).
     */
    removePolicy(organizationId) {
        if (organizationId === 'system') {
            console.warn('[MoralCompass] Cannot remove system default policy');
            return false;
        }
        return this.policies.delete(organizationId);
    }
    /**
     * Set the audit logger's persist callback for external storage.
     */
    setAuditPersistCallback(callback) {
        this.auditLogger.setPersistCallback(callback);
    }
    /**
     * Query audit logs.
     */
    queryAuditLogs(options) {
        return this.auditLogger.query(options);
    }
    /**
     * Get audit statistics.
     */
    getAuditStats(days) {
        return this.auditLogger.getStats(days);
    }
    /**
     * Export audit logs.
     */
    exportAuditLogs(startDate, endDate, format) {
        return this.auditLogger.exportLogs(startDate, endDate, format);
    }
    /**
     * Mark an audit entry as reviewed.
     */
    markAuditReviewed(entryId, reviewedBy, notes) {
        return this.auditLogger.markReviewed(entryId, reviewedBy, notes);
    }
    /**
     * Get the content classifier for direct access.
     */
    getClassifier() {
        return this.classifier;
    }
    /**
     * Get the action evaluator for direct access.
     */
    getEvaluator() {
        return this.evaluator;
    }
    /**
     * Get the audit logger for direct access.
     */
    getAuditLogger() {
        return this.auditLogger;
    }
    /**
     * Increment a semantic version string.
     */
    incrementVersion(version) {
        const parts = version.split('.').map(Number);
        parts[2] = (parts[2] || 0) + 1;
        return parts.join('.');
    }
    // ========================================================================
    // Integration Hooks for Orchestrator
    // ========================================================================
    /**
     * Middleware function for message processing pipelines.
     * Returns a function that can be used in message handlers.
     */
    createMiddleware() {
        return async (content, userId, next) => {
            const response = await this.evaluate(content, ActionType.TEXT_GENERATION, userId);
            if (response.result === EvaluationResult.BLOCKED) {
                return { allowed: false, response };
            }
            await next();
            return { allowed: true, response };
        };
    }
    /**
     * Hook for pre-action validation in the orchestrator.
     */
    async validateAction(content, actionType, userId, organizationId) {
        const response = await this.evaluate(content, actionType, userId, { organizationId });
        if (response.result === EvaluationResult.BLOCKED) {
            return {
                valid: false,
                reason: response.explanation,
                response,
            };
        }
        if (response.result === EvaluationResult.REQUIRES_REVIEW) {
            return {
                valid: false,
                reason: 'This action requires human review before execution.',
                response,
            };
        }
        return { valid: true, response };
    }
    /**
     * Register event handlers for orchestrator integration.
     */
    registerOrchestratorHooks(orchestrator) {
        // Example integration - the orchestrator should call evaluate() before actions
        console.log('[MoralCompass] Registered hooks with orchestrator');
        // Emit ready event
        this.emit('ready');
    }
}
// ============================================================================
// Factory Functions and Exports
// ============================================================================
/**
 * Get the MoralCompass singleton instance.
 */
export function getMoralCompass() {
    return MoralCompass.getInstance();
}
/**
 * Create a new ethics policy with default values.
 */
export function createEthicsPolicy(organizationId, name, overrides) {
    const compass = getMoralCompass();
    const defaultPolicy = compass.getPolicy();
    return {
        id: crypto.randomUUID(),
        name,
        organizationId,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: overrides?.enabled ?? true,
        strictMode: overrides?.strictMode ?? false,
        defaultAction: overrides?.defaultAction ?? EvaluationResult.ALLOWED,
        rules: overrides?.rules ?? [...defaultPolicy.rules],
        confidenceThreshold: overrides?.confidenceThreshold ?? 0.5,
        maxViolationsBeforeBlock: overrides?.maxViolationsBeforeBlock ?? 3,
        allowedDomains: overrides?.allowedDomains,
        blockedDomains: overrides?.blockedDomains,
        allowedUsers: overrides?.allowedUsers,
        exemptActions: overrides?.exemptActions,
        preEvaluationHook: overrides?.preEvaluationHook,
        postEvaluationHook: overrides?.postEvaluationHook,
    };
}
// Default export
export default MoralCompass;
//# sourceMappingURL=MoralCompass.js.map