// @ts-nocheck
/**
 * SpatialWebAwareness - Advanced spatial understanding of web pages
 *
 * This module provides comprehensive spatial analysis of web pages,
 * enabling natural language navigation and understanding of page layouts.
 */

import type { Page, ElementHandle, BrowserContext, Browser } from 'playwright';
import { chromium } from 'playwright';

// ============================================================================
// Type Definitions
// ============================================================================

/** Bounding box representing element position and dimensions */
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Extended bounding box with computed properties */
export interface ExtendedBoundingBox extends BoundingBox {
    centerX: number;
    centerY: number;
    right: number;
    bottom: number;
    area: number;
}

/** Semantic region types following common web patterns */
export type SemanticRegionType =
    | 'header'
    | 'navigation'
    | 'main'
    | 'sidebar'
    | 'footer'
    | 'search'
    | 'form'
    | 'article'
    | 'aside'
    | 'banner'
    | 'complementary'
    | 'contentinfo'
    | 'unknown';

/** ARIA landmark roles */
export type AriaLandmark =
    | 'banner'
    | 'navigation'
    | 'main'
    | 'complementary'
    | 'contentinfo'
    | 'search'
    | 'form'
    | 'region'
    | 'none';

/** Spatial relationship between elements */
export type SpatialRelation =
    | 'above'
    | 'below'
    | 'left-of'
    | 'right-of'
    | 'inside'
    | 'contains'
    | 'overlaps'
    | 'near'
    | 'adjacent-to';

/** Viewport size presets for responsive testing */
export interface ViewportSize {
    width: number;
    height: number;
    name: string;
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
}

/** Element information extracted from the DOM */
export interface ElementInfo {
    id: string;
    tagName: string;
    className: string;
    textContent: string;
    ariaLabel: string | null;
    ariaRole: string | null;
    boundingBox: ExtendedBoundingBox;
    isVisible: boolean;
    isInteractive: boolean;
    semanticType: SemanticRegionType;
    xpath: string;
    selector: string;
    attributes: Record<string, string>;
    computedStyles: {
        display: string;
        position: string;
        zIndex: string;
        visibility: string;
        opacity: string;
    };
}

/** Semantic region on the page */
export interface SemanticRegion {
    type: SemanticRegionType;
    boundingBox: ExtendedBoundingBox;
    elements: ElementInfo[];
    confidence: number;
    ariaLandmark: AriaLandmark;
    heading?: string;
}

/** Relationship between two elements */
export interface ElementRelationship {
    sourceId: string;
    targetId: string;
    relation: SpatialRelation;
    distance: number;
    isParentChild: boolean;
    isSibling: boolean;
}

/** Natural language query result */
export interface NaturalLanguageMatch {
    element: ElementInfo;
    score: number;
    matchedTerms: string[];
    reasoning: string;
}

/** Complete page analysis result */
export interface PageAnalysis {
    url: string;
    title: string;
    viewport: ViewportSize;
    timestamp: Date;
    regions: SemanticRegion[];
    elements: ElementInfo[];
    relationships: ElementRelationship[];
    accessibilityLandmarks: SemanticRegion[];
    visualHierarchy: VisualHierarchyNode[];
    responsiveBreakpoints: ResponsiveBreakpoint[];
}

/** Node in the visual hierarchy tree */
export interface VisualHierarchyNode {
    element: ElementInfo;
    children: VisualHierarchyNode[];
    depth: number;
    visualWeight: number;
}

/** Responsive breakpoint information */
export interface ResponsiveBreakpoint {
    width: number;
    name: string;
    layoutChanges: LayoutChange[];
}

/** Layout change at a breakpoint */
export interface LayoutChange {
    elementId: string;
    property: string;
    beforeValue: string;
    afterValue: string;
}

// ============================================================================
// ViewportManager - Handle different screen sizes
// ============================================================================

export class ViewportManager {
    private static readonly COMMON_VIEWPORTS: ViewportSize[] = [
        { width: 320, height: 568, name: 'mobile-small', isMobile: true, hasTouch: true },
        { width: 375, height: 667, name: 'mobile-medium', isMobile: true, hasTouch: true },
        { width: 414, height: 896, name: 'mobile-large', isMobile: true, hasTouch: true },
        { width: 768, height: 1024, name: 'tablet', isMobile: true, hasTouch: true },
        { width: 1024, height: 768, name: 'tablet-landscape', isMobile: false, hasTouch: true },
        { width: 1280, height: 800, name: 'desktop-small', isMobile: false, hasTouch: false },
        { width: 1440, height: 900, name: 'desktop-medium', isMobile: false, hasTouch: false },
        { width: 1920, height: 1080, name: 'desktop-large', isMobile: false, hasTouch: false },
        { width: 2560, height: 1440, name: 'desktop-2k', isMobile: false, hasTouch: false },
    ];

    private currentViewport: ViewportSize;
    private page: Page | null = null;

    constructor(initialViewport?: ViewportSize) {
        this.currentViewport = initialViewport ?? ViewportManager.COMMON_VIEWPORTS[5]!; // desktop-small default
    }

    /** Set the page instance to manage */
    public setPage(page: Page): void {
        this.page = page;
    }

    /** Get all common viewport presets */
    public static getCommonViewports(): ViewportSize[] {
        return [...this.COMMON_VIEWPORTS];
    }

    /** Get current viewport */
    public getCurrentViewport(): ViewportSize {
        return { ...this.currentViewport };
    }

    /** Set viewport by name */
    public async setViewportByName(name: string): Promise<void> {
        const viewport = ViewportManager.COMMON_VIEWPORTS.find(v => v.name === name);
        if (!viewport) {
            throw new Error(`Unknown viewport name: ${name}`);
        }
        await this.setViewport(viewport);
    }

    /** Set viewport with custom dimensions */
    public async setViewport(viewport: ViewportSize): Promise<void> {
        this.currentViewport = viewport;

        if (this.page) {
            await this.page.setViewportSize({
                width: viewport.width,
                height: viewport.height,
            });
            console.log(`[ViewportManager] Viewport set to ${viewport.name} (${viewport.width}x${viewport.height})`);
        }
    }

    /** Detect common breakpoints by analyzing layout changes */
    public async detectResponsiveBreakpoints(page: Page): Promise<ResponsiveBreakpoint[]> {
        const breakpoints: ResponsiveBreakpoint[] = [];
        const testWidths = [320, 480, 640, 768, 1024, 1280, 1440, 1920];

        let previousLayout: Map<string, ExtendedBoundingBox> = new Map();

        for (const width of testWidths) {
            await page.setViewportSize({ width, height: 800 });
            await page.waitForTimeout(100); // Allow reflow

            const currentLayout = await this.captureLayoutSnapshot(page);
            const changes = this.detectLayoutChanges(previousLayout, currentLayout);

            if (changes.length > 0) {
                breakpoints.push({
                    width,
                    name: this.getBreakpointName(width),
                    layoutChanges: changes,
                });
            }

            previousLayout = currentLayout;
        }

        // Restore original viewport
        await this.setViewport(this.currentViewport);

        return breakpoints;
    }

    /** Capture current layout positions */
    private async captureLayoutSnapshot(page: Page): Promise<Map<string, ExtendedBoundingBox>> {
        const snapshot = new Map<string, ExtendedBoundingBox>();

        const elements = await page.$$('body *');
        for (const element of elements) {
            const box = await element.boundingBox();
            if (box) {
                const id = await element.evaluate((el) => {
                    return el.id || el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '');
                });
                snapshot.set(id, this.extendBoundingBox(box));
            }
        }

        return snapshot;
    }

    /** Detect changes between two layout snapshots */
    private detectLayoutChanges(
        before: Map<string, ExtendedBoundingBox>,
        after: Map<string, ExtendedBoundingBox>
    ): LayoutChange[] {
        const changes: LayoutChange[] = [];

        for (const [id, afterBox] of after) {
            const beforeBox = before.get(id);
            if (beforeBox) {
                if (Math.abs(beforeBox.x - afterBox.x) > 10) {
                    changes.push({
                        elementId: id,
                        property: 'x',
                        beforeValue: String(beforeBox.x),
                        afterValue: String(afterBox.x),
                    });
                }
                if (Math.abs(beforeBox.width - afterBox.width) > 10) {
                    changes.push({
                        elementId: id,
                        property: 'width',
                        beforeValue: String(beforeBox.width),
                        afterValue: String(afterBox.width),
                    });
                }
            }
        }

        return changes;
    }

    /** Get human-readable breakpoint name */
    private getBreakpointName(width: number): string {
        if (width <= 480) return 'xs';
        if (width <= 640) return 'sm';
        if (width <= 768) return 'md';
        if (width <= 1024) return 'lg';
        if (width <= 1280) return 'xl';
        return '2xl';
    }

    /** Extend bounding box with computed properties */
    private extendBoundingBox(box: BoundingBox): ExtendedBoundingBox {
        return {
            ...box,
            centerX: box.x + box.width / 2,
            centerY: box.y + box.height / 2,
            right: box.x + box.width,
            bottom: box.y + box.height,
            area: box.width * box.height,
        };
    }

    /** Check if current viewport is mobile */
    public isMobile(): boolean {
        return this.currentViewport.isMobile ?? false;
    }

    /** Get device category */
    public getDeviceCategory(): 'mobile' | 'tablet' | 'desktop' {
        if (this.currentViewport.width < 768) return 'mobile';
        if (this.currentViewport.width < 1024) return 'tablet';
        return 'desktop';
    }
}

// ============================================================================
// AccessibilityMapper - Identify ARIA landmarks and accessibility features
// ============================================================================

export class AccessibilityMapper {
    /** Map ARIA roles to semantic region types */
    private static readonly ROLE_TO_REGION: Record<string, SemanticRegionType> = {
        'banner': 'header',
        'navigation': 'navigation',
        'main': 'main',
        'complementary': 'sidebar',
        'contentinfo': 'footer',
        'search': 'search',
        'form': 'form',
        'article': 'article',
        'aside': 'aside',
    };

    /** Map HTML5 semantic elements to region types */
    private static readonly ELEMENT_TO_REGION: Record<string, SemanticRegionType> = {
        'header': 'header',
        'nav': 'navigation',
        'main': 'main',
        'aside': 'sidebar',
        'footer': 'footer',
        'article': 'article',
        'form': 'form',
        'search': 'search',
    };

    /** Extract all ARIA landmarks from the page */
    public async extractLandmarks(page: Page): Promise<SemanticRegion[]> {
        const landmarks: SemanticRegion[] = [];

        // Query elements with ARIA roles
        const ariaElements = await page.$$('[role]');
        for (const element of ariaElements) {
            const landmark = await this.extractLandmarkFromElement(element);
            if (landmark) {
                landmarks.push(landmark);
            }
        }

        // Query HTML5 semantic elements
        const semanticSelectors = Object.keys(AccessibilityMapper.ELEMENT_TO_REGION);
        for (const selector of semanticSelectors) {
            const elements = await page.$$(selector);
            for (const element of elements) {
                const landmark = await this.extractLandmarkFromSemanticElement(element, selector);
                if (landmark && !this.isDuplicate(landmarks, landmark)) {
                    landmarks.push(landmark);
                }
            }
        }

        return landmarks;
    }

    /** Extract landmark info from element with ARIA role */
    private async extractLandmarkFromElement(element: ElementHandle): Promise<SemanticRegion | null> {
        try {
            const info = await element.evaluate((el) => {
                const role = el.getAttribute('role');
                const label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
                const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
                const rect = el.getBoundingClientRect();

                return {
                    role,
                    label,
                    heading: heading?.textContent?.trim() ?? null,
                    rect: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                    },
                    isVisible: rect.width > 0 && rect.height > 0,
                };
            });

            if (!info.role || !info.isVisible) return null;

            const regionType = AccessibilityMapper.ROLE_TO_REGION[info.role] ?? 'unknown';

            return {
                type: regionType,
                boundingBox: this.extendBoundingBox(info.rect),
                elements: [],
                confidence: 0.9,
                ariaLandmark: info.role as AriaLandmark,
                heading: info.heading ?? info.label ?? undefined,
            };
        } catch {
            return null;
        }
    }

    /** Extract landmark from HTML5 semantic element */
    private async extractLandmarkFromSemanticElement(
        element: ElementHandle,
        tagName: string
    ): Promise<SemanticRegion | null> {
        try {
            const info = await element.evaluate((el) => {
                const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
                const rect = el.getBoundingClientRect();
                const role = el.getAttribute('role');

                return {
                    heading: heading?.textContent?.trim() ?? null,
                    rect: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                    },
                    isVisible: rect.width > 0 && rect.height > 0,
                    explicitRole: role,
                };
            });

            if (!info.isVisible) return null;

            const regionType = AccessibilityMapper.ELEMENT_TO_REGION[tagName] ?? 'unknown';
            const ariaLandmark = this.inferAriaLandmark(tagName, info.explicitRole);

            return {
                type: regionType,
                boundingBox: this.extendBoundingBox(info.rect),
                elements: [],
                confidence: 0.8,
                ariaLandmark,
                heading: info.heading ?? undefined,
            };
        } catch {
            return null;
        }
    }

    /** Infer ARIA landmark from element */
    private inferAriaLandmark(tagName: string, explicitRole: string | null): AriaLandmark {
        if (explicitRole) {
            return explicitRole as AriaLandmark;
        }

        const mapping: Record<string, AriaLandmark> = {
            'header': 'banner',
            'nav': 'navigation',
            'main': 'main',
            'aside': 'complementary',
            'footer': 'contentinfo',
            'form': 'form',
            'search': 'search',
        };

        return mapping[tagName] ?? 'region';
    }

    /** Check if landmark is duplicate */
    private isDuplicate(landmarks: SemanticRegion[], newLandmark: SemanticRegion): boolean {
        return landmarks.some(l =>
            l.type === newLandmark.type &&
            Math.abs(l.boundingBox.x - newLandmark.boundingBox.x) < 5 &&
            Math.abs(l.boundingBox.y - newLandmark.boundingBox.y) < 5
        );
    }

    /** Extract accessibility tree summary */
    public async extractAccessibilityTree(page: Page): Promise<Record<string, unknown>> {
        return await page.accessibility.snapshot() ?? {};
    }

    /** Check for common accessibility issues */
    public async auditAccessibility(page: Page): Promise<{
        missingAltText: number;
        missingLabels: number;
        lowContrastElements: number;
        missingLandmarks: boolean;
    }> {
        const audit = await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const missingAlt = Array.from(images).filter(img => !img.alt).length;

            const inputs = document.querySelectorAll('input, textarea, select');
            const missingLabels = Array.from(inputs).filter(input => {
                const id = input.id;
                if (!id) return true;
                return !document.querySelector(`label[for="${id}"]`);
            }).length;

            const hasMain = !!document.querySelector('main, [role="main"]');
            const hasNav = !!document.querySelector('nav, [role="navigation"]');

            return {
                missingAltText: missingAlt,
                missingLabels,
                lowContrastElements: 0, // Would require color analysis
                missingLandmarks: !hasMain || !hasNav,
            };
        });

        return audit;
    }

    /** Extend bounding box with computed properties */
    private extendBoundingBox(box: BoundingBox): ExtendedBoundingBox {
        return {
            ...box,
            centerX: box.x + box.width / 2,
            centerY: box.y + box.height / 2,
            right: box.x + box.width,
            bottom: box.y + box.height,
            area: box.width * box.height,
        };
    }
}

// ============================================================================
// LayoutAnalyzer - Detect page regions using visual/DOM analysis
// ============================================================================

export class LayoutAnalyzer {
    private accessibilityMapper: AccessibilityMapper;

    constructor() {
        this.accessibilityMapper = new AccessibilityMapper();
    }

    /** Analyze page layout and identify semantic regions */
    public async analyzeLayout(page: Page): Promise<SemanticRegion[]> {
        const regions: SemanticRegion[] = [];

        // Get accessibility landmarks first
        const landmarks = await this.accessibilityMapper.extractLandmarks(page);
        regions.push(...landmarks);

        // Detect additional regions using heuristics
        const heuristicRegions = await this.detectRegionsHeuristically(page);

        // Merge and deduplicate
        for (const region of heuristicRegions) {
            if (!this.isOverlapping(regions, region)) {
                regions.push(region);
            }
        }

        // Sort by vertical position
        regions.sort((a, b) => a.boundingBox.y - b.boundingBox.y);

        return regions;
    }

    /** Detect regions using visual heuristics */
    private async detectRegionsHeuristically(page: Page): Promise<SemanticRegion[]> {
        const regions: SemanticRegion[] = [];
        const viewport = page.viewportSize();
        if (!viewport) return regions;

        // Detect header (typically at top, full width)
        const headerRegion = await this.detectHeaderRegion(page, viewport);
        if (headerRegion) regions.push(headerRegion);

        // Detect footer (typically at bottom, full width)
        const footerRegion = await this.detectFooterRegion(page, viewport);
        if (footerRegion) regions.push(footerRegion);

        // Detect navigation (horizontal menus, typically near header)
        const navRegions = await this.detectNavigationRegions(page);
        regions.push(...navRegions);

        // Detect sidebar (narrow column, typically left or right)
        const sidebarRegions = await this.detectSidebarRegions(page, viewport);
        regions.push(...sidebarRegions);

        // Detect main content area
        const mainRegion = await this.detectMainContentRegion(page, viewport, regions);
        if (mainRegion) regions.push(mainRegion);

        // Detect search regions
        const searchRegions = await this.detectSearchRegions(page);
        regions.push(...searchRegions);

        return regions;
    }

    /** Detect header region */
    private async detectHeaderRegion(
        page: Page,
        viewport: { width: number; height: number }
    ): Promise<SemanticRegion | null> {
        const candidates = await page.$$('div, section');

        for (const candidate of candidates) {
            const box = await candidate.boundingBox();
            if (!box) continue;

            // Header heuristics: near top, wide, not too tall
            if (
                box.y < 100 &&
                box.width > viewport.width * 0.8 &&
                box.height < viewport.height * 0.3 &&
                box.height > 30
            ) {
                const hasLogo = await candidate.$('img, svg, [class*="logo"]');
                const hasNav = await candidate.$('nav, ul, [class*="nav"], [class*="menu"]');

                if (hasLogo || hasNav) {
                    return {
                        type: 'header',
                        boundingBox: this.extendBoundingBox(box),
                        elements: [],
                        confidence: 0.7,
                        ariaLandmark: 'banner',
                    };
                }
            }
        }

        return null;
    }

    /** Detect footer region */
    private async detectFooterRegion(
        page: Page,
        viewport: { width: number; height: number }
    ): Promise<SemanticRegion | null> {
        // Get page height
        const pageHeight = await page.evaluate(() => document.body.scrollHeight);

        const candidates = await page.$$('div, section');

        for (const candidate of candidates) {
            const box = await candidate.boundingBox();
            if (!box) continue;

            // Footer heuristics: near bottom, wide
            if (
                box.y + box.height > pageHeight - 200 &&
                box.width > viewport.width * 0.8 &&
                box.height < viewport.height * 0.4
            ) {
                const hasCopyright = await candidate.evaluate((el) =>
                    el.textContent?.toLowerCase().includes('copyright') ||
                    el.textContent?.includes('©') ||
                    el.textContent?.toLowerCase().includes('all rights reserved')
                );

                const hasLinks = await candidate.$$('a');

                if (hasCopyright || hasLinks.length > 3) {
                    return {
                        type: 'footer',
                        boundingBox: this.extendBoundingBox(box),
                        elements: [],
                        confidence: 0.7,
                        ariaLandmark: 'contentinfo',
                    };
                }
            }
        }

        return null;
    }

    /** Detect navigation regions */
    private async detectNavigationRegions(page: Page): Promise<SemanticRegion[]> {
        const regions: SemanticRegion[] = [];

        // Look for elements with nav-like classes or containing multiple links
        const candidates = await page.$$('[class*="nav"], [class*="menu"], ul');

        for (const candidate of candidates) {
            const box = await candidate.boundingBox();
            if (!box || box.width < 100 || box.height < 20) continue;

            const linkCount = await candidate.$$eval('a', links => links.length);

            if (linkCount >= 3) {
                // Check if horizontal (likely main nav) or vertical (likely sidebar nav)
                const isHorizontal = box.width > box.height * 2;

                regions.push({
                    type: 'navigation',
                    boundingBox: this.extendBoundingBox(box),
                    elements: [],
                    confidence: 0.6,
                    ariaLandmark: 'navigation',
                    heading: isHorizontal ? 'Main Navigation' : 'Side Navigation',
                });
            }
        }

        return regions;
    }

    /** Detect sidebar regions */
    private async detectSidebarRegions(
        page: Page,
        viewport: { width: number; height: number }
    ): Promise<SemanticRegion[]> {
        const regions: SemanticRegion[] = [];

        const candidates = await page.$$('[class*="sidebar"], [class*="aside"], aside');

        for (const candidate of candidates) {
            const box = await candidate.boundingBox();
            if (!box) continue;

            // Sidebar heuristics: narrow, tall, on left or right edge
            const isNarrow = box.width < viewport.width * 0.35;
            const isTall = box.height > viewport.height * 0.3;
            const isOnEdge = box.x < 50 || box.x + box.width > viewport.width - 50;

            if (isNarrow && isTall && isOnEdge) {
                regions.push({
                    type: 'sidebar',
                    boundingBox: this.extendBoundingBox(box),
                    elements: [],
                    confidence: 0.6,
                    ariaLandmark: 'complementary',
                });
            }
        }

        return regions;
    }

    /** Detect main content region */
    private async detectMainContentRegion(
        page: Page,
        viewport: { width: number; height: number },
        existingRegions: SemanticRegion[]
    ): Promise<SemanticRegion | null> {
        // Look for content indicators
        const candidates = await page.$$('article, [class*="content"], [class*="main"], [id*="content"], [id*="main"]');

        for (const candidate of candidates) {
            const box = await candidate.boundingBox();
            if (!box) continue;

            // Main content heuristics: large area, contains text
            const textLength = await candidate.evaluate((el) => el.textContent?.length ?? 0);

            if (
                box.width > viewport.width * 0.4 &&
                box.height > viewport.height * 0.3 &&
                textLength > 200
            ) {
                // Check it doesn't overlap significantly with header/footer
                const overlapsOther = existingRegions.some(r =>
                    r.type !== 'main' && this.calculateOverlap(box, r.boundingBox) > 0.5
                );

                if (!overlapsOther) {
                    return {
                        type: 'main',
                        boundingBox: this.extendBoundingBox(box),
                        elements: [],
                        confidence: 0.65,
                        ariaLandmark: 'main',
                    };
                }
            }
        }

        return null;
    }

    /** Detect search regions */
    private async detectSearchRegions(page: Page): Promise<SemanticRegion[]> {
        const regions: SemanticRegion[] = [];

        const searchInputs = await page.$$('input[type="search"], [class*="search"], [id*="search"], [role="search"]');

        for (const input of searchInputs) {
            const box = await input.boundingBox();
            if (!box) continue;

            // Find parent container
            const parentBox = await input.evaluate((el) => {
                const parent = el.closest('form, div, section');
                if (parent) {
                    const rect = parent.getBoundingClientRect();
                    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
                }
                return null;
            });

            const regionBox = parentBox ?? box;

            regions.push({
                type: 'search',
                boundingBox: this.extendBoundingBox(regionBox),
                elements: [],
                confidence: 0.8,
                ariaLandmark: 'search',
            });
        }

        return regions;
    }

    /** Check if new region significantly overlaps existing ones */
    private isOverlapping(existing: SemanticRegion[], newRegion: SemanticRegion): boolean {
        return existing.some(r => this.calculateOverlap(r.boundingBox, newRegion.boundingBox) > 0.7);
    }

    /** Calculate overlap ratio between two bounding boxes */
    private calculateOverlap(a: BoundingBox, b: BoundingBox): number {
        const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        const overlapArea = xOverlap * yOverlap;
        const smallerArea = Math.min(a.width * a.height, b.width * b.height);
        return smallerArea > 0 ? overlapArea / smallerArea : 0;
    }

    /** Extend bounding box with computed properties */
    private extendBoundingBox(box: BoundingBox): ExtendedBoundingBox {
        return {
            ...box,
            centerX: box.x + box.width / 2,
            centerY: box.y + box.height / 2,
            right: box.x + box.width,
            bottom: box.y + box.height,
            area: box.width * box.height,
        };
    }
}

// ============================================================================
// ElementGraph - Map spatial relationships between elements
// ============================================================================

export class ElementGraph {
    private elements: Map<string, ElementInfo> = new Map();
    private relationships: ElementRelationship[] = [];
    private spatialIndex: Map<string, Set<string>> = new Map();

    /** Clear the graph */
    public clear(): void {
        this.elements.clear();
        this.relationships = [];
        this.spatialIndex.clear();
    }

    /** Add an element to the graph */
    public addElement(element: ElementInfo): void {
        this.elements.set(element.id, element);
    }

    /** Build relationships between all elements */
    public buildRelationships(): void {
        this.relationships = [];
        const elementArray = Array.from(this.elements.values());

        for (let i = 0; i < elementArray.length; i++) {
            const source = elementArray[i];
            if (!source) continue;

            for (let j = i + 1; j < elementArray.length; j++) {
                const target = elementArray[j];
                if (!target) continue;

                const relations = this.computeRelations(source, target);
                this.relationships.push(...relations);
            }
        }

        this.buildSpatialIndex();
    }

    /** Compute spatial relations between two elements */
    private computeRelations(source: ElementInfo, target: ElementInfo): ElementRelationship[] {
        const relations: ElementRelationship[] = [];
        const srcBox = source.boundingBox;
        const tgtBox = target.boundingBox;

        // Calculate distance between centers
        const distance = Math.sqrt(
            Math.pow(srcBox.centerX - tgtBox.centerX, 2) +
            Math.pow(srcBox.centerY - tgtBox.centerY, 2)
        );

        // Determine primary spatial relation
        const relation = this.determinePrimaryRelation(srcBox, tgtBox);

        relations.push({
            sourceId: source.id,
            targetId: target.id,
            relation,
            distance,
            isParentChild: this.checkParentChild(source, target),
            isSibling: this.checkSibling(source, target),
        });

        // Add "near" relation if within proximity threshold
        const proximityThreshold = 100;
        if (distance < proximityThreshold && relation !== 'inside' && relation !== 'contains') {
            relations.push({
                sourceId: source.id,
                targetId: target.id,
                relation: 'near',
                distance,
                isParentChild: false,
                isSibling: false,
            });
        }

        return relations;
    }

    /** Determine primary spatial relation */
    private determinePrimaryRelation(src: ExtendedBoundingBox, tgt: ExtendedBoundingBox): SpatialRelation {
        // Check containment
        if (this.isInside(src, tgt)) return 'inside';
        if (this.isInside(tgt, src)) return 'contains';

        // Check overlap
        if (this.overlaps(src, tgt)) return 'overlaps';

        // Determine directional relation
        const horizontalGap = Math.min(
            Math.abs(src.right - tgt.x),
            Math.abs(tgt.right - src.x)
        );
        const verticalGap = Math.min(
            Math.abs(src.bottom - tgt.y),
            Math.abs(tgt.bottom - src.y)
        );

        // Check adjacency
        if (horizontalGap < 10 || verticalGap < 10) {
            if (src.centerY < tgt.centerY) return 'above';
            if (src.centerY > tgt.centerY) return 'below';
            if (src.centerX < tgt.centerX) return 'left-of';
            return 'right-of';
        }

        // Determine primary direction
        const horizontalDiff = tgt.centerX - src.centerX;
        const verticalDiff = tgt.centerY - src.centerY;

        if (Math.abs(verticalDiff) > Math.abs(horizontalDiff)) {
            return verticalDiff > 0 ? 'above' : 'below';
        } else {
            return horizontalDiff > 0 ? 'left-of' : 'right-of';
        }
    }

    /** Check if a is inside b */
    private isInside(a: ExtendedBoundingBox, b: ExtendedBoundingBox): boolean {
        return (
            a.x >= b.x &&
            a.y >= b.y &&
            a.right <= b.right &&
            a.bottom <= b.bottom
        );
    }

    /** Check if boxes overlap */
    private overlaps(a: ExtendedBoundingBox, b: ExtendedBoundingBox): boolean {
        return !(
            a.right < b.x ||
            b.right < a.x ||
            a.bottom < b.y ||
            b.bottom < a.y
        );
    }

    /** Check parent-child relationship (based on DOM structure in xpath) */
    private checkParentChild(a: ElementInfo, b: ElementInfo): boolean {
        return a.xpath.startsWith(b.xpath) || b.xpath.startsWith(a.xpath);
    }

    /** Check if elements are siblings */
    private checkSibling(a: ElementInfo, b: ElementInfo): boolean {
        const aParent = a.xpath.substring(0, a.xpath.lastIndexOf('/'));
        const bParent = b.xpath.substring(0, b.xpath.lastIndexOf('/'));
        return aParent === bParent;
    }

    /** Build spatial index for fast lookups */
    private buildSpatialIndex(): void {
        this.spatialIndex.clear();

        for (const rel of this.relationships) {
            // Index by source
            if (!this.spatialIndex.has(rel.sourceId)) {
                this.spatialIndex.set(rel.sourceId, new Set());
            }
            this.spatialIndex.get(rel.sourceId)!.add(rel.targetId);

            // Index by target
            if (!this.spatialIndex.has(rel.targetId)) {
                this.spatialIndex.set(rel.targetId, new Set());
            }
            this.spatialIndex.get(rel.targetId)!.add(rel.sourceId);
        }
    }

    /** Get all relationships */
    public getRelationships(): ElementRelationship[] {
        return [...this.relationships];
    }

    /** Find elements related to a given element */
    public findRelatedElements(elementId: string, relation?: SpatialRelation): ElementInfo[] {
        const related = this.relationships
            .filter(r =>
                (r.sourceId === elementId || r.targetId === elementId) &&
                (!relation || r.relation === relation)
            )
            .map(r => r.sourceId === elementId ? r.targetId : r.sourceId);

        return related
            .map(id => this.elements.get(id))
            .filter((el): el is ElementInfo => el !== undefined);
    }

    /** Find elements near a given element */
    public findNearbyElements(elementId: string, maxDistance: number = 100): ElementInfo[] {
        return this.relationships
            .filter(r =>
                (r.sourceId === elementId || r.targetId === elementId) &&
                r.distance < maxDistance
            )
            .map(r => r.sourceId === elementId ? r.targetId : r.sourceId)
            .map(id => this.elements.get(id))
            .filter((el): el is ElementInfo => el !== undefined);
    }

    /** Find element by relative position */
    public findElementByPosition(
        referenceId: string,
        relation: SpatialRelation
    ): ElementInfo | null {
        const matches = this.relationships
            .filter(r => r.sourceId === referenceId && r.relation === relation)
            .sort((a, b) => a.distance - b.distance);

        const nearest = matches[0];
        if (!nearest) return null;

        return this.elements.get(nearest.targetId) ?? null;
    }

    /** Get visual hierarchy from element relationships */
    public buildVisualHierarchy(): VisualHierarchyNode[] {
        const roots: VisualHierarchyNode[] = [];
        const processed = new Set<string>();

        // Find root elements (not contained by others)
        const containedIds = new Set(
            this.relationships
                .filter(r => r.relation === 'inside')
                .map(r => r.sourceId)
        );

        const rootElements = Array.from(this.elements.values())
            .filter(el => !containedIds.has(el.id))
            .sort((a, b) => b.boundingBox.area - a.boundingBox.area);

        for (const element of rootElements) {
            if (processed.has(element.id)) continue;

            const node = this.buildHierarchyNode(element, 0, processed);
            roots.push(node);
        }

        return roots;
    }

    /** Build hierarchy node recursively */
    private buildHierarchyNode(
        element: ElementInfo,
        depth: number,
        processed: Set<string>
    ): VisualHierarchyNode {
        processed.add(element.id);

        // Find children (elements this one contains)
        const containedRels = this.relationships
            .filter(r => r.sourceId === element.id && r.relation === 'contains');

        const children: VisualHierarchyNode[] = [];
        for (const rel of containedRels) {
            const childElement = this.elements.get(rel.targetId);
            if (childElement && !processed.has(childElement.id)) {
                children.push(this.buildHierarchyNode(childElement, depth + 1, processed));
            }
        }

        // Calculate visual weight based on area and position
        const visualWeight = this.calculateVisualWeight(element);

        return {
            element,
            children: children.sort((a, b) => b.visualWeight - a.visualWeight),
            depth,
            visualWeight,
        };
    }

    /** Calculate visual weight/importance of element */
    private calculateVisualWeight(element: ElementInfo): number {
        let weight = 0;

        // Larger elements have more weight
        weight += Math.log(element.boundingBox.area + 1) * 10;

        // Interactive elements are more important
        if (element.isInteractive) weight += 30;

        // Elements with ARIA roles are important
        if (element.ariaRole) weight += 20;

        // Headings have high weight
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tagName.toLowerCase())) {
            weight += 50 - parseInt(element.tagName[1] ?? '3') * 5;
        }

        // Above-the-fold elements get boost
        if (element.boundingBox.y < 600) weight += 15;

        return weight;
    }

    /** Get element by ID */
    public getElement(id: string): ElementInfo | undefined {
        return this.elements.get(id);
    }

    /** Get all elements */
    public getAllElements(): ElementInfo[] {
        return Array.from(this.elements.values());
    }
}

// ============================================================================
// NaturalLanguageLocator - Find elements from natural language descriptions
// ============================================================================

export class NaturalLanguageLocator {
    private elementGraph: ElementGraph;

    /** Common element type keywords */
    private static readonly ELEMENT_KEYWORDS: Record<string, string[]> = {
        button: ['button', 'btn', 'click', 'submit', 'press'],
        link: ['link', 'anchor', 'href', 'go to', 'navigate'],
        input: ['input', 'field', 'textbox', 'enter', 'type', 'fill'],
        image: ['image', 'img', 'picture', 'photo', 'icon'],
        heading: ['heading', 'title', 'header', 'h1', 'h2', 'h3'],
        menu: ['menu', 'dropdown', 'navigation', 'nav'],
        search: ['search', 'find', 'lookup', 'query'],
        form: ['form', 'signup', 'login', 'register', 'submit'],
    };

    /** Position keywords */
    private static readonly POSITION_KEYWORDS: Record<SpatialRelation, string[]> = {
        'above': ['above', 'over', 'top of', 'before'],
        'below': ['below', 'under', 'beneath', 'after', 'underneath'],
        'left-of': ['left of', 'to the left', 'before'],
        'right-of': ['right of', 'to the right', 'after'],
        'inside': ['in', 'inside', 'within', 'contained'],
        'contains': ['containing', 'with', 'has'],
        'near': ['near', 'close to', 'beside', 'next to', 'by'],
        'adjacent-to': ['adjacent', 'touching', 'connected'],
        'overlaps': ['overlapping', 'over'],
    };

    /** Region keywords */
    private static readonly REGION_KEYWORDS: Record<SemanticRegionType, string[]> = {
        header: ['header', 'top', 'banner'],
        navigation: ['navigation', 'nav', 'menu', 'navbar'],
        main: ['main', 'content', 'body', 'article'],
        sidebar: ['sidebar', 'side', 'aside'],
        footer: ['footer', 'bottom'],
        search: ['search'],
        form: ['form'],
        article: ['article', 'post', 'story'],
        aside: ['aside'],
        banner: ['banner'],
        complementary: ['complementary'],
        contentinfo: ['contentinfo'],
        unknown: [],
    };

    constructor(elementGraph: ElementGraph) {
        this.elementGraph = elementGraph;
    }

    /** Find elements matching natural language description */
    public find(description: string): NaturalLanguageMatch[] {
        const normalizedDesc = description.toLowerCase().trim();
        const tokens = this.tokenize(normalizedDesc);

        // Parse the description
        const parsed = this.parseDescription(normalizedDesc, tokens);

        // Get candidate elements
        const elements = this.elementGraph.getAllElements();

        // Score each element
        const matches: NaturalLanguageMatch[] = [];

        for (const element of elements) {
            const match = this.scoreElement(element, parsed);
            if (match.score > 0.3) {
                matches.push(match);
            }
        }

        // Sort by score descending
        matches.sort((a, b) => b.score - a.score);

        return matches;
    }

    /** Find the best matching element */
    public findBest(description: string): NaturalLanguageMatch | null {
        const matches = this.find(description);
        return matches[0] ?? null;
    }

    /** Tokenize description */
    private tokenize(text: string): string[] {
        return text
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 0);
    }

    /** Parse natural language description */
    private parseDescription(description: string, tokens: string[]): ParsedDescription {
        const result: ParsedDescription = {
            elementType: null,
            textContent: null,
            position: null,
            referenceElement: null,
            region: null,
            attributes: {},
        };

        // Detect element type
        for (const [type, keywords] of Object.entries(NaturalLanguageLocator.ELEMENT_KEYWORDS)) {
            for (const keyword of keywords) {
                if (description.includes(keyword)) {
                    result.elementType = type;
                    break;
                }
            }
            if (result.elementType) break;
        }

        // Detect position relation
        for (const [relation, keywords] of Object.entries(NaturalLanguageLocator.POSITION_KEYWORDS)) {
            for (const keyword of keywords) {
                if (description.includes(keyword)) {
                    result.position = relation as SpatialRelation;

                    // Try to extract reference element
                    const afterKeyword = description.split(keyword)[1]?.trim();
                    if (afterKeyword) {
                        result.referenceElement = afterKeyword.split(/\s+/).slice(0, 3).join(' ');
                    }
                    break;
                }
            }
            if (result.position) break;
        }

        // Detect region
        for (const [region, keywords] of Object.entries(NaturalLanguageLocator.REGION_KEYWORDS)) {
            for (const keyword of keywords) {
                if (description.includes(keyword)) {
                    result.region = region as SemanticRegionType;
                    break;
                }
            }
            if (result.region) break;
        }

        // Extract quoted text content
        const quotedMatch = description.match(/"([^"]+)"|'([^']+)'/);
        if (quotedMatch) {
            result.textContent = quotedMatch[1] ?? quotedMatch[2] ?? null;
        }

        // Extract color references
        const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple'];
        for (const color of colors) {
            if (description.includes(color)) {
                result.attributes['color'] = color;
                break;
            }
        }

        return result;
    }

    /** Score an element against parsed description */
    private scoreElement(element: ElementInfo, parsed: ParsedDescription): NaturalLanguageMatch {
        let score = 0;
        const matchedTerms: string[] = [];
        const reasonParts: string[] = [];

        // Score element type match
        if (parsed.elementType) {
            const typeScore = this.scoreElementType(element, parsed.elementType);
            score += typeScore * 0.3;
            if (typeScore > 0) {
                matchedTerms.push(parsed.elementType);
                reasonParts.push(`Matched element type: ${parsed.elementType}`);
            }
        }

        // Score text content match
        if (parsed.textContent) {
            const textScore = this.scoreTextContent(element, parsed.textContent);
            score += textScore * 0.4;
            if (textScore > 0) {
                matchedTerms.push(parsed.textContent);
                reasonParts.push(`Matched text content: "${parsed.textContent}"`);
            }
        }

        // Score position relation
        if (parsed.position && parsed.referenceElement) {
            const positionScore = this.scorePosition(element, parsed.position, parsed.referenceElement);
            score += positionScore * 0.2;
            if (positionScore > 0) {
                matchedTerms.push(parsed.position);
                reasonParts.push(`Matched position: ${parsed.position} ${parsed.referenceElement}`);
            }
        }

        // Score region match
        if (parsed.region && element.semanticType === parsed.region) {
            score += 0.1;
            matchedTerms.push(parsed.region);
            reasonParts.push(`In region: ${parsed.region}`);
        }

        // Boost for visibility and interactivity
        if (element.isVisible) score *= 1.1;
        if (element.isInteractive) score *= 1.2;

        return {
            element,
            score: Math.min(score, 1),
            matchedTerms,
            reasoning: reasonParts.join('; ') || 'No direct matches',
        };
    }

    /** Score element type match */
    private scoreElementType(element: ElementInfo, targetType: string): number {
        const tagName = element.tagName.toLowerCase();
        const className = element.className.toLowerCase();
        const role = element.ariaRole?.toLowerCase() ?? '';

        const typeIndicators: Record<string, string[]> = {
            button: ['button', 'btn'],
            link: ['a'],
            input: ['input', 'textarea'],
            image: ['img', 'svg'],
            heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
            menu: ['nav', 'ul', 'menu'],
            search: ['search'],
            form: ['form'],
        };

        const indicators = typeIndicators[targetType] ?? [];

        // Check tag name
        if (indicators.includes(tagName)) return 1;

        // Check class name
        for (const indicator of indicators) {
            if (className.includes(indicator)) return 0.8;
        }

        // Check role
        for (const indicator of indicators) {
            if (role.includes(indicator)) return 0.9;
        }

        return 0;
    }

    /** Score text content match */
    private scoreTextContent(element: ElementInfo, targetText: string): number {
        const elementText = element.textContent.toLowerCase();
        const ariaLabel = element.ariaLabel?.toLowerCase() ?? '';
        const normalizedTarget = targetText.toLowerCase();

        // Exact match
        if (elementText === normalizedTarget || ariaLabel === normalizedTarget) {
            return 1;
        }

        // Contains match
        if (elementText.includes(normalizedTarget) || ariaLabel.includes(normalizedTarget)) {
            return 0.8;
        }

        // Word overlap
        const targetWords = normalizedTarget.split(/\s+/);
        const elementWords = (elementText + ' ' + ariaLabel).split(/\s+/);
        const matchCount = targetWords.filter(t => elementWords.some(e => e.includes(t))).length;

        return matchCount / targetWords.length * 0.6;
    }

    /** Score position relation */
    private scorePosition(
        element: ElementInfo,
        relation: SpatialRelation,
        referenceDescription: string
    ): number {
        // Find the reference element
        const refMatch = this.findBestByText(referenceDescription);
        if (!refMatch) return 0;

        // Check spatial relation
        const relatedElements = this.elementGraph.findRelatedElements(refMatch.id, relation);

        if (relatedElements.some(e => e.id === element.id)) {
            return 1;
        }

        // Check if near the reference
        const nearbyElements = this.elementGraph.findNearbyElements(refMatch.id, 150);
        if (nearbyElements.some(e => e.id === element.id)) {
            return 0.5;
        }

        return 0;
    }

    /** Find best element by text content only */
    private findBestByText(text: string): ElementInfo | null {
        const elements = this.elementGraph.getAllElements();
        const normalizedText = text.toLowerCase();

        let best: ElementInfo | null = null;
        let bestScore = 0;

        for (const element of elements) {
            const score = this.scoreTextContent(element, normalizedText);
            if (score > bestScore) {
                bestScore = score;
                best = element;
            }
        }

        return best;
    }

    /** Generate locator suggestions for an element */
    public generateLocatorSuggestions(element: ElementInfo): string[] {
        const suggestions: string[] = [];

        // By ID
        if (element.id) {
            suggestions.push(`the element with id "${element.id}"`);
        }

        // By text content
        if (element.textContent.trim()) {
            const text = element.textContent.trim().substring(0, 50);
            suggestions.push(`the ${element.tagName.toLowerCase()} that says "${text}"`);
        }

        // By ARIA label
        if (element.ariaLabel) {
            suggestions.push(`the ${element.tagName.toLowerCase()} labeled "${element.ariaLabel}"`);
        }

        // By type and position
        const nearby = this.elementGraph.findNearbyElements(element.id, 100);
        if (nearby.length > 0) {
            const ref = nearby[0];
            if (ref) {
                const refText = ref.textContent.substring(0, 30);
                suggestions.push(`the ${element.tagName.toLowerCase()} near "${refText}"`);
            }
        }

        return suggestions;
    }
}

/** Parsed description structure */
interface ParsedDescription {
    elementType: string | null;
    textContent: string | null;
    position: SpatialRelation | null;
    referenceElement: string | null;
    region: SemanticRegionType | null;
    attributes: Record<string, string>;
}

// ============================================================================
// SpatialWebAwareness - Main orchestrating class
// ============================================================================

export class SpatialWebAwareness {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private layoutAnalyzer: LayoutAnalyzer;
    private elementGraph: ElementGraph;
    private naturalLanguageLocator: NaturalLanguageLocator;
    private viewportManager: ViewportManager;
    private accessibilityMapper: AccessibilityMapper;
    private lastAnalysis: PageAnalysis | null = null;

    constructor() {
        this.layoutAnalyzer = new LayoutAnalyzer();
        this.elementGraph = new ElementGraph();
        this.naturalLanguageLocator = new NaturalLanguageLocator(this.elementGraph);
        this.viewportManager = new ViewportManager();
        this.accessibilityMapper = new AccessibilityMapper();
    }

    /** Initialize browser if not already */
    private async ensureBrowser(): Promise<void> {
        if (!this.browser) {
            console.log('[SpatialWebAwareness] Launching browser...');
            this.browser = await chromium.launch({ headless: true });
            this.context = await this.browser.newContext();
        }
    }

    /** Analyze a page and build spatial awareness */
    public async analyze(page: Page): Promise<PageAnalysis> {
        console.log('[SpatialWebAwareness] Starting page analysis...');

        // Set up viewport manager
        this.viewportManager.setPage(page);

        // Clear previous analysis
        this.elementGraph.clear();

        // Get page info
        const url = page.url();
        const title = await page.title();
        const viewport = this.viewportManager.getCurrentViewport();

        // Extract all interactive and visible elements
        console.log('[SpatialWebAwareness] Extracting elements...');
        const elements = await this.extractElements(page);

        // Add elements to graph
        for (const element of elements) {
            this.elementGraph.addElement(element);
        }

        // Build relationships
        console.log('[SpatialWebAwareness] Building element relationships...');
        this.elementGraph.buildRelationships();

        // Analyze layout regions
        console.log('[SpatialWebAwareness] Analyzing layout regions...');
        const regions = await this.layoutAnalyzer.analyzeLayout(page);

        // Get accessibility landmarks
        console.log('[SpatialWebAwareness] Extracting accessibility landmarks...');
        const accessibilityLandmarks = await this.accessibilityMapper.extractLandmarks(page);

        // Build visual hierarchy
        const visualHierarchy = this.elementGraph.buildVisualHierarchy();

        // Get relationships
        const relationships = this.elementGraph.getRelationships();

        // Detect responsive breakpoints (optional, can be slow)
        const responsiveBreakpoints: ResponsiveBreakpoint[] = [];

        const analysis: PageAnalysis = {
            url,
            title,
            viewport,
            timestamp: new Date(),
            regions,
            elements,
            relationships,
            accessibilityLandmarks,
            visualHierarchy,
            responsiveBreakpoints,
        };

        this.lastAnalysis = analysis;
        console.log(`[SpatialWebAwareness] Analysis complete: ${elements.length} elements, ${regions.length} regions, ${relationships.length} relationships`);

        return analysis;
    }

    /** Analyze a URL directly */
    public async analyzeUrl(url: string): Promise<PageAnalysis> {
        await this.ensureBrowser();

        const page = await this.context!.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            return await this.analyze(page);
        } finally {
            await page.close();
        }
    }

    /** Extract all relevant elements from the page */
    private async extractElements(page: Page): Promise<ElementInfo[]> {
        const elements: ElementInfo[] = [];

        // Query selector for interactive and important elements
        const selectors = [
            'a', 'button', 'input', 'textarea', 'select',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'img', 'video', 'audio',
            'nav', 'header', 'footer', 'main', 'aside', 'article',
            'form', 'label',
            '[role]', '[aria-label]', '[data-testid]',
            '[onclick]', '[tabindex]',
        ];

        const handles = await page.$$(selectors.join(', '));
        let idCounter = 0;

        for (const handle of handles) {
            try {
                const info = await this.extractElementInfo(handle, idCounter++);
                if (info && info.isVisible) {
                    elements.push(info);
                }
            } catch {
                // Element may have been removed from DOM
            }
        }

        return elements;
    }

    /** Extract detailed information from an element */
    private async extractElementInfo(handle: ElementHandle, index: number): Promise<ElementInfo | null> {
        try {
            const info = await handle.evaluate((el, idx) => {
                const rect = el.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(el);

                // Generate simple xpath
                const getXPath = (element: Element): string => {
                    if (element.id) return `//*[@id="${element.id}"]`;

                    const parts: string[] = [];
                    let current: Element | null = element;

                    while (current && current.nodeType === Node.ELEMENT_NODE) {
                        let index = 1;
                        let sibling: Element | null = current.previousElementSibling;

                        while (sibling) {
                            if (sibling.nodeName === current.nodeName) index++;
                            sibling = sibling.previousElementSibling;
                        }

                        parts.unshift(`${current.nodeName.toLowerCase()}[${index}]`);
                        current = current.parentElement;
                    }

                    return '/' + parts.join('/');
                };

                // Generate CSS selector
                const getSelector = (element: Element): string => {
                    if (element.id) return `#${element.id}`;

                    let selector = element.tagName.toLowerCase();
                    if (element.className && typeof element.className === 'string') {
                        selector += '.' + element.className.trim().split(/\s+/).join('.');
                    }

                    return selector;
                };

                // Determine semantic type
                const determineSemanticType = (el: Element): string => {
                    const tag = el.tagName.toLowerCase();
                    const role = el.getAttribute('role');

                    if (role) {
                        const roleMap: Record<string, string> = {
                            'banner': 'header',
                            'navigation': 'navigation',
                            'main': 'main',
                            'complementary': 'sidebar',
                            'contentinfo': 'footer',
                            'search': 'search',
                            'form': 'form',
                        };
                        return roleMap[role] ?? 'unknown';
                    }

                    const tagMap: Record<string, string> = {
                        'header': 'header',
                        'nav': 'navigation',
                        'main': 'main',
                        'aside': 'sidebar',
                        'footer': 'footer',
                        'form': 'form',
                        'article': 'article',
                    };

                    return tagMap[tag] ?? 'unknown';
                };

                // Check if interactive
                const isInteractive =
                    ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
                    el.hasAttribute('onclick') ||
                    el.hasAttribute('tabindex') ||
                    el.getAttribute('role') === 'button' ||
                    el.getAttribute('role') === 'link';

                // Get all attributes
                const attributes: Record<string, string> = {};
                for (const attr of Array.from(el.attributes)) {
                    attributes[attr.name] = attr.value;
                }

                return {
                    id: el.id || `element-${idx}`,
                    tagName: el.tagName,
                    className: typeof el.className === 'string' ? el.className : '',
                    textContent: el.textContent?.trim().substring(0, 100) ?? '',
                    ariaLabel: el.getAttribute('aria-label'),
                    ariaRole: el.getAttribute('role'),
                    boundingBox: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        centerX: rect.x + rect.width / 2,
                        centerY: rect.y + rect.height / 2,
                        right: rect.right,
                        bottom: rect.bottom,
                        area: rect.width * rect.height,
                    },
                    isVisible: rect.width > 0 && rect.height > 0 && computedStyle.visibility !== 'hidden' && computedStyle.display !== 'none',
                    isInteractive,
                    semanticType: determineSemanticType(el),
                    xpath: getXPath(el),
                    selector: getSelector(el),
                    attributes,
                    computedStyles: {
                        display: computedStyle.display,
                        position: computedStyle.position,
                        zIndex: computedStyle.zIndex,
                        visibility: computedStyle.visibility,
                        opacity: computedStyle.opacity,
                    },
                };
            }, index);

            return info as ElementInfo;
        } catch {
            return null;
        }
    }

    /** Find element using natural language description */
    public findElement(description: string): NaturalLanguageMatch | null {
        return this.naturalLanguageLocator.findBest(description);
    }

    /** Find all elements matching description */
    public findElements(description: string): NaturalLanguageMatch[] {
        return this.naturalLanguageLocator.find(description);
    }

    /** Get element by position relative to another */
    public getElementByPosition(referenceId: string, relation: SpatialRelation): ElementInfo | null {
        return this.elementGraph.findElementByPosition(referenceId, relation);
    }

    /** Get elements in a specific region */
    public getElementsInRegion(regionType: SemanticRegionType): ElementInfo[] {
        if (!this.lastAnalysis) return [];

        const region = this.lastAnalysis.regions.find(r => r.type === regionType);
        if (!region) return [];

        return this.lastAnalysis.elements.filter(el =>
            el.boundingBox.x >= region.boundingBox.x &&
            el.boundingBox.y >= region.boundingBox.y &&
            el.boundingBox.right <= region.boundingBox.right &&
            el.boundingBox.bottom <= region.boundingBox.bottom
        );
    }

    /** Get nearby elements */
    public getNearbyElements(elementId: string, maxDistance: number = 100): ElementInfo[] {
        return this.elementGraph.findNearbyElements(elementId, maxDistance);
    }

    /** Get the last analysis result */
    public getLastAnalysis(): PageAnalysis | null {
        return this.lastAnalysis;
    }

    /** Set viewport for responsive testing */
    public async setViewport(viewport: ViewportSize): Promise<void> {
        await this.viewportManager.setViewport(viewport);
    }

    /** Set viewport by name */
    public async setViewportByName(name: string): Promise<void> {
        await this.viewportManager.setViewportByName(name);
    }

    /** Get common viewport presets */
    public getViewportPresets(): ViewportSize[] {
        return ViewportManager.getCommonViewports();
    }

    /** Detect responsive breakpoints */
    public async detectBreakpoints(page: Page): Promise<ResponsiveBreakpoint[]> {
        return await this.viewportManager.detectResponsiveBreakpoints(page);
    }

    /** Get accessibility audit */
    public async getAccessibilityAudit(page: Page): Promise<{
        missingAltText: number;
        missingLabels: number;
        lowContrastElements: number;
        missingLandmarks: boolean;
    }> {
        return await this.accessibilityMapper.auditAccessibility(page);
    }

    /** Generate description suggestions for an element */
    public getElementDescriptions(elementId: string): string[] {
        const element = this.elementGraph.getElement(elementId);
        if (!element) return [];

        return this.naturalLanguageLocator.generateLocatorSuggestions(element);
    }

    /** Get visual hierarchy */
    public getVisualHierarchy(): VisualHierarchyNode[] {
        return this.elementGraph.buildVisualHierarchy();
    }

    /** Cleanup resources */
    public async close(): Promise<void> {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        console.log('[SpatialWebAwareness] Closed browser resources');
    }
}

// ============================================================================
// Integration helper for VisualAgent
// ============================================================================

export interface SpatialAwareAction {
    type: 'click' | 'type' | 'hover' | 'scroll';
    element: ElementInfo;
    description: string;
    coordinates: { x: number; y: number };
    text?: string;
}

/** Helper class for integrating with VisualAgent */
export class SpatialAwareVisualHelper {
    private spatialAwareness: SpatialWebAwareness;

    constructor(spatialAwareness: SpatialWebAwareness) {
        this.spatialAwareness = spatialAwareness;
    }

    /** Convert natural language to visual action */
    public async resolveNaturalLanguageAction(
        description: string,
        actionType: 'click' | 'type' | 'hover' | 'scroll' = 'click'
    ): Promise<SpatialAwareAction | null> {
        const match = this.spatialAwareness.findElement(description);

        if (!match || match.score < 0.4) {
            console.log(`[SpatialAwareVisualHelper] No confident match found for: "${description}"`);
            return null;
        }

        const element = match.element;

        return {
            type: actionType,
            element,
            description: `${actionType} on ${element.tagName.toLowerCase()} "${element.textContent.substring(0, 30)}"`,
            coordinates: {
                x: Math.round(element.boundingBox.centerX),
                y: Math.round(element.boundingBox.centerY),
            },
        };
    }

    /** Get clickable elements in a region */
    public getClickableElementsInRegion(regionType: SemanticRegionType): ElementInfo[] {
        return this.spatialAwareness
            .getElementsInRegion(regionType)
            .filter(el => el.isInteractive);
    }

    /** Find button by text */
    public findButtonByText(text: string): ElementInfo | null {
        const match = this.spatialAwareness.findElement(`button "${text}"`);
        return match?.element ?? null;
    }

    /** Find input field by label */
    public findInputByLabel(label: string): ElementInfo | null {
        const match = this.spatialAwareness.findElement(`input near "${label}"`);
        return match?.element ?? null;
    }

    /** Get navigation links */
    public getNavigationLinks(): ElementInfo[] {
        return this.spatialAwareness.getElementsInRegion('navigation')
            .filter(el => el.tagName.toLowerCase() === 'a');
    }
}

// Export all classes
export default SpatialWebAwareness;
