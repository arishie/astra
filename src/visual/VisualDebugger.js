// @ts-nocheck
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
import { chromium } from 'playwright';
import screenshot from 'screenshot-desktop';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// ============================================================================
// FailureDetector - Identifies automation failures
// ============================================================================
export class FailureDetector extends EventEmitter {
    activeMonitoring = false;
    page = null;
    domObserverScript;
    domChanges = [];
    constructor() {
        super();
        this.domObserverScript = this.createDOMObserverScript();
    }
    /**
     * Create the DOM mutation observer script
     */
    createDOMObserverScript() {
        return `
            window.__astraDOMChanges = window.__astraDOMChanges || [];

            if (!window.__astraDOMObserver) {
                window.__astraDOMObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        const change = {
                            type: mutation.type === 'childList'
                                ? (mutation.addedNodes.length > 0 ? 'added' : 'removed')
                                : 'modified',
                            timestamp: Date.now(),
                            target: mutation.target.nodeName,
                            details: mutation.type
                        };
                        window.__astraDOMChanges.push(change);

                        // Keep only last 100 changes
                        if (window.__astraDOMChanges.length > 100) {
                            window.__astraDOMChanges.shift();
                        }
                    });
                });

                window.__astraDOMObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeOldValue: true
                });
            }
        `;
    }
    /**
     * Start monitoring a page for failures
     */
    async startMonitoring(page) {
        this.page = page;
        this.activeMonitoring = true;
        this.domChanges = [];
        // Inject DOM observer
        await page.evaluate(this.domObserverScript);
        // Listen for page errors
        page.on('pageerror', (error) => {
            this.emit('pageError', error);
        });
        // Listen for console errors
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.emit('consoleError', msg.text());
            }
        });
        // Listen for request failures
        page.on('requestfailed', (request) => {
            this.emit('requestFailed', {
                url: request.url(),
                failure: request.failure()?.errorText
            });
        });
        console.log('[FailureDetector] Started monitoring page');
        this.emit('monitoringStarted');
    }
    /**
     * Stop monitoring the page
     */
    stopMonitoring() {
        this.activeMonitoring = false;
        this.page = null;
        console.log('[FailureDetector] Stopped monitoring');
        this.emit('monitoringStopped');
    }
    /**
     * Detect failure from an error
     */
    detectFailure(error, action, selector) {
        const failureType = this.classifyError(error);
        const severity = this.calculateSeverity(failureType, action);
        const failure = {
            id: uuidv4(),
            type: failureType,
            severity,
            timestamp: Date.now(),
            selector,
            action,
            errorMessage: error.message,
            stackTrace: error.stack,
            pageUrl: this.page ? this.page.url() : undefined,
            metadata: {
                errorName: error.name,
                originalError: error.toString()
            }
        };
        console.log(`[FailureDetector] Detected failure: ${failureType} - ${error.message}`);
        this.emit('failureDetected', failure);
        return failure;
    }
    /**
     * Classify error type
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();
        if (message.includes('element not found') || message.includes('no element matches')) {
            return 'element_not_found';
        }
        if (message.includes('not visible') || message.includes('hidden')) {
            return 'element_not_visible';
        }
        if (message.includes('not interactable') || message.includes('intercepted')) {
            return 'element_not_interactable';
        }
        if (message.includes('click') && (message.includes('missed') || message.includes('failed'))) {
            return 'click_missed';
        }
        if (name.includes('timeout') || message.includes('timeout')) {
            return 'timeout';
        }
        if (message.includes('navigation') || message.includes('navigate')) {
            return 'navigation_failed';
        }
        if (message.includes('stale') || message.includes('detached')) {
            return 'selector_stale';
        }
        if (message.includes('assert') || message.includes('expect')) {
            return 'assertion_failed';
        }
        if (message.includes('screenshot')) {
            return 'screenshot_failed';
        }
        return 'unknown';
    }
    /**
     * Calculate failure severity
     */
    calculateSeverity(type, action) {
        // Critical failures that block execution
        if (type === 'navigation_failed') {
            return 'critical';
        }
        // High severity - main action failures
        if (type === 'element_not_found' || type === 'element_not_interactable') {
            return 'high';
        }
        // Medium severity - recoverable failures
        if (type === 'timeout' || type === 'click_missed' || type === 'element_not_visible') {
            return 'medium';
        }
        // Low severity - minor issues
        if (type === 'assertion_failed' || type === 'screenshot_failed') {
            return 'low';
        }
        return 'medium';
    }
    /**
     * Get recent DOM changes
     */
    async getDOMChanges() {
        if (!this.page || !this.activeMonitoring) {
            return this.domChanges;
        }
        try {
            const changes = await this.page.evaluate(() => {
                return window.__astraDOMChanges || [];
            });
            this.domChanges = changes;
            return changes;
        }
        catch {
            return this.domChanges;
        }
    }
    /**
     * Check if page has loading indicators
     */
    async hasLoadingIndicators() {
        if (!this.page)
            return false;
        try {
            return await this.page.evaluate(() => {
                const loadingSelectors = [
                    '[class*="loading"]',
                    '[class*="spinner"]',
                    '[class*="loader"]',
                    '[role="progressbar"]',
                    '.loading',
                    '.spinner',
                    '#loading'
                ];
                for (const selector of loadingSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            return true;
                        }
                    }
                }
                return false;
            });
        }
        catch {
            return false;
        }
    }
    /**
     * Check if page has overlays
     */
    async hasOverlays() {
        if (!this.page)
            return false;
        try {
            return await this.page.evaluate(() => {
                const overlaySelectors = [
                    '[class*="modal"]',
                    '[class*="overlay"]',
                    '[class*="popup"]',
                    '[class*="dialog"]',
                    '[role="dialog"]',
                    '[role="alertdialog"]',
                    '.modal',
                    '.overlay'
                ];
                for (const selector of overlaySelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            return true;
                        }
                    }
                }
                return false;
            });
        }
        catch {
            return false;
        }
    }
    /**
     * Check if monitoring is active
     */
    isMonitoring() {
        return this.activeMonitoring;
    }
}
// ============================================================================
// SelectorLearner - Builds robust selector alternatives
// ============================================================================
export class SelectorLearner extends EventEmitter {
    strategies;
    learnedSelectors = new Map();
    constructor() {
        super();
        this.strategies = this.initializeStrategies();
    }
    /**
     * Initialize selector generation strategies
     */
    initializeStrategies() {
        return [
            {
                name: 'id',
                priority: 1,
                generate: (el) => el.id ? [`#${el.id}`] : []
            },
            {
                name: 'data-testid',
                priority: 2,
                generate: (el) => {
                    const testId = el.attributes['data-testid'];
                    return testId ? [`[data-testid="${testId}"]`] : [];
                }
            },
            {
                name: 'data-cy',
                priority: 3,
                generate: (el) => {
                    const dataCy = el.attributes['data-cy'];
                    return dataCy ? [`[data-cy="${dataCy}"]`] : [];
                }
            },
            {
                name: 'aria-label',
                priority: 4,
                generate: (el) => {
                    const ariaLabel = el.attributes['aria-label'];
                    return ariaLabel ? [`[aria-label="${ariaLabel}"]`] : [];
                }
            },
            {
                name: 'role-name',
                priority: 5,
                generate: (el) => {
                    const role = el.attributes['role'];
                    const name = el.attributes['aria-label'] || el.text;
                    if (role && name) {
                        return [`[role="${role}"][aria-label="${name}"]`];
                    }
                    return [];
                }
            },
            {
                name: 'text-content',
                priority: 6,
                generate: (el) => {
                    if (el.text && el.text.length < 50) {
                        const escapedText = el.text.replace(/"/g, '\\"');
                        return [
                            `${el.tagName.toLowerCase()}:has-text("${escapedText}")`,
                            `text="${escapedText}"`
                        ];
                    }
                    return [];
                }
            },
            {
                name: 'class-combination',
                priority: 7,
                generate: (el) => {
                    if (el.className) {
                        const classes = el.className.split(/\s+/).filter(c => c.length > 2 &&
                            !c.match(/^(ng-|js-|is-|has-)/) &&
                            !c.match(/^\d/));
                        if (classes.length > 0) {
                            const selector = classes.slice(0, 2).map(c => `.${c}`).join('');
                            return [el.tagName.toLowerCase() + selector];
                        }
                    }
                    return [];
                }
            },
            {
                name: 'tag-attributes',
                priority: 8,
                generate: (el) => {
                    const selectors = [];
                    const importantAttrs = ['name', 'type', 'placeholder', 'title', 'href', 'src'];
                    for (const attr of importantAttrs) {
                        if (el.attributes[attr]) {
                            selectors.push(`${el.tagName.toLowerCase()}[${attr}="${el.attributes[attr]}"]`);
                        }
                    }
                    return selectors;
                }
            },
            {
                name: 'xpath-text',
                priority: 9,
                generate: (el) => {
                    if (el.text && el.text.length < 30) {
                        return [`xpath=//${el.tagName.toLowerCase()}[contains(text(),"${el.text}")]`];
                    }
                    return [];
                }
            },
            {
                name: 'nth-child',
                priority: 10,
                generate: (el) => {
                    if (el.className) {
                        const primaryClass = el.className.split(/\s+/)[0];
                        if (primaryClass) {
                            return [
                                `.${primaryClass}:first-child`,
                                `.${primaryClass}:last-child`,
                                `.${primaryClass}:nth-child(1)`
                            ];
                        }
                    }
                    return [];
                }
            }
        ];
    }
    /**
     * Generate alternative selectors for an element
     */
    generateAlternatives(element) {
        const alternatives = [];
        for (const strategy of this.strategies) {
            const selectors = strategy.generate(element);
            for (const selector of selectors) {
                alternatives.push({
                    selector,
                    priority: strategy.priority
                });
            }
        }
        // Sort by priority and return unique selectors
        const sorted = alternatives
            .sort((a, b) => a.priority - b.priority)
            .map(a => a.selector);
        return [...new Set(sorted)];
    }
    /**
     * Learn from a successful selector resolution
     */
    learn(originalSelector, workingSelector) {
        const alternatives = this.learnedSelectors.get(originalSelector) || [];
        if (!alternatives.includes(workingSelector)) {
            // Add to front as most recent working selector
            alternatives.unshift(workingSelector);
            // Keep only top 5 alternatives
            if (alternatives.length > 5) {
                alternatives.pop();
            }
            this.learnedSelectors.set(originalSelector, alternatives);
            console.log(`[SelectorLearner] Learned: ${originalSelector} -> ${workingSelector}`);
            this.emit('selectorLearned', { original: originalSelector, alternative: workingSelector });
        }
    }
    /**
     * Get learned alternatives for a selector
     */
    getLearnedAlternatives(selector) {
        return this.learnedSelectors.get(selector) || [];
    }
    /**
     * Analyze an element on the page to get its info
     */
    async analyzeElement(page, selector) {
        try {
            const elementInfo = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (!element)
                    return null;
                const rect = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                const attributes = {};
                for (const attr of element.attributes) {
                    attributes[attr.name] = attr.value;
                }
                return {
                    selector: sel,
                    tagName: element.tagName,
                    id: element.id || undefined,
                    className: element.className || undefined,
                    text: element.textContent?.trim().substring(0, 100) || undefined,
                    isVisible: style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        rect.width > 0 &&
                        rect.height > 0,
                    isInteractable: !element.hasAttribute('disabled') &&
                        style.pointerEvents !== 'none',
                    boundingBox: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height
                    },
                    attributes
                };
            }, selector);
            return elementInfo;
        }
        catch (error) {
            console.error(`[SelectorLearner] Failed to analyze element: ${error}`);
            return null;
        }
    }
    /**
     * Find similar elements on the page
     */
    async findSimilarElements(page, element, limit = 5) {
        try {
            const similarElements = await page.evaluate(({ el, maxResults }) => {
                const results = [];
                const tagElements = document.getElementsByTagName(el.tagName);
                for (const elem of tagElements) {
                    if (results.length >= maxResults)
                        break;
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    const attributes = {};
                    for (const attr of elem.attributes) {
                        attributes[attr.name] = attr.value;
                    }
                    // Calculate similarity score
                    let similarity = 0;
                    if (el.className && elem.className) {
                        const originalClasses = new Set(el.className.split(/\s+/));
                        const elemClasses = elem.className.split(/\s+/);
                        for (const c of elemClasses) {
                            if (originalClasses.has(c))
                                similarity++;
                        }
                    }
                    if (el.text && elem.textContent?.includes(el.text.substring(0, 20))) {
                        similarity += 2;
                    }
                    if (similarity > 0) {
                        results.push({
                            selector: elem.id ? `#${elem.id}` :
                                elem.className ? `.${elem.className.split(/\s+/)[0]}` :
                                    el.tagName.toLowerCase(),
                            tagName: elem.tagName,
                            id: elem.id || undefined,
                            className: elem.className || undefined,
                            text: elem.textContent?.trim().substring(0, 100) || undefined,
                            isVisible: style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                rect.width > 0 &&
                                rect.height > 0,
                            isInteractable: !elem.hasAttribute('disabled') &&
                                style.pointerEvents !== 'none',
                            boundingBox: {
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height
                            },
                            attributes
                        });
                    }
                }
                return results;
            }, { el: element, maxResults: limit });
            return similarElements;
        }
        catch (error) {
            console.error(`[SelectorLearner] Failed to find similar elements: ${error}`);
            return [];
        }
    }
    /**
     * Export learned selectors
     */
    exportLearned() {
        const exported = {};
        for (const [key, value] of this.learnedSelectors) {
            exported[key] = value;
        }
        return exported;
    }
    /**
     * Import learned selectors
     */
    importLearned(data) {
        for (const [key, value] of Object.entries(data)) {
            this.learnedSelectors.set(key, value);
        }
        console.log(`[SelectorLearner] Imported ${Object.keys(data).length} learned selectors`);
    }
}
// ============================================================================
// VisualDiffAnalyzer - Compares expected vs actual screenshots
// ============================================================================
export class VisualDiffAnalyzer extends EventEmitter {
    tempDir;
    constructor(tempDir = './visual_diff_temp') {
        super();
        this.tempDir = tempDir;
        this.ensureDirectory();
    }
    /**
     * Ensure temp directory exists
     */
    ensureDirectory() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    /**
     * Capture current screenshot
     */
    async captureScreenshot(filename) {
        const name = filename || `screenshot_${Date.now()}.png`;
        const filepath = path.join(this.tempDir, name);
        try {
            await screenshot({ filename: filepath });
            console.log(`[VisualDiffAnalyzer] Captured: ${filepath}`);
            return filepath;
        }
        catch (error) {
            throw new Error(`Failed to capture screenshot: ${error.message}`);
        }
    }
    /**
     * Capture page screenshot using Playwright
     */
    async capturePageScreenshot(page, filename) {
        const name = filename || `page_screenshot_${Date.now()}.png`;
        const filepath = path.join(this.tempDir, name);
        try {
            await page.screenshot({ path: filepath, fullPage: true });
            console.log(`[VisualDiffAnalyzer] Captured page screenshot: ${filepath}`);
            return filepath;
        }
        catch (error) {
            throw new Error(`Failed to capture page screenshot: ${error.message}`);
        }
    }
    /**
     * Compare two screenshots and return difference metrics
     * Note: This is a simplified comparison. In production, you would use
     * libraries like pixelmatch or resemble.js for proper image diffing.
     */
    async compareScreenshots(baselinePath, currentPath) {
        // Check if files exist
        if (!fs.existsSync(baselinePath)) {
            throw new Error(`Baseline screenshot not found: ${baselinePath}`);
        }
        if (!fs.existsSync(currentPath)) {
            throw new Error(`Current screenshot not found: ${currentPath}`);
        }
        // In a production implementation, you would use proper image comparison
        // For now, we compare file sizes as a basic heuristic
        const baselineStats = fs.statSync(baselinePath);
        const currentStats = fs.statSync(currentPath);
        const sizeDiff = Math.abs(baselineStats.size - currentStats.size);
        const maxSize = Math.max(baselineStats.size, currentStats.size);
        const diffPercentage = (sizeDiff / maxSize) * 100;
        // If size differs by more than 5%, consider it different
        const isDifferent = diffPercentage > 5;
        console.log(`[VisualDiffAnalyzer] Comparison: ${diffPercentage.toFixed(2)}% difference`);
        return {
            isDifferent,
            diffPercentage,
            diffRegions: [], // Would be populated by proper image diff
            diffImagePath: undefined // Would contain diff visualization
        };
    }
    /**
     * Capture element screenshot
     */
    async captureElementScreenshot(page, selector, filename) {
        try {
            const element = await page.$(selector);
            if (!element) {
                console.warn(`[VisualDiffAnalyzer] Element not found: ${selector}`);
                return null;
            }
            const name = filename || `element_${Date.now()}.png`;
            const filepath = path.join(this.tempDir, name);
            await element.screenshot({ path: filepath });
            console.log(`[VisualDiffAnalyzer] Captured element: ${filepath}`);
            return filepath;
        }
        catch (error) {
            console.error(`[VisualDiffAnalyzer] Failed to capture element: ${error.message}`);
            return null;
        }
    }
    /**
     * Get viewport state
     */
    async getViewportState(page) {
        return await page.evaluate(() => {
            return {
                size: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                scrollPosition: {
                    x: window.scrollX,
                    y: window.scrollY
                },
                documentSize: {
                    width: document.documentElement.scrollWidth,
                    height: document.documentElement.scrollHeight
                }
            };
        });
    }
    /**
     * Cleanup temp files
     */
    cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.tempDir, file));
                }
                console.log(`[VisualDiffAnalyzer] Cleaned up ${files.length} temp files`);
            }
        }
        catch (error) {
            console.error(`[VisualDiffAnalyzer] Cleanup failed: ${error.message}`);
        }
    }
}
// ============================================================================
// SelfHealingEngine - Tries alternative approaches to fix failures
// ============================================================================
export class SelfHealingEngine extends EventEmitter {
    selectorLearner;
    maxAttempts;
    timeout;
    minConfidence;
    constructor(options) {
        super();
        this.selectorLearner = options.selectorLearner;
        this.maxAttempts = options.maxAttempts ?? 5;
        this.timeout = options.timeout ?? 10000;
        this.minConfidence = options.minConfidence ?? 0.3;
    }
    /**
     * Attempt to heal a failure
     */
    async heal(page, failure, diagnosis) {
        const attempts = [];
        const startTime = Date.now();
        // Filter and sort fixes by confidence
        const viableFixes = diagnosis.suggestedFixes
            .filter(fix => fix.confidence >= this.minConfidence)
            .sort((a, b) => b.confidence - a.confidence);
        console.log(`[SelfHealingEngine] Attempting ${viableFixes.length} healing strategies`);
        for (let i = 0; i < Math.min(viableFixes.length, this.maxAttempts); i++) {
            const fix = viableFixes[i];
            if (!fix)
                continue;
            if (Date.now() - startTime > this.timeout) {
                console.log('[SelfHealingEngine] Healing timeout reached');
                break;
            }
            const attempt = await this.attemptFix(page, failure, fix);
            attempts.push(attempt);
            if (attempt.success) {
                console.log(`[SelfHealingEngine] Successfully healed with strategy: ${fix.type}`);
                this.emit('healingSuccess', attempt);
                // Learn the successful selector
                if (attempt.newSelector && failure.selector) {
                    this.selectorLearner.learn(failure.selector, attempt.newSelector);
                }
                break;
            }
        }
        if (!attempts.some(a => a.success)) {
            console.log('[SelfHealingEngine] All healing attempts failed');
            this.emit('healingFailed', { failure, attempts });
        }
        return attempts;
    }
    /**
     * Attempt a specific fix strategy
     */
    async attemptFix(page, failure, fix) {
        const attemptStart = Date.now();
        const attempt = {
            id: uuidv4(),
            failureId: failure.id,
            strategy: fix,
            success: false,
            timestamp: attemptStart,
            duration: 0
        };
        try {
            switch (fix.type) {
                case 'alternative_selector':
                    attempt.success = await this.tryAlternativeSelector(page, fix.selector);
                    if (attempt.success) {
                        attempt.newSelector = fix.selector;
                    }
                    break;
                case 'wait_strategy':
                    attempt.success = await this.tryWaitStrategy(page, failure.selector, fix.waitTime);
                    if (attempt.success) {
                        attempt.newSelector = failure.selector;
                    }
                    break;
                case 'scroll_into_view':
                    attempt.success = await this.tryScrollIntoView(page, failure.selector);
                    if (attempt.success) {
                        attempt.newSelector = failure.selector;
                    }
                    break;
                case 'force_click':
                    attempt.success = await this.tryForceClick(page, failure.selector);
                    if (attempt.success) {
                        attempt.newSelector = failure.selector;
                    }
                    break;
                case 'javascript_click':
                    attempt.success = await this.tryJavaScriptClick(page, failure.selector);
                    if (attempt.success) {
                        attempt.newSelector = failure.selector;
                    }
                    break;
                case 'hover_first':
                    attempt.success = await this.tryHoverFirst(page, failure.selector);
                    if (attempt.success) {
                        attempt.newSelector = failure.selector;
                    }
                    break;
                case 'retry':
                    attempt.success = await this.tryRetry(page, failure);
                    if (attempt.success) {
                        attempt.newSelector = failure.selector;
                    }
                    break;
            }
        }
        catch (error) {
            attempt.errorIfFailed = error.message;
            console.log(`[SelfHealingEngine] Strategy ${fix.type} failed: ${error.message}`);
        }
        attempt.duration = Date.now() - attemptStart;
        return attempt;
    }
    /**
     * Try an alternative selector
     */
    async tryAlternativeSelector(page, selector) {
        try {
            const element = await page.$(selector);
            if (element) {
                const isVisible = await element.isVisible();
                const isEnabled = await element.isEnabled();
                return isVisible && isEnabled;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    /**
     * Try waiting for element
     */
    async tryWaitStrategy(page, selector, waitTime) {
        try {
            await page.waitForSelector(selector, {
                state: 'visible',
                timeout: waitTime
            });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Try scrolling element into view
     */
    async tryScrollIntoView(page, selector) {
        try {
            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) {
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'center'
                    });
                }
            }, selector);
            // Wait for scroll to complete
            await page.waitForTimeout(500);
            const element = await page.$(selector);
            if (element) {
                return await element.isVisible();
            }
            return false;
        }
        catch {
            return false;
        }
    }
    /**
     * Try force clicking
     */
    async tryForceClick(page, selector) {
        try {
            await page.click(selector, { force: true });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Try JavaScript click
     */
    async tryJavaScriptClick(page, selector) {
        try {
            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) {
                    element.click();
                }
            }, selector);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Try hovering first then clicking
     */
    async tryHoverFirst(page, selector) {
        try {
            await page.hover(selector);
            await page.waitForTimeout(200);
            await page.click(selector);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Try simple retry
     */
    async tryRetry(page, failure) {
        if (!failure.selector)
            return false;
        try {
            // Wait a bit and retry
            await page.waitForTimeout(1000);
            const element = await page.$(failure.selector);
            return element !== null;
        }
        catch {
            return false;
        }
    }
    /**
     * Generate suggested fixes for a failure
     */
    async generateFixes(page, failure, pageState) {
        const fixes = [];
        // Always suggest retry first
        fixes.push({
            type: 'retry',
            description: 'Simple retry after brief wait',
            waitTime: 1000,
            confidence: 0.3
        });
        // If element not found, suggest alternatives
        if (failure.type === 'element_not_found' && failure.selector) {
            // Get learned alternatives
            const learnedAlternatives = this.selectorLearner.getLearnedAlternatives(failure.selector);
            for (const alt of learnedAlternatives) {
                fixes.push({
                    type: 'alternative_selector',
                    description: `Try learned selector: ${alt}`,
                    selector: alt,
                    confidence: 0.8 // High confidence for learned selectors
                });
            }
            // Check visible elements for similar ones
            for (const visible of pageState.visibleElements) {
                const alternatives = this.selectorLearner.generateAlternatives(visible);
                for (const alt of alternatives.slice(0, 3)) {
                    fixes.push({
                        type: 'alternative_selector',
                        description: `Try alternative selector: ${alt}`,
                        selector: alt,
                        confidence: 0.5
                    });
                }
            }
        }
        // If element not visible, suggest scroll
        if (failure.type === 'element_not_visible' && failure.selector) {
            fixes.push({
                type: 'scroll_into_view',
                description: 'Scroll element into viewport',
                selector: failure.selector,
                confidence: 0.7
            });
        }
        // If not interactable, suggest various click strategies
        if (failure.type === 'element_not_interactable' && failure.selector) {
            fixes.push({
                type: 'hover_first',
                description: 'Hover before clicking (for hidden elements)',
                selector: failure.selector,
                confidence: 0.6
            });
            fixes.push({
                type: 'force_click',
                description: 'Force click (bypass interactability checks)',
                selector: failure.selector,
                confidence: 0.5
            });
            fixes.push({
                type: 'javascript_click',
                description: 'Direct JavaScript click',
                selector: failure.selector,
                confidence: 0.4
            });
        }
        // If there are loading indicators, suggest waiting
        if (pageState.hasLoadingIndicators) {
            fixes.push({
                type: 'wait_strategy',
                description: 'Wait for loading to complete',
                waitTime: 5000,
                confidence: 0.7
            });
        }
        // If there are overlays, suggest dismissing or waiting
        if (pageState.hasOverlays) {
            fixes.push({
                type: 'wait_strategy',
                description: 'Wait for overlay to disappear',
                waitTime: 3000,
                confidence: 0.6
            });
        }
        // Timeout failures - suggest longer wait
        if (failure.type === 'timeout' && failure.selector) {
            fixes.push({
                type: 'wait_strategy',
                description: 'Extended wait for element',
                selector: failure.selector,
                waitTime: 10000,
                confidence: 0.5
            });
        }
        // Sort by confidence
        return fixes.sort((a, b) => b.confidence - a.confidence);
    }
}
// ============================================================================
// FailurePatternDB - Stores learned patterns from failures
// ============================================================================
export class FailurePatternDB extends EventEmitter {
    patterns = new Map();
    dbPath;
    maxPatterns;
    dirty = false;
    saveDebounceTimer = null;
    constructor(dbPath, maxPatterns = 1000) {
        super();
        this.dbPath = dbPath;
        this.maxPatterns = maxPatterns;
        this.load();
    }
    /**
     * Load patterns from disk
     */
    load() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = fs.readFileSync(this.dbPath, 'utf-8');
                const parsed = JSON.parse(data);
                for (const pattern of parsed) {
                    this.patterns.set(pattern.id, pattern);
                }
                console.log(`[FailurePatternDB] Loaded ${this.patterns.size} patterns`);
            }
        }
        catch (error) {
            console.error(`[FailurePatternDB] Failed to load: ${error.message}`);
        }
    }
    /**
     * Save patterns to disk (debounced)
     */
    scheduleSave() {
        this.dirty = true;
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(() => {
            this.save();
        }, 5000);
    }
    /**
     * Force save to disk
     */
    save() {
        if (!this.dirty)
            return;
        try {
            const patterns = Array.from(this.patterns.values());
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dbPath, JSON.stringify(patterns, null, 2), 'utf-8');
            this.dirty = false;
            console.log(`[FailurePatternDB] Saved ${patterns.length} patterns`);
        }
        catch (error) {
            console.error(`[FailurePatternDB] Failed to save: ${error.message}`);
        }
    }
    /**
     * Record a failure and its healing result
     */
    recordFailure(failure, healingAttempts, wasHealed) {
        const selector = failure.selector || 'unknown';
        const patternKey = `${failure.type}:${selector}`;
        let pattern = this.patterns.get(patternKey);
        if (!pattern) {
            pattern = {
                id: patternKey,
                patternType: failure.type,
                selector,
                alternativeSelectors: [],
                successfulStrategies: [],
                failureCount: 0,
                healingSuccessRate: 0,
                lastOccurrence: Date.now(),
                metadata: {}
            };
        }
        pattern.failureCount++;
        pattern.lastOccurrence = Date.now();
        // Record successful healing strategies
        if (wasHealed) {
            const successfulAttempt = healingAttempts.find(a => a.success);
            if (successfulAttempt) {
                // Add to successful strategies if not already present
                const strategyExists = pattern.successfulStrategies.some(s => s.type === successfulAttempt.strategy.type &&
                    s.selector === successfulAttempt.strategy.selector);
                if (!strategyExists) {
                    pattern.successfulStrategies.push(successfulAttempt.strategy);
                }
                // Add working selector to alternatives
                if (successfulAttempt.newSelector &&
                    !pattern.alternativeSelectors.includes(successfulAttempt.newSelector)) {
                    pattern.alternativeSelectors.push(successfulAttempt.newSelector);
                }
            }
        }
        // Update success rate
        const totalAttempts = pattern.failureCount;
        const successfulHealings = pattern.successfulStrategies.length > 0 ?
            (wasHealed ? pattern.failureCount - 1 : pattern.failureCount) : 0;
        pattern.healingSuccessRate = successfulHealings / totalAttempts;
        this.patterns.set(patternKey, pattern);
        this.enforceMaxPatterns();
        this.scheduleSave();
        this.emit('patternRecorded', pattern);
    }
    /**
     * Get pattern for a selector
     */
    getPattern(failureType, selector) {
        const patternKey = `${failureType}:${selector}`;
        return this.patterns.get(patternKey);
    }
    /**
     * Get all patterns for a selector (any failure type)
     */
    getPatternsForSelector(selector) {
        const results = [];
        for (const pattern of this.patterns.values()) {
            if (pattern.selector === selector) {
                results.push(pattern);
            }
        }
        return results;
    }
    /**
     * Get successful strategies for a failure type
     */
    getSuccessfulStrategies(failureType) {
        const strategies = [];
        for (const pattern of this.patterns.values()) {
            if (pattern.patternType === failureType) {
                for (const strategy of pattern.successfulStrategies) {
                    // Boost confidence based on success rate
                    const boostedStrategy = {
                        ...strategy,
                        confidence: Math.min(0.95, strategy.confidence + pattern.healingSuccessRate * 0.2)
                    };
                    strategies.push(boostedStrategy);
                }
            }
        }
        return strategies;
    }
    /**
     * Get alternative selectors from patterns
     */
    getAlternativeSelectors(selector) {
        const alternatives = new Set();
        for (const pattern of this.patterns.values()) {
            if (pattern.selector === selector) {
                for (const alt of pattern.alternativeSelectors) {
                    alternatives.add(alt);
                }
            }
        }
        return Array.from(alternatives);
    }
    /**
     * Enforce maximum pattern count
     */
    enforceMaxPatterns() {
        if (this.patterns.size <= this.maxPatterns)
            return;
        // Sort by last occurrence and remove oldest
        const sorted = Array.from(this.patterns.entries())
            .sort((a, b) => a[1].lastOccurrence - b[1].lastOccurrence);
        const toRemove = sorted.slice(0, this.patterns.size - this.maxPatterns);
        for (const [key] of toRemove) {
            this.patterns.delete(key);
        }
        console.log(`[FailurePatternDB] Pruned ${toRemove.length} old patterns`);
    }
    /**
     * Get statistics
     */
    getStats() {
        const failureCounts = new Map();
        let totalSuccessRate = 0;
        for (const pattern of this.patterns.values()) {
            const count = failureCounts.get(pattern.patternType) || 0;
            failureCounts.set(pattern.patternType, count + pattern.failureCount);
            totalSuccessRate += pattern.healingSuccessRate;
        }
        const mostCommonFailures = Array.from(failureCounts.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return {
            totalPatterns: this.patterns.size,
            averageSuccessRate: this.patterns.size > 0 ?
                totalSuccessRate / this.patterns.size : 0,
            mostCommonFailures
        };
    }
    /**
     * Clear all patterns
     */
    clear() {
        this.patterns.clear();
        this.dirty = true;
        this.save();
        this.emit('cleared');
    }
    /**
     * Close and cleanup
     */
    close() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.save();
    }
}
// ============================================================================
// DebugReportGenerator - Creates detailed debugging reports
// ============================================================================
export class DebugReportGenerator extends EventEmitter {
    reportDir;
    visualDiffAnalyzer;
    constructor(reportDir, visualDiffAnalyzer) {
        super();
        this.reportDir = reportDir;
        this.visualDiffAnalyzer = visualDiffAnalyzer;
        this.ensureDirectory();
    }
    /**
     * Ensure report directory exists
     */
    ensureDirectory() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }
    /**
     * Generate a comprehensive debug report
     */
    async generateReport(failure, diagnosis, healingAttempts, page) {
        const reportId = `report_${failure.id}`;
        const timestamp = Date.now();
        // Capture annotated screenshot if page available
        let annotatedScreenshotPath;
        if (page && failure.selector) {
            annotatedScreenshotPath = await this.captureAnnotatedScreenshot(page, failure.selector, reportId);
        }
        // Generate recommendations
        const recommendations = this.generateRecommendations(failure, diagnosis, healingAttempts);
        const report = {
            id: reportId,
            failure,
            diagnosis,
            healingAttempts,
            wasHealed: healingAttempts.some(a => a.success),
            finalSelector: healingAttempts.find(a => a.success)?.newSelector,
            annotatedScreenshotPath,
            recommendations,
            generatedAt: timestamp
        };
        // Generate HTML report
        report.htmlReportPath = await this.generateHTMLReport(report);
        console.log(`[DebugReportGenerator] Generated report: ${reportId}`);
        this.emit('reportGenerated', report);
        return report;
    }
    /**
     * Capture annotated screenshot highlighting the failed element
     */
    async captureAnnotatedScreenshot(page, selector, reportId) {
        try {
            const screenshotPath = path.join(this.reportDir, `${reportId}_annotated.png`);
            // Try to highlight the element before capturing
            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) {
                    const originalOutline = element.style.outline;
                    element.style.outline = '3px solid red';
                    // Store original to restore later
                    element.__originalOutline = originalOutline;
                }
            }, selector).catch(() => {
                // Element might not exist, continue anyway
            });
            await page.screenshot({ path: screenshotPath, fullPage: false });
            // Restore original style
            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element && element.__originalOutline !== undefined) {
                    element.style.outline = element.__originalOutline;
                    delete element.__originalOutline;
                }
            }, selector).catch(() => { });
            return screenshotPath;
        }
        catch (error) {
            console.error(`[DebugReportGenerator] Failed to capture annotated screenshot: ${error.message}`);
            return undefined;
        }
    }
    /**
     * Generate recommendations based on failure analysis
     */
    generateRecommendations(failure, diagnosis, healingAttempts) {
        const recommendations = [];
        // Based on failure type
        switch (failure.type) {
            case 'element_not_found':
                recommendations.push('Consider using more stable selectors like data-testid or aria-label');
                recommendations.push('Add explicit waits before interacting with dynamic elements');
                recommendations.push('Verify the element is present in the DOM at the time of interaction');
                break;
            case 'element_not_visible':
                recommendations.push('Ensure element is scrolled into view before interaction');
                recommendations.push('Check for overlapping elements or modals');
                recommendations.push('Verify CSS display and visibility properties');
                break;
            case 'element_not_interactable':
                recommendations.push('Check if element is disabled or has pointer-events: none');
                recommendations.push('Ensure no overlay is blocking the element');
                recommendations.push('Try waiting for animations to complete');
                break;
            case 'timeout':
                recommendations.push('Increase timeout values for slower pages');
                recommendations.push('Check network conditions and API response times');
                recommendations.push('Consider implementing retry logic with exponential backoff');
                break;
            case 'click_missed':
                recommendations.push('Verify element position is stable before clicking');
                recommendations.push('Consider using JavaScript click for complex interactions');
                recommendations.push('Ensure viewport size matches expected dimensions');
                break;
        }
        // Based on page state
        if (diagnosis.pageStateAnalysis.hasLoadingIndicators) {
            recommendations.push('Wait for loading indicators to disappear before actions');
        }
        if (diagnosis.pageStateAnalysis.hasOverlays) {
            recommendations.push('Handle or dismiss modal dialogs before proceeding');
        }
        // Based on healing success
        const successfulAttempt = healingAttempts.find(a => a.success);
        if (successfulAttempt) {
            recommendations.push(`Consider using ${successfulAttempt.strategy.type} strategy as primary approach`);
            if (successfulAttempt.newSelector) {
                recommendations.push(`Update selector to: ${successfulAttempt.newSelector}`);
            }
        }
        return recommendations;
    }
    /**
     * Generate HTML report
     */
    async generateHTMLReport(report) {
        const htmlPath = path.join(this.reportDir, `${report.id}.html`);
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug Report: ${report.id}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1, h2, h3 { margin-bottom: 15px; color: #1a1a2e; }
        h1 { font-size: 28px; border-bottom: 3px solid #e94560; padding-bottom: 10px; }
        h2 { font-size: 22px; color: #16213e; margin-top: 30px; }
        h3 { font-size: 18px; color: #0f3460; }

        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .severity-critical { border-left: 4px solid #e94560; }
        .severity-high { border-left: 4px solid #ff6b6b; }
        .severity-medium { border-left: 4px solid #feca57; }
        .severity-low { border-left: 4px solid #48dbfb; }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge-failure { background: #e94560; color: white; }
        .badge-success { background: #1dd1a1; color: white; }
        .badge-warning { background: #feca57; color: #333; }

        .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 15px 0;
        }

        .detail-item {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
        }
        .detail-item label {
            display: block;
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .detail-item .value {
            font-weight: 500;
            word-break: break-word;
        }

        .code {
            background: #1a1a2e;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            white-space: pre-wrap;
        }

        .list {
            list-style: none;
            padding: 0;
        }
        .list li {
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .list li:last-child { border-bottom: none; }

        .strategy-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            margin-bottom: 10px;
        }
        .strategy-item.success { background: #d4edda; }
        .strategy-item.failed { background: #f8d7da; }

        .confidence-bar {
            width: 100px;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
        }
        .confidence-bar .fill {
            height: 100%;
            background: #1dd1a1;
            transition: width 0.3s;
        }

        .screenshot {
            max-width: 100%;
            border-radius: 8px;
            border: 1px solid #ddd;
            margin: 15px 0;
        }

        .recommendations {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
        }
        .recommendations h3 { color: white; }
        .recommendations li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
        }
        .recommendations li:before {
            content: ">";
            position: absolute;
            left: 5px;
            font-weight: bold;
        }

        .timestamp {
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <h1>Visual Debugger Report</h1>
    <p class="timestamp">Generated: ${new Date(report.generatedAt).toLocaleString()}</p>

    <div class="card severity-${report.failure.severity}">
        <h2>Failure Details</h2>
        <div class="detail-grid">
            <div class="detail-item">
                <label>Failure Type</label>
                <div class="value"><span class="badge badge-failure">${report.failure.type}</span></div>
            </div>
            <div class="detail-item">
                <label>Severity</label>
                <div class="value">${report.failure.severity.toUpperCase()}</div>
            </div>
            <div class="detail-item">
                <label>Timestamp</label>
                <div class="value">${new Date(report.failure.timestamp).toLocaleString()}</div>
            </div>
            <div class="detail-item">
                <label>Selector</label>
                <div class="value">${report.failure.selector || 'N/A'}</div>
            </div>
        </div>

        <h3>Error Message</h3>
        <div class="code">${report.failure.errorMessage}</div>

        ${report.failure.stackTrace ? `
        <h3>Stack Trace</h3>
        <div class="code">${report.failure.stackTrace}</div>
        ` : ''}

        ${report.failure.pageUrl ? `
        <div class="detail-item" style="margin-top: 15px;">
            <label>Page URL</label>
            <div class="value">${report.failure.pageUrl}</div>
        </div>
        ` : ''}
    </div>

    <div class="card">
        <h2>Diagnosis</h2>
        <div class="detail-item">
            <label>Root Cause</label>
            <div class="value">${report.diagnosis.rootCause}</div>
        </div>

        <h3>Possible Reasons</h3>
        <ul class="list">
            ${report.diagnosis.possibleReasons.map(reason => `
                <li><span>&#8226;</span> ${reason}</li>
            `).join('')}
        </ul>

        <h3>Page State Analysis</h3>
        <div class="detail-grid">
            <div class="detail-item">
                <label>Page Loaded</label>
                <div class="value">${report.diagnosis.pageStateAnalysis.isPageLoaded ? 'Yes' : 'No'}</div>
            </div>
            <div class="detail-item">
                <label>Has Overlays</label>
                <div class="value">${report.diagnosis.pageStateAnalysis.hasOverlays ? 'Yes' : 'No'}</div>
            </div>
            <div class="detail-item">
                <label>Loading Indicators</label>
                <div class="value">${report.diagnosis.pageStateAnalysis.hasLoadingIndicators ? 'Yes' : 'No'}</div>
            </div>
            <div class="detail-item">
                <label>Viewport Size</label>
                <div class="value">${report.diagnosis.pageStateAnalysis.viewportSize.width}x${report.diagnosis.pageStateAnalysis.viewportSize.height}</div>
            </div>
        </div>
    </div>

    <div class="card">
        <h2>Healing Attempts</h2>
        <p><span class="badge ${report.wasHealed ? 'badge-success' : 'badge-failure'}">
            ${report.wasHealed ? 'HEALED' : 'NOT HEALED'}
        </span></p>

        ${report.healingAttempts.map(attempt => `
            <div class="strategy-item ${attempt.success ? 'success' : 'failed'}">
                <div>
                    <strong>${attempt.strategy.type}</strong>
                    <p>${attempt.strategy.description}</p>
                    ${attempt.newSelector ? `<code>New Selector: ${attempt.newSelector}</code>` : ''}
                    ${attempt.errorIfFailed ? `<small style="color: #721c24;">Error: ${attempt.errorIfFailed}</small>` : ''}
                </div>
                <div style="text-align: right;">
                    <span class="badge ${attempt.success ? 'badge-success' : 'badge-failure'}">
                        ${attempt.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                    <div class="confidence-bar">
                        <div class="fill" style="width: ${attempt.strategy.confidence * 100}%"></div>
                    </div>
                    <small>${(attempt.strategy.confidence * 100).toFixed(0)}% confidence</small>
                </div>
            </div>
        `).join('')}
    </div>

    ${report.annotatedScreenshotPath ? `
    <div class="card">
        <h2>Annotated Screenshot</h2>
        <img class="screenshot" src="${path.basename(report.annotatedScreenshotPath)}" alt="Annotated Screenshot">
    </div>
    ` : ''}

    <div class="recommendations">
        <h3>Recommendations</h3>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    ${report.finalSelector ? `
    <div class="card">
        <h2>Final Working Selector</h2>
        <div class="code">${report.finalSelector}</div>
    </div>
    ` : ''}
</body>
</html>
        `;
        fs.writeFileSync(htmlPath, html, 'utf-8');
        console.log(`[DebugReportGenerator] HTML report saved: ${htmlPath}`);
        return htmlPath;
    }
    /**
     * Get all reports
     */
    listReports() {
        try {
            const files = fs.readdirSync(this.reportDir);
            return files
                .filter(f => f.endsWith('.html'))
                .map(f => path.join(this.reportDir, f));
        }
        catch {
            return [];
        }
    }
    /**
     * Clean old reports
     */
    cleanOldReports(maxAgeDays = 7) {
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        let cleaned = 0;
        try {
            const files = fs.readdirSync(this.reportDir);
            for (const file of files) {
                const filepath = path.join(this.reportDir, file);
                const stats = fs.statSync(filepath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filepath);
                    cleaned++;
                }
            }
            console.log(`[DebugReportGenerator] Cleaned ${cleaned} old reports`);
        }
        catch (error) {
            console.error(`[DebugReportGenerator] Cleanup failed: ${error.message}`);
        }
        return cleaned;
    }
}
// ============================================================================
// VisualDebugger - Main integration class
// ============================================================================
export class VisualDebugger extends EventEmitter {
    config;
    failureDetector;
    selectorLearner;
    selfHealingEngine;
    visualDiffAnalyzer;
    failurePatternDB;
    reportGenerator;
    activePage = null;
    isInitialized = false;
    constructor(config) {
        super();
        this.config = {
            screenshotDir: './visual_debug/screenshots',
            reportDir: './visual_debug/reports',
            maxHealingAttempts: 5,
            healingTimeout: 15000,
            enableLearning: true,
            patternDbPath: './visual_debug/patterns.json',
            screenshotOnFailure: true,
            htmlSnapshotOnFailure: true,
            maxStoredPatterns: 1000,
            minConfidenceForHealing: 0.3,
            ...config
        };
        // Initialize components
        this.failureDetector = new FailureDetector();
        this.selectorLearner = new SelectorLearner();
        this.visualDiffAnalyzer = new VisualDiffAnalyzer(this.config.screenshotDir);
        this.failurePatternDB = new FailurePatternDB(this.config.patternDbPath, this.config.maxStoredPatterns);
        this.selfHealingEngine = new SelfHealingEngine({
            selectorLearner: this.selectorLearner,
            maxAttempts: this.config.maxHealingAttempts,
            timeout: this.config.healingTimeout,
            minConfidence: this.config.minConfidenceForHealing
        });
        this.reportGenerator = new DebugReportGenerator(this.config.reportDir, this.visualDiffAnalyzer);
        this.setupEventListeners();
        this.ensureDirectories();
    }
    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const dirs = [
            this.config.screenshotDir,
            this.config.reportDir,
            path.dirname(this.config.patternDbPath)
        ];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
    /**
     * Setup internal event listeners
     */
    setupEventListeners() {
        // Forward failure detector events
        this.failureDetector.on('failureDetected', (failure) => {
            this.emit('failureDetected', failure);
        });
        // Forward healing events
        this.selfHealingEngine.on('healingSuccess', (attempt) => {
            this.emit('healingSuccess', attempt);
        });
        this.selfHealingEngine.on('healingFailed', (data) => {
            this.emit('healingFailed', data);
        });
        // Forward report events
        this.reportGenerator.on('reportGenerated', (report) => {
            this.emit('reportGenerated', report);
        });
    }
    /**
     * Initialize the visual debugger with a page
     */
    async initialize(page) {
        this.activePage = page;
        await this.failureDetector.startMonitoring(page);
        this.isInitialized = true;
        console.log('[VisualDebugger] Initialized and monitoring page');
        this.emit('initialized');
    }
    /**
     * Diagnose a failure and analyze page state
     */
    async diagnose(failure) {
        const diagnosisStart = Date.now();
        // Analyze page state
        const pageStateAnalysis = await this.analyzePageState();
        // Determine root cause
        const rootCause = this.determineRootCause(failure, pageStateAnalysis);
        // Generate possible reasons
        const possibleReasons = this.generatePossibleReasons(failure, pageStateAnalysis);
        // Get suggestions from pattern database
        const patternStrategies = this.config.enableLearning && failure.selector ?
            this.failurePatternDB.getSuccessfulStrategies(failure.type) : [];
        // Generate suggested fixes
        const suggestedFixes = await this.selfHealingEngine.generateFixes(this.activePage, failure, pageStateAnalysis);
        // Add pattern-based strategies
        for (const strategy of patternStrategies) {
            if (!suggestedFixes.some(f => f.type === strategy.type && f.selector === strategy.selector)) {
                suggestedFixes.push(strategy);
            }
        }
        // Add learned alternative selectors
        if (failure.selector) {
            const dbAlternatives = this.failurePatternDB.getAlternativeSelectors(failure.selector);
            for (const alt of dbAlternatives) {
                if (!suggestedFixes.some(f => f.selector === alt)) {
                    suggestedFixes.push({
                        type: 'alternative_selector',
                        description: `Pattern-learned selector: ${alt}`,
                        selector: alt,
                        confidence: 0.75
                    });
                }
            }
        }
        // Calculate overall confidence
        const confidence = this.calculateDiagnosisConfidence(failure, pageStateAnalysis, suggestedFixes);
        const diagnosis = {
            failureId: failure.id,
            rootCause,
            possibleReasons,
            suggestedFixes: suggestedFixes.sort((a, b) => b.confidence - a.confidence),
            confidence,
            pageStateAnalysis,
            timestamp: diagnosisStart
        };
        console.log(`[VisualDebugger] Diagnosis complete: ${rootCause} (${(confidence * 100).toFixed(0)}% confidence)`);
        this.emit('diagnosisComplete', diagnosis);
        return diagnosis;
    }
    /**
     * Analyze current page state
     */
    async analyzePageState() {
        if (!this.activePage) {
            return {
                isPageLoaded: false,
                hasOverlays: false,
                hasLoadingIndicators: false,
                viewportSize: { width: 0, height: 0 },
                scrollPosition: { x: 0, y: 0 },
                visibleElements: [],
                hiddenElements: [],
                interactableElements: []
            };
        }
        const [isLoaded, hasOverlays, hasLoadingIndicators, viewportState, domChanges] = await Promise.all([
            this.activePage.evaluate(() => document.readyState === 'complete'),
            this.failureDetector.hasOverlays(),
            this.failureDetector.hasLoadingIndicators(),
            this.visualDiffAnalyzer.getViewportState(this.activePage),
            this.failureDetector.getDOMChanges()
        ]);
        // Get visible, hidden, and interactable elements
        const { visibleElements, hiddenElements, interactableElements } = await this.getElementCategories();
        return {
            isPageLoaded: isLoaded,
            hasOverlays,
            hasLoadingIndicators,
            viewportSize: viewportState.size,
            scrollPosition: viewportState.scrollPosition,
            visibleElements,
            hiddenElements,
            interactableElements,
            domChanges
        };
    }
    /**
     * Get categorized elements from the page
     */
    async getElementCategories() {
        if (!this.activePage) {
            return {
                visibleElements: [],
                hiddenElements: [],
                interactableElements: []
            };
        }
        try {
            return await this.activePage.evaluate(() => {
                const visibleElements = [];
                const hiddenElements = [];
                const interactableElements = [];
                const interactableTags = ['button', 'a', 'input', 'select', 'textarea'];
                for (const tag of interactableTags) {
                    const elements = document.getElementsByTagName(tag);
                    for (const elem of elements) {
                        const rect = elem.getBoundingClientRect();
                        const style = window.getComputedStyle(elem);
                        const attributes = {};
                        for (const attr of elem.attributes) {
                            attributes[attr.name] = attr.value;
                        }
                        const isVisible = style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            rect.width > 0 &&
                            rect.height > 0;
                        const isInteractable = !elem.hasAttribute('disabled') &&
                            style.pointerEvents !== 'none';
                        const info = {
                            selector: elem.id ? `#${elem.id}` :
                                elem.className ? `.${elem.className.split(/\s+/)[0]}` :
                                    tag,
                            tagName: elem.tagName,
                            id: elem.id || undefined,
                            className: elem.className || undefined,
                            text: elem.textContent?.trim().substring(0, 50) || undefined,
                            isVisible,
                            isInteractable,
                            boundingBox: {
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height
                            },
                            attributes
                        };
                        if (isVisible) {
                            visibleElements.push(info);
                            if (isInteractable) {
                                interactableElements.push(info);
                            }
                        }
                        else {
                            hiddenElements.push(info);
                        }
                    }
                }
                return {
                    visibleElements: visibleElements.slice(0, 50),
                    hiddenElements: hiddenElements.slice(0, 20),
                    interactableElements: interactableElements.slice(0, 50)
                };
            });
        }
        catch {
            return {
                visibleElements: [],
                hiddenElements: [],
                interactableElements: []
            };
        }
    }
    /**
     * Determine root cause of failure
     */
    determineRootCause(failure, pageState) {
        if (!pageState.isPageLoaded) {
            return 'Page has not finished loading';
        }
        if (pageState.hasLoadingIndicators) {
            return 'Page is still loading content';
        }
        if (pageState.hasOverlays) {
            return 'Modal or overlay is blocking the target element';
        }
        switch (failure.type) {
            case 'element_not_found':
                return 'Target element does not exist in the DOM';
            case 'element_not_visible':
                return 'Element exists but is not visible (hidden, off-screen, or zero dimensions)';
            case 'element_not_interactable':
                return 'Element is visible but cannot receive interactions (disabled or blocked)';
            case 'click_missed':
                return 'Click action did not hit the intended target (element may have moved)';
            case 'timeout':
                return 'Operation exceeded time limit waiting for condition';
            case 'selector_stale':
                return 'Element reference became invalid (DOM was modified)';
            case 'navigation_failed':
                return 'Page navigation failed or was blocked';
            default:
                return `Unknown failure: ${failure.errorMessage}`;
        }
    }
    /**
     * Generate possible reasons for the failure
     */
    generatePossibleReasons(failure, pageState) {
        const reasons = [];
        // Common reasons based on failure type
        switch (failure.type) {
            case 'element_not_found':
                reasons.push('Selector syntax is incorrect or outdated');
                reasons.push('Element is dynamically loaded and not yet present');
                reasons.push('Page content has changed and element no longer exists');
                reasons.push('Element is inside an iframe');
                break;
            case 'element_not_visible':
                reasons.push('Element is positioned off-screen');
                reasons.push('Element has CSS display:none or visibility:hidden');
                reasons.push('Element has zero width or height');
                reasons.push('Parent container is hiding the element');
                break;
            case 'element_not_interactable':
                reasons.push('Element is covered by another element');
                reasons.push('Element is disabled');
                reasons.push('Element has pointer-events:none');
                reasons.push('Animation is in progress');
                break;
            case 'timeout':
                reasons.push('Network request is slow or failed');
                reasons.push('JavaScript is blocking the main thread');
                reasons.push('Condition will never be met');
                reasons.push('Timeout value is too short');
                break;
        }
        // Add reasons based on page state
        if (!pageState.isPageLoaded) {
            reasons.push('Page is still loading');
        }
        if (pageState.hasOverlays) {
            reasons.push('A modal dialog or overlay is present');
        }
        if (pageState.hasLoadingIndicators) {
            reasons.push('Content is still being fetched');
        }
        if (pageState.domChanges && pageState.domChanges.length > 10) {
            reasons.push('DOM is actively being modified');
        }
        return [...new Set(reasons)];
    }
    /**
     * Calculate confidence in the diagnosis
     */
    calculateDiagnosisConfidence(failure, pageState, suggestedFixes) {
        let confidence = 0.5; // Base confidence
        // Boost confidence if we have page context
        if (pageState.isPageLoaded)
            confidence += 0.1;
        if (!pageState.hasLoadingIndicators)
            confidence += 0.1;
        // Boost if we have high-confidence fixes
        const highConfidenceFixes = suggestedFixes.filter(f => f.confidence > 0.7);
        if (highConfidenceFixes.length > 0) {
            confidence += 0.15;
        }
        // Boost if we found similar patterns
        if (failure.selector) {
            const patterns = this.failurePatternDB.getPatternsForSelector(failure.selector);
            if (patterns.length > 0 && patterns[0] && patterns[0].successfulStrategies.length > 0) {
                confidence += 0.15;
            }
        }
        return Math.min(0.95, confidence);
    }
    /**
     * Attempt to heal a failure
     */
    async heal(failure, diagnosis) {
        if (!this.activePage) {
            throw new Error('VisualDebugger not initialized with a page');
        }
        // Get diagnosis if not provided
        const diag = diagnosis || await this.diagnose(failure);
        console.log(`[VisualDebugger] Attempting to heal failure: ${failure.type}`);
        // Attempt healing
        const attempts = await this.selfHealingEngine.heal(this.activePage, failure, diag);
        const success = attempts.some(a => a.success);
        const successfulAttempt = attempts.find(a => a.success);
        // Record in pattern database for learning
        if (this.config.enableLearning) {
            this.failurePatternDB.recordFailure(failure, attempts, success);
        }
        // Generate report
        const report = await this.reportGenerator.generateReport(failure, diag, attempts, this.activePage);
        const result = {
            success,
            attempts,
            finalSelector: successfulAttempt?.newSelector,
            report
        };
        this.emit('healingComplete', result);
        return result;
    }
    /**
     * Main entry point: detect, diagnose, and heal a failure
     */
    async handleError(error, action, selector) {
        // Detect failure
        const failure = this.failureDetector.detectFailure(error, action, selector);
        // Capture screenshot if configured
        if (this.config.screenshotOnFailure && this.activePage) {
            try {
                failure.screenshotPath = await this.visualDiffAnalyzer.capturePageScreenshot(this.activePage, `failure_${failure.id}.png`);
            }
            catch (e) {
                console.error('[VisualDebugger] Failed to capture failure screenshot');
            }
        }
        // Capture HTML snapshot if configured
        if (this.config.htmlSnapshotOnFailure && this.activePage) {
            try {
                failure.htmlSnapshot = await this.activePage.content();
            }
            catch (e) {
                console.error('[VisualDebugger] Failed to capture HTML snapshot');
            }
        }
        // Diagnose
        const diagnosis = await this.diagnose(failure);
        // Heal
        const healingResult = await this.heal(failure, diagnosis);
        // Generate comprehensive report
        const report = await this.reportGenerator.generateReport(failure, diagnosis, healingResult.attempts, this.activePage || undefined);
        return {
            failure,
            diagnosis,
            healed: healingResult.success,
            healingAttempts: healingResult.attempts,
            report
        };
    }
    /**
     * Wrap an action with automatic error handling and healing
     */
    async executeWithHealing(action, selector, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await action();
            }
            catch (error) {
                lastError = error;
                console.log(`[VisualDebugger] Action failed (attempt ${attempt + 1}/${maxRetries})`);
                const result = await this.handleError(error, undefined, selector);
                if (result.healed && result.healingAttempts.some(a => a.success)) {
                    console.log('[VisualDebugger] Retrying after successful healing');
                    continue;
                }
                // If we couldn't heal and this is the last retry, throw
                if (attempt === maxRetries - 1) {
                    throw error;
                }
            }
        }
        throw lastError || new Error('Action failed after all retries');
    }
    /**
     * Get the failure detector
     */
    getFailureDetector() {
        return this.failureDetector;
    }
    /**
     * Get the selector learner
     */
    getSelectorLearner() {
        return this.selectorLearner;
    }
    /**
     * Get the self-healing engine
     */
    getSelfHealingEngine() {
        return this.selfHealingEngine;
    }
    /**
     * Get the visual diff analyzer
     */
    getVisualDiffAnalyzer() {
        return this.visualDiffAnalyzer;
    }
    /**
     * Get the failure pattern database
     */
    getPatternDB() {
        return this.failurePatternDB;
    }
    /**
     * Get the report generator
     */
    getReportGenerator() {
        return this.reportGenerator;
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            patternStats: this.failurePatternDB.getStats(),
            learnedSelectors: this.selectorLearner.exportLearned(),
            reportsGenerated: this.reportGenerator.listReports().length
        };
    }
    /**
     * Export learned data
     */
    exportLearning() {
        return {
            selectors: this.selectorLearner.exportLearned(),
            patternDbPath: this.config.patternDbPath
        };
    }
    /**
     * Import learned data
     */
    importLearning(data) {
        this.selectorLearner.importLearned(data.selectors);
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.failureDetector.stopMonitoring();
        this.failurePatternDB.close();
        this.visualDiffAnalyzer.cleanup();
        this.activePage = null;
        this.isInitialized = false;
        console.log('[VisualDebugger] Cleaned up');
        this.emit('cleanup');
    }
    /**
     * Check if initialized
     */
    isReady() {
        return this.isInitialized;
    }
}
// ============================================================================
// VisualAgent Integration Hook
// ============================================================================
/**
 * Hook to integrate VisualDebugger with existing VisualAgent
 */
export function createVisualAgentDebugHook(debugger_) {
    return {
        /**
         * Wrap a VisualAgent action with debugging and healing
         */
        wrapAction: async (action, visualAction, selector) => {
            try {
                return await action();
            }
            catch (error) {
                const result = await debugger_.handleError(error, visualAction, selector);
                if (result.healed) {
                    // Retry the action after healing
                    return await action();
                }
                throw error;
            }
        },
        /**
         * Execute with automatic healing retries
         */
        executeWithHealing: async (action, selector) => {
            return debugger_.executeWithHealing(action, selector);
        },
        /**
         * Get debug report for last failure
         */
        getLastReport: () => {
            const reports = debugger_.getReportGenerator().listReports();
            return reports[reports.length - 1];
        },
        /**
         * Get learning statistics
         */
        getStats: () => debugger_.getStats()
    };
}
// ============================================================================
// Exports
// ============================================================================
export { VisualDebugger, FailureDetector, SelectorLearner, SelfHealingEngine, VisualDiffAnalyzer, FailurePatternDB, DebugReportGenerator, createVisualAgentDebugHook };
export default VisualDebugger;
//# sourceMappingURL=VisualDebugger.js.map