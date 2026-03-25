/**
 * VisualDebugger.ts - Visual Debugging and Self-Healing Feature for Astra
 *
 * This module provides comprehensive visual automation debugging with self-healing capabilities:
 * - Detects when visual automation fails (element not found, click missed, etc.)
 * - Automatically diagnoses failures by analyzing current page state
 * - Attempts self-healing by finding alternative selectors or approaches
 * - Learns from failures to improve future automation
 * - Generates detailed visual debugging reports with annotated screenshots
 */
import { EventEmitter } from 'events';
import type { Page } from 'playwright';
import type { VisualAction } from '../workers/VisualAgent.js';
/** Types of automation failures that can occur */
export type FailureType = 'element_not_found' | 'element_not_visible' | 'element_not_interactable' | 'click_missed' | 'timeout' | 'navigation_failed' | 'selector_stale' | 'assertion_failed' | 'screenshot_failed' | 'unknown';
/** Severity levels for failures */
export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';
/** Represents a detected automation failure */
export interface AutomationFailure {
    id: string;
    type: FailureType;
    severity: FailureSeverity;
    timestamp: number;
    selector?: string;
    action?: VisualAction;
    errorMessage: string;
    stackTrace?: string;
    screenshotPath?: string;
    pageUrl?: string;
    pageTitle?: string;
    htmlSnapshot?: string;
    metadata?: Record<string, unknown>;
}
/** Diagnosis result from analyzing a failure */
export interface FailureDiagnosis {
    failureId: string;
    rootCause: string;
    possibleReasons: string[];
    suggestedFixes: SuggestedFix[];
    confidence: number;
    pageStateAnalysis: PageStateAnalysis;
    timestamp: number;
}
/** Analysis of the page state when failure occurred */
export interface PageStateAnalysis {
    isPageLoaded: boolean;
    hasOverlays: boolean;
    hasLoadingIndicators: boolean;
    viewportSize: {
        width: number;
        height: number;
    };
    scrollPosition: {
        x: number;
        y: number;
    };
    visibleElements: ElementInfo[];
    hiddenElements: ElementInfo[];
    interactableElements: ElementInfo[];
    domChanges?: DOMChange[];
}
/** Information about a DOM element */
export interface ElementInfo {
    selector: string;
    tagName: string;
    id?: string;
    className?: string;
    text?: string;
    isVisible: boolean;
    isInteractable: boolean;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    attributes: Record<string, string>;
}
/** Tracked DOM change */
export interface DOMChange {
    type: 'added' | 'removed' | 'modified' | 'attribute_changed';
    selector: string;
    timestamp: number;
    details?: string;
}
/** Suggested fix for a failure */
export interface SuggestedFix {
    type: 'alternative_selector' | 'wait_strategy' | 'scroll_into_view' | 'retry' | 'force_click' | 'javascript_click' | 'hover_first';
    description: string;
    selector?: string;
    waitTime?: number;
    confidence: number;
    code?: string;
}
/** Healing attempt result */
export interface HealingAttempt {
    id: string;
    failureId: string;
    strategy: SuggestedFix;
    success: boolean;
    timestamp: number;
    duration: number;
    newSelector?: string;
    errorIfFailed?: string;
}
/** Learned pattern from failures */
export interface FailurePattern {
    id: string;
    patternType: string;
    selector: string;
    alternativeSelectors: string[];
    successfulStrategies: SuggestedFix[];
    failureCount: number;
    healingSuccessRate: number;
    lastOccurrence: number;
    metadata?: Record<string, unknown>;
}
/** Debug report for a failure */
export interface DebugReport {
    id: string;
    failure: AutomationFailure;
    diagnosis: FailureDiagnosis;
    healingAttempts: HealingAttempt[];
    wasHealed: boolean;
    finalSelector?: string;
    annotatedScreenshotPath?: string;
    htmlReportPath?: string;
    recommendations: string[];
    generatedAt: number;
}
/** Configuration for the Visual Debugger */
export interface VisualDebuggerConfig {
    screenshotDir: string;
    reportDir: string;
    maxHealingAttempts: number;
    healingTimeout: number;
    enableLearning: boolean;
    patternDbPath: string;
    screenshotOnFailure: boolean;
    htmlSnapshotOnFailure: boolean;
    maxStoredPatterns: number;
    minConfidenceForHealing: number;
}
/** Selector generation strategy */
export interface SelectorStrategy {
    name: string;
    priority: number;
    generate: (element: ElementInfo) => string[];
}
export declare class FailureDetector extends EventEmitter {
    private activeMonitoring;
    private page;
    private domObserverScript;
    private domChanges;
    constructor();
    /**
     * Create the DOM mutation observer script
     */
    private createDOMObserverScript;
    /**
     * Start monitoring a page for failures
     */
    startMonitoring(page: Page): Promise<void>;
    /**
     * Stop monitoring the page
     */
    stopMonitoring(): void;
    /**
     * Detect failure from an error
     */
    detectFailure(error: Error, action?: VisualAction, selector?: string): AutomationFailure;
    /**
     * Classify error type
     */
    private classifyError;
    /**
     * Calculate failure severity
     */
    private calculateSeverity;
    /**
     * Get recent DOM changes
     */
    getDOMChanges(): Promise<DOMChange[]>;
    /**
     * Check if page has loading indicators
     */
    hasLoadingIndicators(): Promise<boolean>;
    /**
     * Check if page has overlays
     */
    hasOverlays(): Promise<boolean>;
    /**
     * Check if monitoring is active
     */
    isMonitoring(): boolean;
}
export declare class SelectorLearner extends EventEmitter {
    private strategies;
    private learnedSelectors;
    constructor();
    /**
     * Initialize selector generation strategies
     */
    private initializeStrategies;
    /**
     * Generate alternative selectors for an element
     */
    generateAlternatives(element: ElementInfo): string[];
    /**
     * Learn from a successful selector resolution
     */
    learn(originalSelector: string, workingSelector: string): void;
    /**
     * Get learned alternatives for a selector
     */
    getLearnedAlternatives(selector: string): string[];
    /**
     * Analyze an element on the page to get its info
     */
    analyzeElement(page: Page, selector: string): Promise<ElementInfo | null>;
    /**
     * Find similar elements on the page
     */
    findSimilarElements(page: Page, element: ElementInfo, limit?: number): Promise<ElementInfo[]>;
    /**
     * Export learned selectors
     */
    exportLearned(): Record<string, string[]>;
    /**
     * Import learned selectors
     */
    importLearned(data: Record<string, string[]>): void;
}
export declare class VisualDiffAnalyzer extends EventEmitter {
    private tempDir;
    constructor(tempDir?: string);
    /**
     * Ensure temp directory exists
     */
    private ensureDirectory;
    /**
     * Capture current screenshot
     */
    captureScreenshot(filename?: string): Promise<string>;
    /**
     * Capture page screenshot using Playwright
     */
    capturePageScreenshot(page: Page, filename?: string): Promise<string>;
    /**
     * Compare two screenshots and return difference metrics
     * Note: This is a simplified comparison. In production, you would use
     * libraries like pixelmatch or resemble.js for proper image diffing.
     */
    compareScreenshots(baselinePath: string, currentPath: string): Promise<{
        isDifferent: boolean;
        diffPercentage: number;
        diffRegions: Array<{
            x: number;
            y: number;
            width: number;
            height: number;
        }>;
        diffImagePath?: string;
    }>;
    /**
     * Capture element screenshot
     */
    captureElementScreenshot(page: Page, selector: string, filename?: string): Promise<string | null>;
    /**
     * Get viewport state
     */
    getViewportState(page: Page): Promise<{
        size: {
            width: number;
            height: number;
        };
        scrollPosition: {
            x: number;
            y: number;
        };
        documentSize: {
            width: number;
            height: number;
        };
    }>;
    /**
     * Cleanup temp files
     */
    cleanup(): void;
}
export declare class SelfHealingEngine extends EventEmitter {
    private selectorLearner;
    private maxAttempts;
    private timeout;
    private minConfidence;
    constructor(options: {
        selectorLearner: SelectorLearner;
        maxAttempts?: number;
        timeout?: number;
        minConfidence?: number;
    });
    /**
     * Attempt to heal a failure
     */
    heal(page: Page, failure: AutomationFailure, diagnosis: FailureDiagnosis): Promise<HealingAttempt[]>;
    /**
     * Attempt a specific fix strategy
     */
    private attemptFix;
    /**
     * Try an alternative selector
     */
    private tryAlternativeSelector;
    /**
     * Try waiting for element
     */
    private tryWaitStrategy;
    /**
     * Try scrolling element into view
     */
    private tryScrollIntoView;
    /**
     * Try force clicking
     */
    private tryForceClick;
    /**
     * Try JavaScript click
     */
    private tryJavaScriptClick;
    /**
     * Try hovering first then clicking
     */
    private tryHoverFirst;
    /**
     * Try simple retry
     */
    private tryRetry;
    /**
     * Generate suggested fixes for a failure
     */
    generateFixes(page: Page, failure: AutomationFailure, pageState: PageStateAnalysis): Promise<SuggestedFix[]>;
}
export declare class FailurePatternDB extends EventEmitter {
    private patterns;
    private dbPath;
    private maxPatterns;
    private dirty;
    private saveDebounceTimer;
    constructor(dbPath: string, maxPatterns?: number);
    /**
     * Load patterns from disk
     */
    private load;
    /**
     * Save patterns to disk (debounced)
     */
    private scheduleSave;
    /**
     * Force save to disk
     */
    save(): void;
    /**
     * Record a failure and its healing result
     */
    recordFailure(failure: AutomationFailure, healingAttempts: HealingAttempt[], wasHealed: boolean): void;
    /**
     * Get pattern for a selector
     */
    getPattern(failureType: FailureType, selector: string): FailurePattern | undefined;
    /**
     * Get all patterns for a selector (any failure type)
     */
    getPatternsForSelector(selector: string): FailurePattern[];
    /**
     * Get successful strategies for a failure type
     */
    getSuccessfulStrategies(failureType: FailureType): SuggestedFix[];
    /**
     * Get alternative selectors from patterns
     */
    getAlternativeSelectors(selector: string): string[];
    /**
     * Enforce maximum pattern count
     */
    private enforceMaxPatterns;
    /**
     * Get statistics
     */
    getStats(): {
        totalPatterns: number;
        averageSuccessRate: number;
        mostCommonFailures: Array<{
            type: string;
            count: number;
        }>;
    };
    /**
     * Clear all patterns
     */
    clear(): void;
    /**
     * Close and cleanup
     */
    close(): void;
}
export declare class DebugReportGenerator extends EventEmitter {
    private reportDir;
    private visualDiffAnalyzer;
    constructor(reportDir: string, visualDiffAnalyzer: VisualDiffAnalyzer);
    /**
     * Ensure report directory exists
     */
    private ensureDirectory;
    /**
     * Generate a comprehensive debug report
     */
    generateReport(failure: AutomationFailure, diagnosis: FailureDiagnosis, healingAttempts: HealingAttempt[], page?: Page): Promise<DebugReport>;
    /**
     * Capture annotated screenshot highlighting the failed element
     */
    private captureAnnotatedScreenshot;
    /**
     * Generate recommendations based on failure analysis
     */
    private generateRecommendations;
    /**
     * Generate HTML report
     */
    private generateHTMLReport;
    /**
     * Get all reports
     */
    listReports(): string[];
    /**
     * Clean old reports
     */
    cleanOldReports(maxAgeDays?: number): number;
}
export declare class VisualDebugger extends EventEmitter {
    private config;
    private failureDetector;
    private selectorLearner;
    private selfHealingEngine;
    private visualDiffAnalyzer;
    private failurePatternDB;
    private reportGenerator;
    private activePage;
    private isInitialized;
    constructor(config?: Partial<VisualDebuggerConfig>);
    /**
     * Ensure required directories exist
     */
    private ensureDirectories;
    /**
     * Setup internal event listeners
     */
    private setupEventListeners;
    /**
     * Initialize the visual debugger with a page
     */
    initialize(page: Page): Promise<void>;
    /**
     * Diagnose a failure and analyze page state
     */
    diagnose(failure: AutomationFailure): Promise<FailureDiagnosis>;
    /**
     * Analyze current page state
     */
    private analyzePageState;
    /**
     * Get categorized elements from the page
     */
    private getElementCategories;
    /**
     * Determine root cause of failure
     */
    private determineRootCause;
    /**
     * Generate possible reasons for the failure
     */
    private generatePossibleReasons;
    /**
     * Calculate confidence in the diagnosis
     */
    private calculateDiagnosisConfidence;
    /**
     * Attempt to heal a failure
     */
    heal(failure: AutomationFailure, diagnosis?: FailureDiagnosis): Promise<{
        success: boolean;
        attempts: HealingAttempt[];
        finalSelector?: string;
    }>;
    /**
     * Main entry point: detect, diagnose, and heal a failure
     */
    handleError(error: Error, action?: VisualAction, selector?: string): Promise<{
        failure: AutomationFailure;
        diagnosis: FailureDiagnosis;
        healed: boolean;
        healingAttempts: HealingAttempt[];
        report: DebugReport;
    }>;
    /**
     * Wrap an action with automatic error handling and healing
     */
    executeWithHealing<T>(action: () => Promise<T>, selector?: string, maxRetries?: number): Promise<T>;
    /**
     * Get the failure detector
     */
    getFailureDetector(): FailureDetector;
    /**
     * Get the selector learner
     */
    getSelectorLearner(): SelectorLearner;
    /**
     * Get the self-healing engine
     */
    getSelfHealingEngine(): SelfHealingEngine;
    /**
     * Get the visual diff analyzer
     */
    getVisualDiffAnalyzer(): VisualDiffAnalyzer;
    /**
     * Get the failure pattern database
     */
    getPatternDB(): FailurePatternDB;
    /**
     * Get the report generator
     */
    getReportGenerator(): DebugReportGenerator;
    /**
     * Get statistics
     */
    getStats(): {
        patternStats: ReturnType<FailurePatternDB['getStats']>;
        learnedSelectors: Record<string, string[]>;
        reportsGenerated: number;
    };
    /**
     * Export learned data
     */
    exportLearning(): {
        selectors: Record<string, string[]>;
        patternDbPath: string;
    };
    /**
     * Import learned data
     */
    importLearning(data: {
        selectors: Record<string, string[]>;
    }): void;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Check if initialized
     */
    isReady(): boolean;
}
/**
 * Hook to integrate VisualDebugger with existing VisualAgent
 */
export declare function createVisualAgentDebugHook(debugger_: VisualDebugger): {
    /**
     * Wrap a VisualAgent action with debugging and healing
     */
    wrapAction: <T>(action: () => Promise<T>, visualAction?: VisualAction, selector?: string) => Promise<T>;
    /**
     * Execute with automatic healing retries
     */
    executeWithHealing: <T>(action: () => Promise<T>, selector?: string) => Promise<T>;
    /**
     * Get debug report for last failure
     */
    getLastReport: () => string;
    /**
     * Get learning statistics
     */
    getStats: () => {
        patternStats: ReturnType<FailurePatternDB["getStats"]>;
        learnedSelectors: Record<string, string[]>;
        reportsGenerated: number;
    };
};
export { VisualDebugger, FailureDetector, SelectorLearner, SelfHealingEngine, VisualDiffAnalyzer, FailurePatternDB, DebugReportGenerator, createVisualAgentDebugHook };
export default VisualDebugger;
//# sourceMappingURL=VisualDebugger.d.ts.map