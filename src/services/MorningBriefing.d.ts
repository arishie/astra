/**
 * Morning Briefing Podcast Service
 *
 * Generates personalized audio briefings for users by aggregating calendar,
 * email, news, tasks, weather, and market updates into a conversational
 * podcast-style format with TTS synthesis.
 */
import { EventEmitter } from 'events';
export type BriefingSection = 'greeting' | 'calendar' | 'weather' | 'news' | 'tasks' | 'market' | 'emails' | 'reminders' | 'closing';
export type TTSProvider = 'elevenlabs' | 'openai' | 'google';
export type VoiceGender = 'male' | 'female' | 'neutral';
export type BriefingStatus = 'pending' | 'generating' | 'completed' | 'failed';
export interface VoiceConfig {
    provider: TTSProvider;
    voiceId: string;
    voiceName?: string;
    gender?: VoiceGender;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    pitch?: number;
}
export interface BriefingPreferences {
    sections: BriefingSection[];
    sectionOrder?: BriefingSection[];
    maxDurationMinutes: number;
    voice: VoiceConfig;
    includeMusic: boolean;
    musicVolume?: number;
    newsCategories?: string[];
    marketSymbols?: string[];
    timezone: string;
    language: string;
    deliveryTime?: string;
    enabledDays?: number[];
}
export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: string[];
    isAllDay?: boolean;
    isRecurring?: boolean;
    conferenceUrl?: string;
}
export interface EmailSummary {
    id: string;
    from: string;
    subject: string;
    preview: string;
    receivedAt: Date;
    priority: 'high' | 'normal' | 'low';
    isUnread: boolean;
    hasAttachments: boolean;
    category?: string;
}
export interface NewsItem {
    id: string;
    title: string;
    summary: string;
    source: string;
    category: string;
    publishedAt: Date;
    url: string;
    imageUrl?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
}
export interface TaskItem {
    id: string;
    title: string;
    description?: string;
    dueDate?: Date;
    priority: 'critical' | 'high' | 'medium' | 'low';
    project?: string;
    tags?: string[];
    estimatedMinutes?: number;
    isOverdue?: boolean;
}
export interface WeatherData {
    location: string;
    currentTemp: number;
    feelsLike: number;
    highTemp: number;
    lowTemp: number;
    condition: string;
    description: string;
    humidity: number;
    windSpeed: number;
    windDirection?: string;
    precipitation?: number;
    uvIndex?: number;
    sunrise?: string;
    sunset?: string;
    alerts?: string[];
    hourlyForecast?: Array<{
        time: string;
        temp: number;
        condition: string;
    }>;
}
export interface MarketData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume?: number;
    marketCap?: number;
    dayHigh?: number;
    dayLow?: number;
}
export interface ReminderItem {
    id: string;
    text: string;
    triggerTime: Date;
    type: 'one-time' | 'recurring';
    priority?: 'high' | 'normal';
}
export interface AggregatedData {
    calendar: CalendarEvent[];
    emails: EmailSummary[];
    news: NewsItem[];
    tasks: TaskItem[];
    weather: WeatherData | null;
    market: MarketData[];
    reminders: ReminderItem[];
    generatedAt: Date;
}
export interface BriefingScript {
    sections: ScriptSection[];
    totalDuration: number;
    wordCount: number;
    generatedAt: Date;
}
export interface ScriptSection {
    type: BriefingSection;
    text: string;
    estimatedDuration: number;
    wordCount: number;
    metadata?: Record<string, unknown>;
}
export interface AudioSegment {
    id: string;
    type: 'speech' | 'music' | 'transition';
    buffer: Buffer;
    duration: number;
    format: string;
}
export interface GeneratedBriefing {
    id: string;
    userId: string;
    script: BriefingScript;
    audioUrl?: string;
    audioPath?: string;
    audioDuration: number;
    status: BriefingStatus;
    preferences: BriefingPreferences;
    aggregatedData: AggregatedData;
    generatedAt: Date;
    publishedAt?: Date;
    error?: string;
}
export interface ScheduleConfig {
    userId: string;
    enabled: boolean;
    deliveryTime: string;
    timezone: string;
    enabledDays: number[];
    lastRun?: Date;
    nextRun?: Date;
}
export interface DataSourceConfig {
    name: string;
    type: 'calendar' | 'email' | 'news' | 'tasks' | 'weather' | 'market';
    enabled: boolean;
    credentials?: Record<string, string>;
    settings?: Record<string, unknown>;
}
export declare class DataAggregator {
    private dataSources;
    private cacheTimeout;
    private cache;
    constructor(sources?: DataSourceConfig[]);
    /**
     * Aggregates all data sources for a user's briefing.
     */
    aggregateData(userId: string, preferences: BriefingPreferences, date?: Date): Promise<AggregatedData>;
    /**
     * Fetches calendar events for the day.
     */
    fetchCalendarEvents(userId: string, date: Date): Promise<CalendarEvent[]>;
    private fetchFromCalendarAPI;
    /**
     * Fetches important unread emails.
     */
    fetchEmailSummaries(userId: string, limit?: number): Promise<EmailSummary[]>;
    private fetchFromEmailAPI;
    /**
     * Fetches latest news based on categories.
     */
    fetchNews(categories?: string[], limit?: number): Promise<NewsItem[]>;
    private fetchFromNewsAPI;
    /**
     * Fetches tasks due today or high priority.
     */
    fetchTasks(userId: string, date: Date): Promise<TaskItem[]>;
    private fetchFromTasksAPI;
    /**
     * Fetches weather data for user's location.
     */
    fetchWeather(userId: string, timezone: string): Promise<WeatherData | null>;
    private fetchFromWeatherAPI;
    /**
     * Fetches market data for specified symbols.
     */
    fetchMarketData(symbols?: string[]): Promise<MarketData[]>;
    private fetchFromMarketAPI;
    /**
     * Fetches reminders for the user.
     */
    fetchReminders(userId: string, date: Date): Promise<ReminderItem[]>;
    /**
     * Registers a data source.
     */
    registerSource(config: DataSourceConfig): void;
    /**
     * Removes a data source.
     */
    removeSource(name: string): boolean;
    /**
     * Clears all cached data.
     */
    clearCache(): void;
    private getFromCache;
    private setCache;
}
export declare class ScriptWriter {
    private wordsPerMinute;
    private maxDurationMinutes;
    constructor(options?: {
        wordsPerMinute?: number;
        maxDurationMinutes?: number;
    });
    /**
     * Creates a natural conversational script from aggregated data.
     */
    createScript(data: AggregatedData, preferences: BriefingPreferences, userName?: string): Promise<BriefingScript>;
    /**
     * Generates a single section of the script.
     */
    private generateSection;
    /**
     * Generates a personalized greeting based on time of day.
     */
    private generateGreeting;
    /**
     * Generates calendar section with natural language.
     */
    private generateCalendarSection;
    /**
     * Generates weather section with conversational tone.
     */
    private generateWeatherSection;
    /**
     * Generates news section with headlines and brief summaries.
     */
    private generateNewsSection;
    /**
     * Generates tasks section prioritized by importance.
     */
    private generateTasksSection;
    /**
     * Generates market section with key movements.
     */
    private generateMarketSection;
    /**
     * Generates email section highlighting important messages.
     */
    private generateEmailsSection;
    /**
     * Generates reminders section.
     */
    private generateRemindersSection;
    /**
     * Generates closing remarks.
     */
    private generateClosing;
    private countWords;
    private trimToWordBudget;
}
export declare class VoiceSynthesizer {
    private providers;
    private defaultProvider;
    constructor();
    private initializeProviders;
    /**
     * Synthesizes speech from text using the specified provider.
     */
    synthesize(text: string, config: VoiceConfig): Promise<Buffer>;
    /**
     * Synthesizes multiple text segments and concatenates them.
     */
    synthesizeScript(script: BriefingScript, config: VoiceConfig): Promise<Buffer>;
    /**
     * Lists available voices for a provider.
     */
    listVoices(provider: TTSProvider): Promise<VoiceInfo[]>;
    /**
     * Checks if a provider is available.
     */
    isProviderAvailable(provider: TTSProvider): boolean;
    /**
     * Gets available providers.
     */
    getAvailableProviders(): TTSProvider[];
    /**
     * Generates a silent audio buffer of specified duration.
     */
    private generateSilence;
}
interface VoiceInfo {
    id: string;
    name: string;
    gender?: VoiceGender;
    language?: string;
    preview?: string;
}
export declare class AudioMixer {
    private introMusicPath?;
    private outroMusicPath?;
    private transitionSoundPath?;
    private backgroundMusicPath?;
    constructor(options?: {
        introMusicPath?: string;
        outroMusicPath?: string;
        transitionSoundPath?: string;
        backgroundMusicPath?: string;
    });
    /**
     * Mixes the main speech audio with music and effects.
     */
    mixAudio(speechBuffer: Buffer, options?: {
        includeIntro?: boolean;
        includeOutro?: boolean;
        includeTransitions?: boolean;
        backgroundMusicVolume?: number;
        introDuration?: number;
        outroDuration?: number;
    }): Promise<Buffer>;
    /**
     * Adds background music to speech audio.
     */
    addBackgroundMusic(speechBuffer: Buffer, musicVolume?: number): Promise<Buffer>;
    /**
     * Loads and processes music file.
     */
    private loadAndProcessMusic;
    /**
     * Creates a crossfade transition between two audio buffers.
     */
    crossfade(buffer1: Buffer, buffer2: Buffer, fadeDurationMs?: number): Promise<Buffer>;
    /**
     * Normalizes audio levels.
     */
    normalizeAudio(buffer: Buffer, targetDb?: number): Promise<Buffer>;
    /**
     * Sets the music paths.
     */
    setMusicPaths(paths: {
        intro?: string;
        outro?: string;
        transition?: string;
        background?: string;
    }): void;
}
export declare class PodcastPublisher {
    private storageBasePath;
    private publicBaseUrl?;
    constructor(options?: {
        storageBasePath?: string;
        publicBaseUrl?: string;
    });
    /**
     * Saves the audio briefing and returns access URLs.
     */
    publish(briefingId: string, userId: string, audioBuffer: Buffer, metadata: {
        title?: string;
        duration: number;
        generatedAt: Date;
    }): Promise<PublishResult>;
    /**
     * Gets a published briefing by ID.
     */
    getBriefing(userId: string, briefingId: string): Promise<Buffer | null>;
    /**
     * Lists all briefings for a user.
     */
    listBriefings(userId: string): Promise<BriefingMetadata[]>;
    /**
     * Deletes a briefing.
     */
    deleteBriefing(userId: string, briefingId: string): Promise<boolean>;
    /**
     * Cleans up old briefings beyond retention period.
     */
    cleanupOldBriefings(userId: string, retentionDays?: number): Promise<number>;
    /**
     * Generates an RSS feed for podcast subscriptions.
     */
    generateRSSFeed(userId: string, options?: {
        title?: string;
        description?: string;
        author?: string;
        imageUrl?: string;
    }): Promise<string>;
    private escapeXml;
}
interface PublishResult {
    id: string;
    filePath: string;
    publicUrl?: string;
    fileSize: number;
    publishedAt: Date;
}
interface BriefingMetadata {
    id: string;
    userId: string;
    filename: string;
    title?: string;
    duration: number;
    generatedAt: string;
    publishedAt: string;
    fileSize: number;
}
export declare class ScheduleManager extends EventEmitter {
    private schedules;
    private timers;
    private db;
    private isRunning;
    constructor();
    /**
     * Starts the schedule manager.
     */
    start(): Promise<void>;
    /**
     * Stops the schedule manager.
     */
    stop(): void;
    /**
     * Creates or updates a schedule for a user.
     */
    setSchedule(config: ScheduleConfig): Promise<void>;
    /**
     * Gets a user's schedule.
     */
    getSchedule(userId: string): ScheduleConfig | undefined;
    /**
     * Removes a user's schedule.
     */
    removeSchedule(userId: string): Promise<boolean>;
    /**
     * Gets the next scheduled run time for a user.
     */
    getNextRunTime(userId: string): Date | null;
    /**
     * Loads schedules from database.
     */
    private loadSchedulesFromDB;
    /**
     * Schedules all loaded jobs.
     */
    private scheduleAllJobs;
    /**
     * Schedules a single job.
     */
    private scheduleJob;
    /**
     * Executes a scheduled job.
     */
    private executeScheduledJob;
    /**
     * Calculates the next run time based on schedule configuration.
     */
    private calculateNextRun;
}
export declare class MorningBriefingService extends EventEmitter {
    private dataAggregator;
    private scriptWriter;
    private voiceSynthesizer;
    private audioMixer;
    private podcastPublisher;
    private scheduleManager;
    private db;
    private userPreferencesCache;
    constructor(options?: {
        storageBasePath?: string;
        publicBaseUrl?: string;
        musicPaths?: {
            intro?: string;
            outro?: string;
            transition?: string;
            background?: string;
        };
    });
    /**
     * Starts the briefing service and schedule manager.
     */
    start(): Promise<void>;
    /**
     * Stops the briefing service.
     */
    stop(): void;
    /**
     * Main method to generate a complete morning briefing for a user.
     */
    generateBriefing(userId: string): Promise<GeneratedBriefing>;
    /**
     * Sets user preferences for briefings.
     */
    setUserPreferences(userId: string, preferences: Partial<BriefingPreferences>): Promise<BriefingPreferences>;
    /**
     * Gets user preferences.
     */
    getUserPreferences(userId: string): Promise<BriefingPreferences>;
    /**
     * Gets default briefing preferences.
     */
    getDefaultPreferences(): BriefingPreferences;
    /**
     * Sets up daily scheduled briefings for a user.
     */
    scheduleDaily(userId: string, deliveryTime: string, timezone: string, enabledDays?: number[]): Promise<void>;
    /**
     * Cancels scheduled briefings for a user.
     */
    cancelSchedule(userId: string): Promise<void>;
    /**
     * Gets the next scheduled briefing time.
     */
    getNextScheduledBriefing(userId: string): Date | null;
    /**
     * Lists past briefings for a user.
     */
    listBriefings(userId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<GeneratedBriefing[]>;
    /**
     * Gets a specific briefing.
     */
    getBriefing(userId: string, briefingId: string): Promise<GeneratedBriefing | null>;
    /**
     * Gets available TTS voices.
     */
    getAvailableVoices(provider?: TTSProvider): Promise<Map<TTSProvider, VoiceInfo[]>>;
    /**
     * Registers a custom data source.
     */
    registerDataSource(config: DataSourceConfig): void;
    /**
     * Gets the audio file for a briefing.
     */
    getBriefingAudio(userId: string, briefingId: string): Promise<Buffer | null>;
    /**
     * Generates an RSS feed for podcast subscriptions.
     */
    generatePodcastFeed(userId: string, options?: {
        title?: string;
        description?: string;
        author?: string;
        imageUrl?: string;
    }): Promise<string>;
    /**
     * Cleans up old briefings.
     */
    cleanupOldBriefings(userId: string, retentionDays?: number): Promise<number>;
    /**
     * Gets user name for personalization.
     */
    private getUserName;
    /**
     * Saves briefing record to database.
     */
    private saveBriefingRecord;
}
export declare function getMorningBriefingService(options?: {
    storageBasePath?: string;
    publicBaseUrl?: string;
}): MorningBriefingService;
export default MorningBriefingService;
//# sourceMappingURL=MorningBriefing.d.ts.map