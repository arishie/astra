/**
 * SpatialWebAwareness - Advanced spatial understanding of web pages
 *
 * This module provides comprehensive spatial analysis of web pages,
 * enabling natural language navigation and understanding of page layouts.
 */
import type { Page } from 'playwright';
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
export type SemanticRegionType = 'header' | 'navigation' | 'main' | 'sidebar' | 'footer' | 'search' | 'form' | 'article' | 'aside' | 'banner' | 'complementary' | 'contentinfo' | 'unknown';
/** ARIA landmark roles */
export type AriaLandmark = 'banner' | 'navigation' | 'main' | 'complementary' | 'contentinfo' | 'search' | 'form' | 'region' | 'none';
/** Spatial relationship between elements */
export type SpatialRelation = 'above' | 'below' | 'left-of' | 'right-of' | 'inside' | 'contains' | 'overlaps' | 'near' | 'adjacent-to';
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
export declare class ViewportManager {
    private static readonly COMMON_VIEWPORTS;
    private currentViewport;
    private page;
    constructor(initialViewport?: ViewportSize);
    /** Set the page instance to manage */
    setPage(page: Page): void;
    /** Get all common viewport presets */
    static getCommonViewports(): ViewportSize[];
    /** Get current viewport */
    getCurrentViewport(): ViewportSize;
    /** Set viewport by name */
    setViewportByName(name: string): Promise<void>;
    /** Set viewport with custom dimensions */
    setViewport(viewport: ViewportSize): Promise<void>;
    /** Detect common breakpoints by analyzing layout changes */
    detectResponsiveBreakpoints(page: Page): Promise<ResponsiveBreakpoint[]>;
    /** Capture current layout positions */
    private captureLayoutSnapshot;
    /** Detect changes between two layout snapshots */
    private detectLayoutChanges;
    /** Get human-readable breakpoint name */
    private getBreakpointName;
    /** Extend bounding box with computed properties */
    private extendBoundingBox;
    /** Check if current viewport is mobile */
    isMobile(): boolean;
    /** Get device category */
    getDeviceCategory(): 'mobile' | 'tablet' | 'desktop';
}
export declare class AccessibilityMapper {
    /** Map ARIA roles to semantic region types */
    private static readonly ROLE_TO_REGION;
    /** Map HTML5 semantic elements to region types */
    private static readonly ELEMENT_TO_REGION;
    /** Extract all ARIA landmarks from the page */
    extractLandmarks(page: Page): Promise<SemanticRegion[]>;
    /** Extract landmark info from element with ARIA role */
    private extractLandmarkFromElement;
    /** Extract landmark from HTML5 semantic element */
    private extractLandmarkFromSemanticElement;
    /** Infer ARIA landmark from element */
    private inferAriaLandmark;
    /** Check if landmark is duplicate */
    private isDuplicate;
    /** Extract accessibility tree summary */
    extractAccessibilityTree(page: Page): Promise<Record<string, unknown>>;
    /** Check for common accessibility issues */
    auditAccessibility(page: Page): Promise<{
        missingAltText: number;
        missingLabels: number;
        lowContrastElements: number;
        missingLandmarks: boolean;
    }>;
    /** Extend bounding box with computed properties */
    private extendBoundingBox;
}
export declare class LayoutAnalyzer {
    private accessibilityMapper;
    constructor();
    /** Analyze page layout and identify semantic regions */
    analyzeLayout(page: Page): Promise<SemanticRegion[]>;
    /** Detect regions using visual heuristics */
    private detectRegionsHeuristically;
    /** Detect header region */
    private detectHeaderRegion;
    /** Detect footer region */
    private detectFooterRegion;
    /** Detect navigation regions */
    private detectNavigationRegions;
    /** Detect sidebar regions */
    private detectSidebarRegions;
    /** Detect main content region */
    private detectMainContentRegion;
    /** Detect search regions */
    private detectSearchRegions;
    /** Check if new region significantly overlaps existing ones */
    private isOverlapping;
    /** Calculate overlap ratio between two bounding boxes */
    private calculateOverlap;
    /** Extend bounding box with computed properties */
    private extendBoundingBox;
}
export declare class ElementGraph {
    private elements;
    private relationships;
    private spatialIndex;
    /** Clear the graph */
    clear(): void;
    /** Add an element to the graph */
    addElement(element: ElementInfo): void;
    /** Build relationships between all elements */
    buildRelationships(): void;
    /** Compute spatial relations between two elements */
    private computeRelations;
    /** Determine primary spatial relation */
    private determinePrimaryRelation;
    /** Check if a is inside b */
    private isInside;
    /** Check if boxes overlap */
    private overlaps;
    /** Check parent-child relationship (based on DOM structure in xpath) */
    private checkParentChild;
    /** Check if elements are siblings */
    private checkSibling;
    /** Build spatial index for fast lookups */
    private buildSpatialIndex;
    /** Get all relationships */
    getRelationships(): ElementRelationship[];
    /** Find elements related to a given element */
    findRelatedElements(elementId: string, relation?: SpatialRelation): ElementInfo[];
    /** Find elements near a given element */
    findNearbyElements(elementId: string, maxDistance?: number): ElementInfo[];
    /** Find element by relative position */
    findElementByPosition(referenceId: string, relation: SpatialRelation): ElementInfo | null;
    /** Get visual hierarchy from element relationships */
    buildVisualHierarchy(): VisualHierarchyNode[];
    /** Build hierarchy node recursively */
    private buildHierarchyNode;
    /** Calculate visual weight/importance of element */
    private calculateVisualWeight;
    /** Get element by ID */
    getElement(id: string): ElementInfo | undefined;
    /** Get all elements */
    getAllElements(): ElementInfo[];
}
export declare class NaturalLanguageLocator {
    private elementGraph;
    /** Common element type keywords */
    private static readonly ELEMENT_KEYWORDS;
    /** Position keywords */
    private static readonly POSITION_KEYWORDS;
    /** Region keywords */
    private static readonly REGION_KEYWORDS;
    constructor(elementGraph: ElementGraph);
    /** Find elements matching natural language description */
    find(description: string): NaturalLanguageMatch[];
    /** Find the best matching element */
    findBest(description: string): NaturalLanguageMatch | null;
    /** Tokenize description */
    private tokenize;
    /** Parse natural language description */
    private parseDescription;
    /** Score an element against parsed description */
    private scoreElement;
    /** Score element type match */
    private scoreElementType;
    /** Score text content match */
    private scoreTextContent;
    /** Score position relation */
    private scorePosition;
    /** Find best element by text content only */
    private findBestByText;
    /** Generate locator suggestions for an element */
    generateLocatorSuggestions(element: ElementInfo): string[];
}
export declare class SpatialWebAwareness {
    private browser;
    private context;
    private layoutAnalyzer;
    private elementGraph;
    private naturalLanguageLocator;
    private viewportManager;
    private accessibilityMapper;
    private lastAnalysis;
    constructor();
    /** Initialize browser if not already */
    private ensureBrowser;
    /** Analyze a page and build spatial awareness */
    analyze(page: Page): Promise<PageAnalysis>;
    /** Analyze a URL directly */
    analyzeUrl(url: string): Promise<PageAnalysis>;
    /** Extract all relevant elements from the page */
    private extractElements;
    /** Extract detailed information from an element */
    private extractElementInfo;
    /** Find element using natural language description */
    findElement(description: string): NaturalLanguageMatch | null;
    /** Find all elements matching description */
    findElements(description: string): NaturalLanguageMatch[];
    /** Get element by position relative to another */
    getElementByPosition(referenceId: string, relation: SpatialRelation): ElementInfo | null;
    /** Get elements in a specific region */
    getElementsInRegion(regionType: SemanticRegionType): ElementInfo[];
    /** Get nearby elements */
    getNearbyElements(elementId: string, maxDistance?: number): ElementInfo[];
    /** Get the last analysis result */
    getLastAnalysis(): PageAnalysis | null;
    /** Set viewport for responsive testing */
    setViewport(viewport: ViewportSize): Promise<void>;
    /** Set viewport by name */
    setViewportByName(name: string): Promise<void>;
    /** Get common viewport presets */
    getViewportPresets(): ViewportSize[];
    /** Detect responsive breakpoints */
    detectBreakpoints(page: Page): Promise<ResponsiveBreakpoint[]>;
    /** Get accessibility audit */
    getAccessibilityAudit(page: Page): Promise<{
        missingAltText: number;
        missingLabels: number;
        lowContrastElements: number;
        missingLandmarks: boolean;
    }>;
    /** Generate description suggestions for an element */
    getElementDescriptions(elementId: string): string[];
    /** Get visual hierarchy */
    getVisualHierarchy(): VisualHierarchyNode[];
    /** Cleanup resources */
    close(): Promise<void>;
}
export interface SpatialAwareAction {
    type: 'click' | 'type' | 'hover' | 'scroll';
    element: ElementInfo;
    description: string;
    coordinates: {
        x: number;
        y: number;
    };
    text?: string;
}
/** Helper class for integrating with VisualAgent */
export declare class SpatialAwareVisualHelper {
    private spatialAwareness;
    constructor(spatialAwareness: SpatialWebAwareness);
    /** Convert natural language to visual action */
    resolveNaturalLanguageAction(description: string, actionType?: 'click' | 'type' | 'hover' | 'scroll'): Promise<SpatialAwareAction | null>;
    /** Get clickable elements in a region */
    getClickableElementsInRegion(regionType: SemanticRegionType): ElementInfo[];
    /** Find button by text */
    findButtonByText(text: string): ElementInfo | null;
    /** Find input field by label */
    findInputByLabel(label: string): ElementInfo | null;
    /** Get navigation links */
    getNavigationLinks(): ElementInfo[];
}
export default SpatialWebAwareness;
//# sourceMappingURL=SpatialWebAwareness.d.ts.map