// @ts-nocheck
/**
 * Morning Briefing Podcast Service
 *
 * Generates personalized audio briefings for users by aggregating calendar,
 * email, news, tasks, weather, and market updates into a conversational
 * podcast-style format with TTS synthesis.
 */
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Database } from '../database/Database.js';
// ============================================================================
// Data Aggregator
// ============================================================================
export class DataAggregator {
    dataSources = new Map();
    cacheTimeout = 5 * 60 * 1000; // 5 minutes
    cache = new Map();
    constructor(sources) {
        if (sources) {
            for (const source of sources) {
                this.dataSources.set(source.name, source);
            }
        }
    }
    /**
     * Aggregates all data sources for a user's briefing.
     */
    async aggregateData(userId, preferences, date = new Date()) {
        const sections = preferences.sections;
        const results = {
            calendar: [],
            emails: [],
            news: [],
            tasks: [],
            weather: null,
            market: [],
            reminders: [],
            generatedAt: new Date(),
        };
        const fetchPromises = [];
        if (sections.includes('calendar')) {
            fetchPromises.push(this.fetchCalendarEvents(userId, date).then((events) => {
                results.calendar = events;
            }));
        }
        if (sections.includes('emails')) {
            fetchPromises.push(this.fetchEmailSummaries(userId).then((emails) => {
                results.emails = emails;
            }));
        }
        if (sections.includes('news')) {
            fetchPromises.push(this.fetchNews(preferences.newsCategories).then((news) => {
                results.news = news;
            }));
        }
        if (sections.includes('tasks')) {
            fetchPromises.push(this.fetchTasks(userId, date).then((tasks) => {
                results.tasks = tasks;
            }));
        }
        if (sections.includes('weather')) {
            fetchPromises.push(this.fetchWeather(userId, preferences.timezone).then((weather) => {
                results.weather = weather;
            }));
        }
        if (sections.includes('market')) {
            fetchPromises.push(this.fetchMarketData(preferences.marketSymbols).then((market) => {
                results.market = market;
            }));
        }
        if (sections.includes('reminders')) {
            fetchPromises.push(this.fetchReminders(userId, date).then((reminders) => {
                results.reminders = reminders;
            }));
        }
        await Promise.allSettled(fetchPromises);
        return results;
    }
    /**
     * Fetches calendar events for the day.
     */
    async fetchCalendarEvents(userId, date) {
        const cacheKey = `calendar:${userId}:${date.toDateString()}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            // Integration point: Connect to Google Calendar, Outlook, etc.
            // For now, returning mock structure showing expected format
            const events = await this.fetchFromCalendarAPI(userId, date);
            this.setCache(cacheKey, events);
            return events;
        }
        catch (error) {
            console.error('[DataAggregator] Calendar fetch failed:', error);
            return [];
        }
    }
    async fetchFromCalendarAPI(userId, date) {
        // Production implementation would connect to calendar providers
        // This is a placeholder that returns empty array
        // Real implementation would use OAuth tokens stored for the user
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        // TODO: Implement actual calendar API integration
        // Example providers: Google Calendar API, Microsoft Graph API
        return [];
    }
    /**
     * Fetches important unread emails.
     */
    async fetchEmailSummaries(userId, limit = 5) {
        const cacheKey = `emails:${userId}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const emails = await this.fetchFromEmailAPI(userId, limit);
            this.setCache(cacheKey, emails);
            return emails;
        }
        catch (error) {
            console.error('[DataAggregator] Email fetch failed:', error);
            return [];
        }
    }
    async fetchFromEmailAPI(userId, limit) {
        // Production implementation would connect to Gmail, Outlook, etc.
        // This is a placeholder for actual email provider integration
        // TODO: Implement actual email API integration
        return [];
    }
    /**
     * Fetches latest news based on categories.
     */
    async fetchNews(categories, limit = 5) {
        const cacheKey = `news:${(categories || ['general']).join(',')}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const news = await this.fetchFromNewsAPI(categories, limit);
            this.setCache(cacheKey, news);
            return news;
        }
        catch (error) {
            console.error('[DataAggregator] News fetch failed:', error);
            return [];
        }
    }
    async fetchFromNewsAPI(categories, limit) {
        // Production implementation would connect to news APIs
        // Example: NewsAPI, Google News, or custom RSS feeds
        // TODO: Implement actual news API integration
        return [];
    }
    /**
     * Fetches tasks due today or high priority.
     */
    async fetchTasks(userId, date) {
        const cacheKey = `tasks:${userId}:${date.toDateString()}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const tasks = await this.fetchFromTasksAPI(userId, date);
            this.setCache(cacheKey, tasks);
            return tasks;
        }
        catch (error) {
            console.error('[DataAggregator] Tasks fetch failed:', error);
            return [];
        }
    }
    async fetchFromTasksAPI(userId, date) {
        // Production implementation would connect to Todoist, Asana, etc.
        // TODO: Implement actual task management API integration
        return [];
    }
    /**
     * Fetches weather data for user's location.
     */
    async fetchWeather(userId, timezone) {
        const cacheKey = `weather:${userId}:${timezone}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const weather = await this.fetchFromWeatherAPI(userId, timezone);
            if (weather) {
                this.setCache(cacheKey, weather);
            }
            return weather;
        }
        catch (error) {
            console.error('[DataAggregator] Weather fetch failed:', error);
            return null;
        }
    }
    async fetchFromWeatherAPI(userId, timezone) {
        // Production implementation would connect to OpenWeatherMap, Weather.com, etc.
        // TODO: Implement actual weather API integration
        return null;
    }
    /**
     * Fetches market data for specified symbols.
     */
    async fetchMarketData(symbols) {
        if (!symbols || symbols.length === 0) {
            symbols = ['SPY', 'QQQ', 'DIA']; // Default market indices
        }
        const cacheKey = `market:${symbols.join(',')}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const market = await this.fetchFromMarketAPI(symbols);
            this.setCache(cacheKey, market);
            return market;
        }
        catch (error) {
            console.error('[DataAggregator] Market fetch failed:', error);
            return [];
        }
    }
    async fetchFromMarketAPI(symbols) {
        // Production implementation would connect to Alpha Vantage, Yahoo Finance, etc.
        // TODO: Implement actual market data API integration
        return [];
    }
    /**
     * Fetches reminders for the user.
     */
    async fetchReminders(userId, date) {
        const cacheKey = `reminders:${userId}:${date.toDateString()}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const db = Database.getInstance();
            const result = await db.query(`SELECT id, text, trigger_time, type, priority
                 FROM user_reminders
                 WHERE user_id = $1
                 AND trigger_time >= $2
                 AND trigger_time < $3
                 ORDER BY trigger_time ASC`, [userId, date, new Date(date.getTime() + 24 * 60 * 60 * 1000)]);
            const reminders = result.rows.map((row) => ({
                id: row.id,
                text: row.text,
                triggerTime: new Date(row.trigger_time),
                type: row.type,
                priority: row.priority,
            }));
            this.setCache(cacheKey, reminders);
            return reminders;
        }
        catch (error) {
            console.error('[DataAggregator] Reminders fetch failed:', error);
            return [];
        }
    }
    /**
     * Registers a data source.
     */
    registerSource(config) {
        this.dataSources.set(config.name, config);
    }
    /**
     * Removes a data source.
     */
    removeSource(name) {
        return this.dataSources.delete(name);
    }
    /**
     * Clears all cached data.
     */
    clearCache() {
        this.cache.clear();
    }
    getFromCache(key) {
        const entry = this.cache.get(key);
        if (entry && Date.now() - entry.timestamp < this.cacheTimeout) {
            return entry.data;
        }
        return null;
    }
    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
}
// ============================================================================
// Script Writer
// ============================================================================
export class ScriptWriter {
    wordsPerMinute = 150;
    maxDurationMinutes = 5;
    constructor(options) {
        if (options?.wordsPerMinute) {
            this.wordsPerMinute = options.wordsPerMinute;
        }
        if (options?.maxDurationMinutes) {
            this.maxDurationMinutes = options.maxDurationMinutes;
        }
    }
    /**
     * Creates a natural conversational script from aggregated data.
     */
    async createScript(data, preferences, userName) {
        const sections = [];
        const sectionOrder = preferences.sectionOrder || preferences.sections;
        const targetWords = this.maxDurationMinutes * this.wordsPerMinute;
        let totalWords = 0;
        // Calculate word budget per section
        const activeSections = sectionOrder.filter((s) => preferences.sections.includes(s));
        const wordsPerSection = Math.floor(targetWords / activeSections.length);
        for (const sectionType of sectionOrder) {
            if (!preferences.sections.includes(sectionType))
                continue;
            if (totalWords >= targetWords)
                break;
            const section = await this.generateSection(sectionType, data, preferences, userName, Math.min(wordsPerSection, targetWords - totalWords));
            if (section.text.trim()) {
                sections.push(section);
                totalWords += section.wordCount;
            }
        }
        const totalDuration = Math.ceil(totalWords / this.wordsPerMinute * 60);
        return {
            sections,
            totalDuration,
            wordCount: totalWords,
            generatedAt: new Date(),
        };
    }
    /**
     * Generates a single section of the script.
     */
    async generateSection(type, data, preferences, userName, wordBudget = 150) {
        let text = '';
        const now = new Date();
        switch (type) {
            case 'greeting':
                text = this.generateGreeting(now, preferences.timezone, userName);
                break;
            case 'calendar':
                text = this.generateCalendarSection(data.calendar, wordBudget);
                break;
            case 'weather':
                text = this.generateWeatherSection(data.weather, wordBudget);
                break;
            case 'news':
                text = this.generateNewsSection(data.news, wordBudget);
                break;
            case 'tasks':
                text = this.generateTasksSection(data.tasks, wordBudget);
                break;
            case 'market':
                text = this.generateMarketSection(data.market, wordBudget);
                break;
            case 'emails':
                text = this.generateEmailsSection(data.emails, wordBudget);
                break;
            case 'reminders':
                text = this.generateRemindersSection(data.reminders, wordBudget);
                break;
            case 'closing':
                text = this.generateClosing(userName);
                break;
        }
        const wordCount = this.countWords(text);
        const estimatedDuration = Math.ceil(wordCount / this.wordsPerMinute * 60);
        return {
            type,
            text,
            estimatedDuration,
            wordCount,
        };
    }
    /**
     * Generates a personalized greeting based on time of day.
     */
    generateGreeting(now, timezone, userName) {
        const hour = now.getHours();
        let timeOfDay = 'morning';
        if (hour >= 12 && hour < 17)
            timeOfDay = 'afternoon';
        else if (hour >= 17)
            timeOfDay = 'evening';
        const name = userName ? `, ${userName}` : '';
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
        const greetings = [
            `Good ${timeOfDay}${name}! It's ${dateStr}. Here's your daily briefing.`,
            `Good ${timeOfDay}${name}. Welcome to your daily briefing for ${dateStr}.`,
            `Rise and shine${name}! It's ${dateStr}, and here's what you need to know today.`,
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }
    /**
     * Generates calendar section with natural language.
     */
    generateCalendarSection(events, wordBudget) {
        if (events.length === 0) {
            return "Your calendar is clear today. A perfect opportunity to focus on deep work or catch up on personal projects.";
        }
        const parts = [];
        parts.push("Let's look at your schedule for today.");
        // Sort by start time
        const sortedEvents = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        const maxEvents = Math.min(sortedEvents.length, 5);
        for (let i = 0; i < maxEvents; i++) {
            const event = sortedEvents[i];
            const time = event.startTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
            if (event.isAllDay) {
                parts.push(`All day: ${event.title}.`);
            }
            else if (event.location) {
                parts.push(`At ${time}, you have ${event.title} at ${event.location}.`);
            }
            else if (event.conferenceUrl) {
                parts.push(`At ${time}, you have a virtual meeting: ${event.title}.`);
            }
            else {
                parts.push(`At ${time}, ${event.title}.`);
            }
            if (this.countWords(parts.join(' ')) >= wordBudget)
                break;
        }
        if (sortedEvents.length > maxEvents) {
            parts.push(`You have ${sortedEvents.length - maxEvents} more events today.`);
        }
        return parts.join(' ');
    }
    /**
     * Generates weather section with conversational tone.
     */
    generateWeatherSection(weather, wordBudget) {
        if (!weather) {
            return "Weather information is currently unavailable.";
        }
        const parts = [];
        parts.push(`Now for the weather in ${weather.location}.`);
        parts.push(`Currently it's ${Math.round(weather.currentTemp)} degrees with ${weather.condition.toLowerCase()}.`);
        parts.push(`Today's high will be ${Math.round(weather.highTemp)} and the low ${Math.round(weather.lowTemp)} degrees.`);
        if (weather.precipitation && weather.precipitation > 30) {
            parts.push(`There's a ${weather.precipitation}% chance of precipitation, so you might want to grab an umbrella.`);
        }
        if (weather.alerts && weather.alerts.length > 0) {
            parts.push(`Weather alert: ${weather.alerts[0]}.`);
        }
        // Add contextual advice
        if (weather.currentTemp < 40) {
            parts.push("Bundle up, it's cold out there!");
        }
        else if (weather.currentTemp > 85) {
            parts.push("Stay hydrated and try to stay cool.");
        }
        return this.trimToWordBudget(parts.join(' '), wordBudget);
    }
    /**
     * Generates news section with headlines and brief summaries.
     */
    generateNewsSection(news, wordBudget) {
        if (news.length === 0) {
            return "No significant news updates to report at this time.";
        }
        const parts = [];
        parts.push("Here are today's top stories.");
        const maxItems = Math.min(news.length, 3);
        for (let i = 0; i < maxItems; i++) {
            const item = news[i];
            parts.push(`${item.title}. ${item.summary}`);
            if (this.countWords(parts.join(' ')) >= wordBudget)
                break;
        }
        return this.trimToWordBudget(parts.join(' '), wordBudget);
    }
    /**
     * Generates tasks section prioritized by importance.
     */
    generateTasksSection(tasks, wordBudget) {
        if (tasks.length === 0) {
            return "You're all caught up on tasks. Great job staying on top of things!";
        }
        const parts = [];
        // Prioritize tasks
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortedTasks = [...tasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        const overdueTasks = sortedTasks.filter((t) => t.isOverdue);
        const todayTasks = sortedTasks.filter((t) => !t.isOverdue);
        if (overdueTasks.length > 0) {
            parts.push(`Heads up, you have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}.`);
            parts.push(`The most important is: ${overdueTasks[0].title}.`);
        }
        parts.push(`You have ${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} for today.`);
        const criticalTasks = todayTasks.filter((t) => t.priority === 'critical' || t.priority === 'high');
        if (criticalTasks.length > 0) {
            parts.push(`High priority: ${criticalTasks.map((t) => t.title).join(', ')}.`);
        }
        return this.trimToWordBudget(parts.join(' '), wordBudget);
    }
    /**
     * Generates market section with key movements.
     */
    generateMarketSection(market, wordBudget) {
        if (market.length === 0) {
            return "Market data is currently unavailable.";
        }
        const parts = [];
        parts.push("Here's a quick market update.");
        for (const item of market) {
            const direction = item.change >= 0 ? 'up' : 'down';
            const changeAbs = Math.abs(item.changePercent).toFixed(2);
            parts.push(`${item.name || item.symbol} is ${direction} ${changeAbs}% at ${item.price.toFixed(2)}.`);
            if (this.countWords(parts.join(' ')) >= wordBudget)
                break;
        }
        return this.trimToWordBudget(parts.join(' '), wordBudget);
    }
    /**
     * Generates email section highlighting important messages.
     */
    generateEmailsSection(emails, wordBudget) {
        if (emails.length === 0) {
            return "Your inbox is clear. No urgent emails this morning.";
        }
        const parts = [];
        const unreadCount = emails.filter((e) => e.isUnread).length;
        const highPriority = emails.filter((e) => e.priority === 'high');
        parts.push(`You have ${unreadCount} unread email${unreadCount !== 1 ? 's' : ''}.`);
        if (highPriority.length > 0) {
            parts.push(`${highPriority.length} ${highPriority.length === 1 ? 'is' : 'are'} marked as high priority.`);
            const email = highPriority[0];
            parts.push(`From ${email.from}: "${email.subject}".`);
        }
        else if (emails.length > 0) {
            const email = emails[0];
            parts.push(`Most recent from ${email.from}: "${email.subject}".`);
        }
        return this.trimToWordBudget(parts.join(' '), wordBudget);
    }
    /**
     * Generates reminders section.
     */
    generateRemindersSection(reminders, wordBudget) {
        if (reminders.length === 0) {
            return "";
        }
        const parts = [];
        parts.push(`Quick reminder${reminders.length > 1 ? 's' : ''} for today.`);
        for (const reminder of reminders.slice(0, 3)) {
            const time = reminder.triggerTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
            parts.push(`At ${time}: ${reminder.text}.`);
            if (this.countWords(parts.join(' ')) >= wordBudget)
                break;
        }
        return this.trimToWordBudget(parts.join(' '), wordBudget);
    }
    /**
     * Generates closing remarks.
     */
    generateClosing(userName) {
        const closings = [
            "That's your briefing for today. Have a productive day!",
            "And that's your morning update. Make it a great day!",
            "That wraps up your daily briefing. Go out there and crush it!",
            "You're all set for the day ahead. Good luck with everything!",
        ];
        const closing = closings[Math.floor(Math.random() * closings.length)];
        return userName ? closing.replace('!', `, ${userName}!`) : closing;
    }
    countWords(text) {
        return text.split(/\s+/).filter((word) => word.length > 0).length;
    }
    trimToWordBudget(text, budget) {
        const words = text.split(/\s+/);
        if (words.length <= budget)
            return text;
        // Try to end at a sentence
        let truncated = words.slice(0, budget).join(' ');
        const lastSentenceEnd = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf('!'), truncated.lastIndexOf('?'));
        if (lastSentenceEnd > truncated.length * 0.6) {
            truncated = truncated.substring(0, lastSentenceEnd + 1);
        }
        return truncated;
    }
}
// ============================================================================
// Voice Synthesizer
// ============================================================================
export class VoiceSynthesizer {
    providers = new Map();
    defaultProvider = 'openai';
    constructor() {
        this.initializeProviders();
    }
    initializeProviders() {
        // Initialize provider clients based on available credentials
        if (process.env.ELEVENLABS_API_KEY) {
            this.providers.set('elevenlabs', new ElevenLabsClient());
        }
        if (process.env.OPENAI_API_KEY) {
            this.providers.set('openai', new OpenAITTSClient());
            this.defaultProvider = 'openai';
        }
        if (process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            this.providers.set('google', new GoogleTTSClient());
        }
    }
    /**
     * Synthesizes speech from text using the specified provider.
     */
    async synthesize(text, config) {
        const provider = this.providers.get(config.provider);
        if (!provider) {
            // Fallback to default provider
            const fallbackProvider = this.providers.get(this.defaultProvider);
            if (!fallbackProvider) {
                throw new Error(`TTS provider '${config.provider}' not available and no fallback configured`);
            }
            console.warn(`[VoiceSynthesizer] Provider '${config.provider}' not available, using '${this.defaultProvider}'`);
            return fallbackProvider.synthesize(text, config);
        }
        return provider.synthesize(text, config);
    }
    /**
     * Synthesizes multiple text segments and concatenates them.
     */
    async synthesizeScript(script, config) {
        const segments = [];
        for (const section of script.sections) {
            if (!section.text.trim())
                continue;
            try {
                const audio = await this.synthesize(section.text, config);
                segments.push(audio);
                // Add small pause between sections
                const pauseBuffer = this.generateSilence(0.5);
                segments.push(pauseBuffer);
            }
            catch (error) {
                console.error(`[VoiceSynthesizer] Failed to synthesize section ${section.type}:`, error);
            }
        }
        return Buffer.concat(segments);
    }
    /**
     * Lists available voices for a provider.
     */
    async listVoices(provider) {
        const client = this.providers.get(provider);
        if (!client) {
            throw new Error(`Provider '${provider}' not configured`);
        }
        return client.listVoices();
    }
    /**
     * Checks if a provider is available.
     */
    isProviderAvailable(provider) {
        return this.providers.has(provider);
    }
    /**
     * Gets available providers.
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    /**
     * Generates a silent audio buffer of specified duration.
     */
    generateSilence(durationSeconds) {
        // Generate silence at 24kHz mono 16-bit PCM
        const sampleRate = 24000;
        const numSamples = Math.floor(sampleRate * durationSeconds);
        const buffer = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample
        return buffer;
    }
}
// ElevenLabs TTS Client
class ElevenLabsClient {
    apiKey;
    baseUrl = 'https://api.elevenlabs.io/v1';
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    }
    async synthesize(text, config) {
        const voiceId = config.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel
        const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: config.stability ?? 0.5,
                    similarity_boost: config.similarityBoost ?? 0.75,
                    style: config.style ?? 0,
                    use_speaker_boost: true,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    async listVoices() {
        const response = await fetch(`${this.baseUrl}/voices`, {
            headers: {
                'xi-api-key': this.apiKey,
            },
        });
        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }
        const data = await response.json();
        return data.voices.map((voice) => ({
            id: voice.voice_id,
            name: voice.name,
            gender: voice.labels?.gender,
            preview: voice.preview_url,
        }));
    }
}
// OpenAI TTS Client
class OpenAITTSClient {
    apiKey;
    baseUrl = 'https://api.openai.com/v1';
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
    }
    async synthesize(text, config) {
        const voice = config.voiceId || 'alloy';
        const speed = config.speed ?? 1.0;
        const response = await fetch(`${this.baseUrl}/audio/speech`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1-hd',
                input: text,
                voice,
                speed,
                response_format: 'mp3',
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI TTS API error: ${response.status} - ${error}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    async listVoices() {
        // OpenAI has fixed voices
        return [
            { id: 'alloy', name: 'Alloy', gender: 'neutral' },
            { id: 'echo', name: 'Echo', gender: 'male' },
            { id: 'fable', name: 'Fable', gender: 'neutral' },
            { id: 'onyx', name: 'Onyx', gender: 'male' },
            { id: 'nova', name: 'Nova', gender: 'female' },
            { id: 'shimmer', name: 'Shimmer', gender: 'female' },
        ];
    }
}
// Google TTS Client
class GoogleTTSClient {
    apiKey;
    constructor() {
        this.apiKey = process.env.GOOGLE_TTS_API_KEY || '';
    }
    async synthesize(text, config) {
        const voiceName = config.voiceId || 'en-US-Neural2-F';
        const speakingRate = config.speed ?? 1.0;
        const pitch = config.pitch ?? 0;
        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: { text },
                voice: {
                    languageCode: voiceName.substring(0, 5),
                    name: voiceName,
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate,
                    pitch,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google TTS API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        return Buffer.from(data.audioContent, 'base64');
    }
    async listVoices() {
        const url = `https://texttospeech.googleapis.com/v1/voices?key=${this.apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google TTS API error: ${response.status}`);
        }
        const data = await response.json();
        return data.voices.map((voice) => ({
            id: voice.name,
            name: voice.name,
            gender: voice.ssmlGender.toLowerCase(),
            language: voice.languageCodes[0],
        }));
    }
}
// ============================================================================
// Audio Mixer
// ============================================================================
export class AudioMixer {
    introMusicPath;
    outroMusicPath;
    transitionSoundPath;
    backgroundMusicPath;
    constructor(options) {
        this.introMusicPath = options?.introMusicPath;
        this.outroMusicPath = options?.outroMusicPath;
        this.transitionSoundPath = options?.transitionSoundPath;
        this.backgroundMusicPath = options?.backgroundMusicPath;
    }
    /**
     * Mixes the main speech audio with music and effects.
     */
    async mixAudio(speechBuffer, options = {}) {
        const segments = [];
        // Add intro music if available and requested
        if (options.includeIntro && this.introMusicPath) {
            try {
                const introBuffer = await this.loadAndProcessMusic(this.introMusicPath, options.introDuration || 3);
                segments.push(introBuffer);
            }
            catch (error) {
                console.warn('[AudioMixer] Failed to load intro music:', error);
            }
        }
        // Add main speech content
        segments.push(speechBuffer);
        // Add outro music if available and requested
        if (options.includeOutro && this.outroMusicPath) {
            try {
                const outroBuffer = await this.loadAndProcessMusic(this.outroMusicPath, options.outroDuration || 3);
                segments.push(outroBuffer);
            }
            catch (error) {
                console.warn('[AudioMixer] Failed to load outro music:', error);
            }
        }
        // Concatenate all segments
        return Buffer.concat(segments);
    }
    /**
     * Adds background music to speech audio.
     */
    async addBackgroundMusic(speechBuffer, musicVolume = 0.1) {
        if (!this.backgroundMusicPath) {
            return speechBuffer;
        }
        try {
            // In production, this would use a proper audio processing library
            // like fluent-ffmpeg or audiowaveform to mix audio tracks
            // For now, returning the speech buffer unchanged
            console.warn('[AudioMixer] Background music mixing requires ffmpeg integration');
            return speechBuffer;
        }
        catch (error) {
            console.error('[AudioMixer] Failed to add background music:', error);
            return speechBuffer;
        }
    }
    /**
     * Loads and processes music file.
     */
    async loadAndProcessMusic(filePath, durationSeconds) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            // In production, would trim/fade the audio to specified duration
            return fileBuffer;
        }
        catch (error) {
            throw new Error(`Failed to load music file: ${filePath}`);
        }
    }
    /**
     * Creates a crossfade transition between two audio buffers.
     */
    async crossfade(buffer1, buffer2, fadeDurationMs = 500) {
        // Simplified concatenation - production would implement actual crossfade
        return Buffer.concat([buffer1, buffer2]);
    }
    /**
     * Normalizes audio levels.
     */
    async normalizeAudio(buffer, targetDb = -16) {
        // Production implementation would use proper audio normalization
        // Using libraries like loudness or ffmpeg
        return buffer;
    }
    /**
     * Sets the music paths.
     */
    setMusicPaths(paths) {
        if (paths.intro)
            this.introMusicPath = paths.intro;
        if (paths.outro)
            this.outroMusicPath = paths.outro;
        if (paths.transition)
            this.transitionSoundPath = paths.transition;
        if (paths.background)
            this.backgroundMusicPath = paths.background;
    }
}
// ============================================================================
// Podcast Publisher
// ============================================================================
export class PodcastPublisher {
    storageBasePath;
    publicBaseUrl;
    constructor(options) {
        this.storageBasePath = options?.storageBasePath || './data/podcasts';
        this.publicBaseUrl = options?.publicBaseUrl;
    }
    /**
     * Saves the audio briefing and returns access URLs.
     */
    async publish(briefingId, userId, audioBuffer, metadata) {
        const userDir = path.join(this.storageBasePath, userId);
        await fs.mkdir(userDir, { recursive: true });
        const filename = `briefing-${briefingId}.mp3`;
        const filePath = path.join(userDir, filename);
        // Save audio file
        await fs.writeFile(filePath, audioBuffer);
        // Generate metadata file
        const metadataPath = path.join(userDir, `briefing-${briefingId}.json`);
        await fs.writeFile(metadataPath, JSON.stringify({
            id: briefingId,
            userId,
            filename,
            ...metadata,
            publishedAt: new Date().toISOString(),
            fileSize: audioBuffer.length,
        }));
        const result = {
            id: briefingId,
            filePath,
            fileSize: audioBuffer.length,
            publishedAt: new Date(),
        };
        if (this.publicBaseUrl) {
            result.publicUrl = `${this.publicBaseUrl}/${userId}/${filename}`;
        }
        return result;
    }
    /**
     * Gets a published briefing by ID.
     */
    async getBriefing(userId, briefingId) {
        const filePath = path.join(this.storageBasePath, userId, `briefing-${briefingId}.mp3`);
        try {
            return await fs.readFile(filePath);
        }
        catch {
            return null;
        }
    }
    /**
     * Lists all briefings for a user.
     */
    async listBriefings(userId) {
        const userDir = path.join(this.storageBasePath, userId);
        try {
            const files = await fs.readdir(userDir);
            const metadataFiles = files.filter((f) => f.endsWith('.json'));
            const briefings = [];
            for (const file of metadataFiles) {
                try {
                    const content = await fs.readFile(path.join(userDir, file), 'utf-8');
                    briefings.push(JSON.parse(content));
                }
                catch {
                    // Skip invalid metadata files
                }
            }
            return briefings.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        }
        catch {
            return [];
        }
    }
    /**
     * Deletes a briefing.
     */
    async deleteBriefing(userId, briefingId) {
        const userDir = path.join(this.storageBasePath, userId);
        const audioPath = path.join(userDir, `briefing-${briefingId}.mp3`);
        const metadataPath = path.join(userDir, `briefing-${briefingId}.json`);
        try {
            await Promise.all([
                fs.unlink(audioPath).catch(() => { }),
                fs.unlink(metadataPath).catch(() => { }),
            ]);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Cleans up old briefings beyond retention period.
     */
    async cleanupOldBriefings(userId, retentionDays = 30) {
        const briefings = await this.listBriefings(userId);
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        for (const briefing of briefings) {
            if (new Date(briefing.publishedAt) < cutoffDate) {
                await this.deleteBriefing(userId, briefing.id);
                deletedCount++;
            }
        }
        return deletedCount;
    }
    /**
     * Generates an RSS feed for podcast subscriptions.
     */
    async generateRSSFeed(userId, options = {}) {
        const briefings = await this.listBriefings(userId);
        const feedTitle = options.title || 'My Morning Briefing';
        const feedDescription = options.description || 'Daily personalized morning briefings';
        let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
    <channel>
        <title>${this.escapeXml(feedTitle)}</title>
        <description>${this.escapeXml(feedDescription)}</description>
        <language>en-us</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;
        if (options.author) {
            rss += `        <itunes:author>${this.escapeXml(options.author)}</itunes:author>\n`;
        }
        if (options.imageUrl) {
            rss += `        <itunes:image href="${this.escapeXml(options.imageUrl)}" />\n`;
        }
        for (const briefing of briefings.slice(0, 50)) {
            const pubDate = new Date(briefing.publishedAt).toUTCString();
            const audioUrl = this.publicBaseUrl
                ? `${this.publicBaseUrl}/${userId}/briefing-${briefing.id}.mp3`
                : '';
            rss += `
        <item>
            <title>${this.escapeXml(briefing.title || `Briefing - ${new Date(briefing.publishedAt).toLocaleDateString()}`)}</title>
            <pubDate>${pubDate}</pubDate>
            <enclosure url="${audioUrl}" length="${briefing.fileSize}" type="audio/mpeg" />
            <itunes:duration>${Math.floor(briefing.duration)}</itunes:duration>
            <guid>${briefing.id}</guid>
        </item>
`;
        }
        rss += `    </channel>
</rss>`;
        return rss;
    }
    escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
// ============================================================================
// Schedule Manager
// ============================================================================
export class ScheduleManager extends EventEmitter {
    schedules = new Map();
    timers = new Map();
    db;
    isRunning = false;
    constructor() {
        super();
        this.db = Database.getInstance();
    }
    /**
     * Starts the schedule manager.
     */
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        await this.loadSchedulesFromDB();
        this.scheduleAllJobs();
        console.log('[ScheduleManager] Started with', this.schedules.size, 'schedules');
    }
    /**
     * Stops the schedule manager.
     */
    stop() {
        this.isRunning = false;
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        console.log('[ScheduleManager] Stopped');
    }
    /**
     * Creates or updates a schedule for a user.
     */
    async setSchedule(config) {
        this.schedules.set(config.userId, config);
        // Save to database
        try {
            await this.db.query(`INSERT INTO briefing_schedules (user_id, enabled, delivery_time, timezone, enabled_days)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id)
                 DO UPDATE SET
                     enabled = EXCLUDED.enabled,
                     delivery_time = EXCLUDED.delivery_time,
                     timezone = EXCLUDED.timezone,
                     enabled_days = EXCLUDED.enabled_days,
                     updated_at = NOW()`, [
                config.userId,
                config.enabled,
                config.deliveryTime,
                config.timezone,
                JSON.stringify(config.enabledDays),
            ]);
        }
        catch (error) {
            console.error('[ScheduleManager] Failed to save schedule:', error);
        }
        // Reschedule job
        this.scheduleJob(config);
    }
    /**
     * Gets a user's schedule.
     */
    getSchedule(userId) {
        return this.schedules.get(userId);
    }
    /**
     * Removes a user's schedule.
     */
    async removeSchedule(userId) {
        const timer = this.timers.get(userId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(userId);
        }
        const existed = this.schedules.delete(userId);
        try {
            await this.db.query('DELETE FROM briefing_schedules WHERE user_id = $1', [userId]);
        }
        catch (error) {
            console.error('[ScheduleManager] Failed to delete schedule:', error);
        }
        return existed;
    }
    /**
     * Gets the next scheduled run time for a user.
     */
    getNextRunTime(userId) {
        const schedule = this.schedules.get(userId);
        if (!schedule || !schedule.enabled)
            return null;
        return this.calculateNextRun(schedule);
    }
    /**
     * Loads schedules from database.
     */
    async loadSchedulesFromDB() {
        try {
            const result = await this.db.query('SELECT * FROM briefing_schedules WHERE enabled = true');
            for (const row of result.rows) {
                const config = {
                    userId: row.user_id,
                    enabled: row.enabled,
                    deliveryTime: row.delivery_time,
                    timezone: row.timezone,
                    enabledDays: JSON.parse(row.enabled_days || '[]'),
                    lastRun: row.last_run ? new Date(row.last_run) : undefined,
                };
                this.schedules.set(config.userId, config);
            }
        }
        catch (error) {
            console.error('[ScheduleManager] Failed to load schedules:', error);
        }
    }
    /**
     * Schedules all loaded jobs.
     */
    scheduleAllJobs() {
        for (const schedule of this.schedules.values()) {
            if (schedule.enabled) {
                this.scheduleJob(schedule);
            }
        }
    }
    /**
     * Schedules a single job.
     */
    scheduleJob(config) {
        // Clear existing timer
        const existingTimer = this.timers.get(config.userId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        if (!config.enabled)
            return;
        const nextRun = this.calculateNextRun(config);
        if (!nextRun)
            return;
        const delay = nextRun.getTime() - Date.now();
        if (delay < 0) {
            // Already passed, schedule for tomorrow
            const tomorrow = new Date(nextRun);
            tomorrow.setDate(tomorrow.getDate() + 1);
            config.nextRun = tomorrow;
            return this.scheduleJob(config);
        }
        config.nextRun = nextRun;
        const timer = setTimeout(async () => {
            await this.executeScheduledJob(config);
        }, Math.min(delay, 2147483647)); // Max setTimeout value
        this.timers.set(config.userId, timer);
    }
    /**
     * Executes a scheduled job.
     */
    async executeScheduledJob(config) {
        console.log(`[ScheduleManager] Executing scheduled briefing for user ${config.userId}`);
        // Update last run time
        config.lastRun = new Date();
        try {
            await this.db.query('UPDATE briefing_schedules SET last_run = NOW() WHERE user_id = $1', [config.userId]);
        }
        catch (error) {
            console.error('[ScheduleManager] Failed to update last run:', error);
        }
        // Emit event for the service to handle
        this.emit('briefing-due', config.userId);
        // Schedule next run
        this.scheduleJob(config);
    }
    /**
     * Calculates the next run time based on schedule configuration.
     */
    calculateNextRun(config) {
        const [hours, minutes] = config.deliveryTime.split(':').map(Number);
        const now = new Date();
        // Create date in user's timezone
        const targetDate = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
        targetDate.setHours(hours, minutes, 0, 0);
        // Check if enabled for today's day of week
        const dayOfWeek = targetDate.getDay();
        if (config.enabledDays.length > 0) {
            // Find next enabled day
            let daysToAdd = 0;
            for (let i = 0; i < 7; i++) {
                const checkDay = (dayOfWeek + i) % 7;
                if (config.enabledDays.includes(checkDay)) {
                    // Check if it's today and time has passed
                    if (i === 0 && targetDate <= now) {
                        continue;
                    }
                    daysToAdd = i;
                    break;
                }
            }
            targetDate.setDate(targetDate.getDate() + daysToAdd);
        }
        else if (targetDate <= now) {
            // Default to every day, schedule for tomorrow
            targetDate.setDate(targetDate.getDate() + 1);
        }
        return targetDate;
    }
}
// ============================================================================
// Main Morning Briefing Service
// ============================================================================
export class MorningBriefingService extends EventEmitter {
    dataAggregator;
    scriptWriter;
    voiceSynthesizer;
    audioMixer;
    podcastPublisher;
    scheduleManager;
    db;
    userPreferencesCache = new Map();
    constructor(options) {
        super();
        this.db = Database.getInstance();
        this.dataAggregator = new DataAggregator();
        this.scriptWriter = new ScriptWriter();
        this.voiceSynthesizer = new VoiceSynthesizer();
        this.audioMixer = new AudioMixer(options?.musicPaths);
        this.podcastPublisher = new PodcastPublisher({
            storageBasePath: options?.storageBasePath,
            publicBaseUrl: options?.publicBaseUrl,
        });
        this.scheduleManager = new ScheduleManager();
        // Listen for scheduled briefings
        this.scheduleManager.on('briefing-due', async (userId) => {
            try {
                await this.generateBriefing(userId);
            }
            catch (error) {
                console.error(`[MorningBriefingService] Failed scheduled briefing for ${userId}:`, error);
                this.emit('briefing-failed', { userId, error });
            }
        });
    }
    /**
     * Starts the briefing service and schedule manager.
     */
    async start() {
        await this.scheduleManager.start();
        console.log('[MorningBriefingService] Service started');
    }
    /**
     * Stops the briefing service.
     */
    stop() {
        this.scheduleManager.stop();
        console.log('[MorningBriefingService] Service stopped');
    }
    /**
     * Main method to generate a complete morning briefing for a user.
     */
    async generateBriefing(userId) {
        const briefingId = crypto.randomUUID();
        const startTime = Date.now();
        console.log(`[MorningBriefingService] Generating briefing ${briefingId} for user ${userId}`);
        try {
            // Get user preferences
            const preferences = await this.getUserPreferences(userId);
            // Get user info for personalization
            const userName = await this.getUserName(userId);
            // Emit start event
            this.emit('briefing-started', { briefingId, userId });
            // Step 1: Aggregate data from all sources
            const aggregatedData = await this.dataAggregator.aggregateData(userId, preferences);
            // Step 2: Generate conversational script
            const script = await this.scriptWriter.createScript(aggregatedData, preferences, userName);
            // Step 3: Synthesize speech
            const speechBuffer = await this.voiceSynthesizer.synthesizeScript(script, preferences.voice);
            // Step 4: Mix with music if enabled
            let finalAudio;
            if (preferences.includeMusic) {
                finalAudio = await this.audioMixer.mixAudio(speechBuffer, {
                    includeIntro: true,
                    includeOutro: true,
                    backgroundMusicVolume: preferences.musicVolume || 0.1,
                });
            }
            else {
                finalAudio = speechBuffer;
            }
            // Step 5: Publish/save the audio
            const publishResult = await this.podcastPublisher.publish(briefingId, userId, finalAudio, {
                title: `Morning Briefing - ${new Date().toLocaleDateString()}`,
                duration: script.totalDuration,
                generatedAt: new Date(),
            });
            const duration = (Date.now() - startTime) / 1000;
            console.log(`[MorningBriefingService] Briefing ${briefingId} completed in ${duration.toFixed(2)}s`);
            // Create result
            const result = {
                id: briefingId,
                userId,
                script,
                audioUrl: publishResult.publicUrl,
                audioPath: publishResult.filePath,
                audioDuration: script.totalDuration,
                status: 'completed',
                preferences,
                aggregatedData,
                generatedAt: new Date(),
                publishedAt: publishResult.publishedAt,
            };
            // Emit completion event
            this.emit('briefing-completed', result);
            // Save to database
            await this.saveBriefingRecord(result);
            return result;
        }
        catch (error) {
            console.error(`[MorningBriefingService] Briefing generation failed:`, error);
            const failedResult = {
                id: briefingId,
                userId,
                script: { sections: [], totalDuration: 0, wordCount: 0, generatedAt: new Date() },
                audioDuration: 0,
                status: 'failed',
                preferences: await this.getUserPreferences(userId),
                aggregatedData: {
                    calendar: [],
                    emails: [],
                    news: [],
                    tasks: [],
                    weather: null,
                    market: [],
                    reminders: [],
                    generatedAt: new Date(),
                },
                generatedAt: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            this.emit('briefing-failed', failedResult);
            throw error;
        }
    }
    /**
     * Sets user preferences for briefings.
     */
    async setUserPreferences(userId, preferences) {
        const current = await this.getUserPreferences(userId);
        const updated = {
            ...current,
            ...preferences,
            voice: {
                ...current.voice,
                ...(preferences.voice || {}),
            },
        };
        // Save to database
        await this.db.query(`INSERT INTO briefing_preferences (user_id, preferences)
             VALUES ($1, $2)
             ON CONFLICT (user_id)
             DO UPDATE SET preferences = $2, updated_at = NOW()`, [userId, JSON.stringify(updated)]);
        // Update cache
        this.userPreferencesCache.set(userId, updated);
        return updated;
    }
    /**
     * Gets user preferences.
     */
    async getUserPreferences(userId) {
        // Check cache first
        const cached = this.userPreferencesCache.get(userId);
        if (cached)
            return cached;
        try {
            const result = await this.db.query('SELECT preferences FROM briefing_preferences WHERE user_id = $1', [userId]);
            if (result.rows.length > 0) {
                const preferences = result.rows[0].preferences;
                this.userPreferencesCache.set(userId, preferences);
                return preferences;
            }
        }
        catch (error) {
            console.warn('[MorningBriefingService] Failed to fetch preferences:', error);
        }
        // Return defaults
        return this.getDefaultPreferences();
    }
    /**
     * Gets default briefing preferences.
     */
    getDefaultPreferences() {
        return {
            sections: ['greeting', 'calendar', 'weather', 'tasks', 'news', 'closing'],
            maxDurationMinutes: 5,
            voice: {
                provider: 'openai',
                voiceId: 'alloy',
                speed: 1.0,
            },
            includeMusic: false,
            musicVolume: 0.1,
            newsCategories: ['general', 'technology'],
            marketSymbols: ['SPY', 'QQQ'],
            timezone: 'America/New_York',
            language: 'en',
            enabledDays: [1, 2, 3, 4, 5], // Monday-Friday
        };
    }
    /**
     * Sets up daily scheduled briefings for a user.
     */
    async scheduleDaily(userId, deliveryTime, timezone, enabledDays) {
        await this.scheduleManager.setSchedule({
            userId,
            enabled: true,
            deliveryTime,
            timezone,
            enabledDays: enabledDays || [1, 2, 3, 4, 5], // Default weekdays
        });
        console.log(`[MorningBriefingService] Scheduled daily briefing for user ${userId} at ${deliveryTime} ${timezone}`);
    }
    /**
     * Cancels scheduled briefings for a user.
     */
    async cancelSchedule(userId) {
        await this.scheduleManager.removeSchedule(userId);
    }
    /**
     * Gets the next scheduled briefing time.
     */
    getNextScheduledBriefing(userId) {
        return this.scheduleManager.getNextRunTime(userId);
    }
    /**
     * Lists past briefings for a user.
     */
    async listBriefings(userId, options) {
        const limit = options?.limit || 10;
        const offset = options?.offset || 0;
        try {
            const result = await this.db.query(`SELECT * FROM briefings
                 WHERE user_id = $1
                 ORDER BY generated_at DESC
                 LIMIT $2 OFFSET $3`, [userId, limit, offset]);
            return result.rows.map((row) => ({
                id: row.id,
                userId: row.user_id,
                script: row.script,
                audioUrl: row.audio_url,
                audioPath: row.audio_path,
                audioDuration: row.audio_duration,
                status: row.status,
                preferences: row.preferences,
                aggregatedData: row.aggregated_data,
                generatedAt: new Date(row.generated_at),
                publishedAt: row.published_at ? new Date(row.published_at) : undefined,
                error: row.error,
            }));
        }
        catch (error) {
            console.error('[MorningBriefingService] Failed to list briefings:', error);
            return [];
        }
    }
    /**
     * Gets a specific briefing.
     */
    async getBriefing(userId, briefingId) {
        try {
            const result = await this.db.query('SELECT * FROM briefings WHERE id = $1 AND user_id = $2', [briefingId, userId]);
            if (result.rows.length === 0)
                return null;
            const row = result.rows[0];
            return {
                id: row.id,
                userId: row.user_id,
                script: row.script,
                audioUrl: row.audio_url,
                audioPath: row.audio_path,
                audioDuration: row.audio_duration,
                status: row.status,
                preferences: row.preferences,
                aggregatedData: row.aggregated_data,
                generatedAt: new Date(row.generated_at),
                publishedAt: row.published_at ? new Date(row.published_at) : undefined,
                error: row.error,
            };
        }
        catch (error) {
            console.error('[MorningBriefingService] Failed to get briefing:', error);
            return null;
        }
    }
    /**
     * Gets available TTS voices.
     */
    async getAvailableVoices(provider) {
        const result = new Map();
        const providers = provider
            ? [provider]
            : this.voiceSynthesizer.getAvailableProviders();
        for (const p of providers) {
            try {
                const voices = await this.voiceSynthesizer.listVoices(p);
                result.set(p, voices);
            }
            catch (error) {
                console.warn(`[MorningBriefingService] Failed to get voices for ${p}:`, error);
            }
        }
        return result;
    }
    /**
     * Registers a custom data source.
     */
    registerDataSource(config) {
        this.dataAggregator.registerSource(config);
    }
    /**
     * Gets the audio file for a briefing.
     */
    async getBriefingAudio(userId, briefingId) {
        return this.podcastPublisher.getBriefing(userId, briefingId);
    }
    /**
     * Generates an RSS feed for podcast subscriptions.
     */
    async generatePodcastFeed(userId, options) {
        return this.podcastPublisher.generateRSSFeed(userId, options);
    }
    /**
     * Cleans up old briefings.
     */
    async cleanupOldBriefings(userId, retentionDays = 30) {
        return this.podcastPublisher.cleanupOldBriefings(userId, retentionDays);
    }
    /**
     * Gets user name for personalization.
     */
    async getUserName(userId) {
        try {
            const result = await this.db.query('SELECT name FROM users WHERE id = $1', [userId]);
            return result.rows[0]?.name;
        }
        catch {
            return undefined;
        }
    }
    /**
     * Saves briefing record to database.
     */
    async saveBriefingRecord(briefing) {
        try {
            await this.db.query(`INSERT INTO briefings (id, user_id, script, audio_url, audio_path, audio_duration, status, preferences, aggregated_data, generated_at, published_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
                briefing.id,
                briefing.userId,
                JSON.stringify(briefing.script),
                briefing.audioUrl || null,
                briefing.audioPath || null,
                briefing.audioDuration,
                briefing.status,
                JSON.stringify(briefing.preferences),
                JSON.stringify(briefing.aggregatedData),
                briefing.generatedAt,
                briefing.publishedAt || null,
            ]);
        }
        catch (error) {
            console.error('[MorningBriefingService] Failed to save briefing record:', error);
        }
    }
}
// ============================================================================
// Singleton Export
// ============================================================================
let morningBriefingServiceInstance = null;
export function getMorningBriefingService(options) {
    if (!morningBriefingServiceInstance) {
        morningBriefingServiceInstance = new MorningBriefingService(options);
    }
    return morningBriefingServiceInstance;
}
export default MorningBriefingService;
//# sourceMappingURL=MorningBriefing.js.map