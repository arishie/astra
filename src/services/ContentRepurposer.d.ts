import { EventEmitter } from 'events';
export type ContentPlatform = 'twitter' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'blog' | 'email' | 'threads' | 'facebook' | 'pinterest';
export type ContentTone = 'professional' | 'casual' | 'witty' | 'inspirational' | 'educational' | 'promotional' | 'conversational' | 'formal' | 'humorous';
export type MediaType = 'image' | 'video' | 'audio' | 'gif' | 'carousel';
export interface MediaAsset {
    id: string;
    type: MediaType;
    url: string;
    originalPath?: string;
    width?: number;
    height?: number;
    duration?: number;
    fileSize?: number;
    mimeType?: string;
    altText?: string;
    thumbnailUrl?: string;
}
export interface ContentInput {
    id?: string;
    text: string;
    title?: string;
    media?: MediaAsset[];
    hashtags?: string[];
    mentions?: string[];
    links?: string[];
    metadata?: Record<string, any>;
}
export interface PlatformConstraints {
    maxTextLength: number;
    maxHashtags: number;
    maxMentions: number;
    supportedMediaTypes: MediaType[];
    maxMediaCount: number;
    mediaAspectRatios: AspectRatio[];
    maxVideoLength?: number;
    maxImageSize?: number;
    maxVideoSize?: number;
    characterEncoding?: 'utf-8' | 'ascii';
    linkShortening?: boolean;
    supportsThreads?: boolean;
    supportsCarousel?: boolean;
    requiresAltText?: boolean;
}
export interface AspectRatio {
    name: string;
    width: number;
    height: number;
    recommended?: boolean;
}
export interface RepurposedContent {
    platform: ContentPlatform;
    text: string;
    title?: string;
    hashtags: string[];
    mentions: string[];
    media: TransformedMedia[];
    scheduledTime?: Date;
    tone: ContentTone;
    characterCount: number;
    isWithinLimits: boolean;
    warnings: string[];
    thread?: RepurposedContent[];
    metadata: {
        originalContentId?: string;
        repurposedAt: Date;
        adapterId: string;
        transformations: string[];
    };
}
export interface TransformedMedia {
    original: MediaAsset;
    transformed: MediaAsset;
    transformations: MediaTransformation[];
}
export interface MediaTransformation {
    type: 'resize' | 'crop' | 'compress' | 'format_convert' | 'duration_trim' | 'thumbnail_generate';
    params: Record<string, any>;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
}
export interface ScheduleSlot {
    platform: ContentPlatform;
    dayOfWeek: number;
    hour: number;
    minute: number;
    timezone: string;
    engagementScore?: number;
}
export interface RepurposeOptions {
    targetTone?: ContentTone;
    preserveHashtags?: boolean;
    generateHashtags?: boolean;
    maxHashtags?: number;
    includeEmojis?: boolean;
    scheduleOptimal?: boolean;
    timezone?: string;
    customInstructions?: string;
    mediaTransformations?: {
        resizeStrategy?: 'fit' | 'fill' | 'crop';
        compressionQuality?: number;
        preferredFormat?: string;
    };
}
export interface RepurposeResult {
    success: boolean;
    sourceContent: ContentInput;
    sourcePlatform: ContentPlatform;
    targetPlatforms: ContentPlatform[];
    repurposedContent: Map<ContentPlatform, RepurposedContent>;
    errors: Map<ContentPlatform, string>;
    processingTimeMs: number;
}
export declare class ToneAdjuster {
    private tonePatterns;
    constructor();
    private initializeTonePatterns;
    adjustTone(text: string, targetTone: ContentTone, platform: ContentPlatform): ToneAdjustmentResult;
    private detectTone;
    private findReplacement;
    private adjustEmojis;
    private applyPlatformToneRules;
    private calculateToneConfidence;
}
interface ToneAdjustmentResult {
    adjustedText: string;
    originalTone: ContentTone;
    targetTone: ContentTone;
    adjustments: string[];
    confidence: number;
}
export declare class HashtagGenerator {
    private trendingHashtags;
    private industryHashtags;
    constructor();
    private initializeIndustryHashtags;
    generate(content: string, platform: ContentPlatform, options?: HashtagGeneratorOptions): Promise<HashtagGeneratorResult>;
    private extractKeywords;
    private detectIndustries;
    private formatHashtag;
    private isValidHashtag;
    private getPlatformSpecificHashtags;
    updateTrending(platform: ContentPlatform, hashtag: string, data: TrendingHashtag): void;
    getTrending(platform: ContentPlatform, limit?: number): TrendingHashtag[];
}
interface HashtagGeneratorOptions {
    maxCount?: number;
    preserveExisting?: boolean;
    includeIndustry?: string[];
    excludeTags?: string[];
}
interface HashtagGeneratorResult {
    hashtags: string[];
    relevanceScores: Map<string, number>;
    categories: string[];
}
interface TrendingHashtag {
    hashtag: string;
    volume: number;
    growth: number;
    region?: string;
    expiresAt?: Date;
}
export declare class MediaTransformer {
    private transformationQueue;
    constructor();
    transform(media: MediaAsset, targetPlatform: ContentPlatform, options?: MediaTransformOptions): Promise<TransformedMedia>;
    transformBatch(mediaList: MediaAsset[], targetPlatform: ContentPlatform, options?: MediaTransformOptions): Promise<TransformedMedia[]>;
    private calculateAspectRatioTransform;
    getTransformationStatus(jobId: string): MediaTransformationJob | undefined;
    getSupportedFormats(platform: ContentPlatform): MediaType[];
    getMaxDimensions(platform: ContentPlatform): {
        maxWidth: number;
        maxHeight: number;
        aspectRatios: AspectRatio[];
    };
}
interface MediaTransformOptions {
    resizeStrategy?: 'fit' | 'fill' | 'crop';
    compressionQuality?: number;
    preferredFormat?: string;
    generateThumbnail?: boolean;
}
interface MediaTransformationJob {
    id: string;
    media: MediaAsset;
    platform: ContentPlatform;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: TransformedMedia;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}
export declare class MediaTransformError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class ContentScheduler {
    private optimalTimes;
    private scheduledContent;
    private timezone;
    constructor(timezone?: string);
    private initializeOptimalTimes;
    getOptimalTime(platform: ContentPlatform, fromDate?: Date, options?: ScheduleOptions): Date;
    getOptimalTimesForBatch(platforms: ContentPlatform[], fromDate?: Date, options?: ScheduleOptions): Map<ContentPlatform, Date>;
    schedule(contentId: string, platform: ContentPlatform, content: RepurposedContent, scheduledTime: Date): ScheduledContentItem;
    cancel(scheduleId: string): boolean;
    reschedule(scheduleId: string, newTime: Date): ScheduledContentItem | null;
    getScheduledContent(filter?: {
        platform?: ContentPlatform;
        status?: ScheduledContentStatus;
    }): ScheduledContentItem[];
    getUpcoming(limit?: number): ScheduledContentItem[];
    private hasConflict;
    updateOptimalTimes(platform: ContentPlatform, slots: ScheduleSlot[]): void;
    setTimezone(timezone: string): void;
}
interface ScheduleOptions {
    notBefore?: Date;
    notAfter?: Date;
    minGapMinutes?: number;
    preferredDays?: number[];
    avoidWeekends?: boolean;
}
interface ScheduledContentItem {
    id: string;
    contentId: string;
    platform: ContentPlatform;
    content: RepurposedContent;
    scheduledTime: Date;
    status: ScheduledContentStatus;
    publishedAt?: Date;
    error?: string;
    createdAt: Date;
}
type ScheduledContentStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
export interface PlatformAdapter {
    platform: ContentPlatform;
    constraints: PlatformConstraints;
    adapt(content: ContentInput, options: RepurposeOptions): Promise<RepurposedContent>;
}
export declare class ContentRepurposer extends EventEmitter {
    private adapters;
    private toneAdjuster;
    private hashtagGenerator;
    private mediaTransformer;
    private scheduler;
    private processingStats;
    constructor(options?: ContentRepurposerOptions);
    private initializeAdapters;
    repurpose(content: ContentInput, sourcePlatform: ContentPlatform, targetPlatforms: ContentPlatform[], options?: RepurposeOptions): Promise<RepurposeResult>;
    repurposeToAll(content: ContentInput, sourcePlatform: ContentPlatform, options?: RepurposeOptions): Promise<RepurposeResult>;
    getAdapter(platform: ContentPlatform): PlatformAdapter | undefined;
    getPlatformConstraints(platform: ContentPlatform): PlatformConstraints | undefined;
    getSupportedPlatforms(): ContentPlatform[];
    getToneAdjuster(): ToneAdjuster;
    getHashtagGenerator(): HashtagGenerator;
    getMediaTransformer(): MediaTransformer;
    getScheduler(): ContentScheduler;
    getStats(): ProcessingStats;
    private updatePlatformStats;
    registerAdapter(platform: ContentPlatform, adapter: PlatformAdapter): void;
    scheduleContent(content: ContentInput, sourcePlatform: ContentPlatform, targetPlatforms: ContentPlatform[], options?: RepurposeOptions): Promise<Map<ContentPlatform, ScheduledContentItem>>;
    previewRepurpose(content: ContentInput, targetPlatform: ContentPlatform, options?: RepurposeOptions): Promise<RepurposedContent>;
    validateContent(content: ContentInput, platform: ContentPlatform): ContentValidationResult;
}
interface ContentRepurposerOptions {
    timezone?: string;
    customAdapters?: Map<ContentPlatform, PlatformAdapter>;
}
interface ProcessingStats {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    averageProcessingTimeMs: number;
    platformStats: Map<ContentPlatform, {
        processed: number;
        succeeded: number;
        failed: number;
    }>;
}
interface ContentValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function getContentRepurposer(options?: ContentRepurposerOptions): ContentRepurposer;
export declare function createContentRepurposer(options?: ContentRepurposerOptions): ContentRepurposer;
export declare class ContentRepurposerBridge {
    private repurposer;
    constructor(repurposer?: ContentRepurposer);
    handleIncomingMessage(platform: ContentPlatform, content: string, metadata?: Record<string, any>): Promise<Map<ContentPlatform, RepurposedContent>>;
    crossPost(content: ContentInput, sourcePlatform: ContentPlatform, targetPlatforms: ContentPlatform[], options?: RepurposeOptions): Promise<RepurposeResult>;
    getRepurposer(): ContentRepurposer;
}
export {};
//# sourceMappingURL=ContentRepurposer.d.ts.map