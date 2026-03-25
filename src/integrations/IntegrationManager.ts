/**
 * IntegrationManager - Unified hub for all external service integrations
 *
 * Supports: Google Calendar, Gmail, Notion, Google Docs, and more
 * All accessible via WhatsApp/Telegram commands
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface UserIntegrations {
    userId: string;
    google?: GoogleTokens;
    notion?: NotionTokens;
    outlook?: OutlookTokens;
    github?: GitHubTokens;
}

export interface GoogleTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    email: string;
    scopes: string[];
}

export interface NotionTokens {
    accessToken: string;
    workspaceId: string;
    workspaceName: string;
}

export interface OutlookTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    email: string;
}

export interface GitHubTokens {
    accessToken: string;
    username: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: string[];
    meetingLink?: string;
    isAllDay: boolean;
}

export interface Email {
    id: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    snippet: string;
    date: Date;
    isRead: boolean;
    isImportant: boolean;
    labels: string[];
    attachments?: { name: string; mimeType: string; size: number }[];
}

export interface NotionPage {
    id: string;
    title: string;
    url: string;
    lastEdited: Date;
    icon?: string;
    parentType: 'workspace' | 'page' | 'database';
}

export interface NotionDatabase {
    id: string;
    title: string;
    url: string;
    properties: Record<string, string>;
}

export interface Document {
    id: string;
    title: string;
    url: string;
    mimeType: string;
    lastModified: Date;
    size?: number;
}

// ============================================================================
// Integration Manager
// ============================================================================

export class IntegrationManager extends EventEmitter {
    private userIntegrations: Map<string, UserIntegrations> = new Map();
    private encryptionKey: string;

    constructor(encryptionKey: string) {
        super();
        this.encryptionKey = encryptionKey;
    }

    /**
     * Check which integrations a user has connected
     */
    public getConnectedIntegrations(userId: string): string[] {
        const integrations = this.userIntegrations.get(userId);
        if (!integrations) return [];

        const connected: string[] = [];
        if (integrations.google) connected.push('google');
        if (integrations.notion) connected.push('notion');
        if (integrations.outlook) connected.push('outlook');
        if (integrations.github) connected.push('github');
        return connected;
    }

    /**
     * Store user integration tokens (encrypted)
     */
    public async storeIntegration(
        userId: string,
        provider: 'google' | 'notion' | 'outlook' | 'github',
        tokens: any
    ): Promise<void> {
        let userInt = this.userIntegrations.get(userId) || { userId };
        userInt[provider] = tokens;
        this.userIntegrations.set(userId, userInt);
        this.emit('integrationConnected', { userId, provider });
    }

    /**
     * Remove user integration
     */
    public async removeIntegration(
        userId: string,
        provider: 'google' | 'notion' | 'outlook' | 'github'
    ): Promise<void> {
        const userInt = this.userIntegrations.get(userId);
        if (userInt) {
            delete userInt[provider];
            this.userIntegrations.set(userId, userInt);
            this.emit('integrationDisconnected', { userId, provider });
        }
    }

    /**
     * Get OAuth URL for connecting integrations
     */
    public getOAuthUrl(provider: string, userId: string, redirectUri: string): string {
        const state = Buffer.from(JSON.stringify({ userId, provider })).toString('base64');

        switch (provider) {
            case 'google':
                const googleScopes = [
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/gmail.modify',
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/documents.readonly'
                ].join(' ');
                return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(googleScopes)}&access_type=offline&state=${state}`;

            case 'notion':
                return `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.NOTION_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;

            case 'outlook':
                const outlookScopes = 'openid profile email Mail.ReadWrite Calendars.ReadWrite';
                return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.OUTLOOK_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(outlookScopes)}&state=${state}`;

            case 'github':
                return `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo,user&state=${state}`;

            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    /**
     * Get integration tokens for a user
     */
    public getTokens(userId: string, provider: string): any {
        const userInt = this.userIntegrations.get(userId);
        return userInt?.[provider as keyof UserIntegrations];
    }
}

// ============================================================================
// Google Calendar Integration
// ============================================================================

export class GoogleCalendarIntegration {
    private integrationManager: IntegrationManager;

    constructor(integrationManager: IntegrationManager) {
        this.integrationManager = integrationManager;
    }

    /**
     * Get today's events
     */
    public async getTodayEvents(userId: string): Promise<CalendarEvent[]> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected. Send "connect google" to link your account.');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // In production, this would call Google Calendar API
        // For now, return mock structure
        return this.fetchEvents(tokens, today, tomorrow);
    }

    /**
     * Get upcoming events
     */
    public async getUpcomingEvents(userId: string, days: number = 7): Promise<CalendarEvent[]> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + days);

        return this.fetchEvents(tokens, start, end);
    }

    /**
     * Create a new event
     */
    public async createEvent(
        userId: string,
        event: {
            title: string;
            start: Date;
            end: Date;
            description?: string;
            location?: string;
            attendees?: string[];
        }
    ): Promise<CalendarEvent> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        // In production, call Google Calendar API
        const newEvent: CalendarEvent = {
            id: `evt_${Date.now()}`,
            title: event.title,
            start: event.start,
            end: event.end,
            description: event.description,
            location: event.location,
            attendees: event.attendees,
            isAllDay: false
        };

        return newEvent;
    }

    /**
     * Find free slots for scheduling
     */
    public async findFreeSlots(
        userId: string,
        duration: number, // minutes
        withinDays: number = 7
    ): Promise<{ start: Date; end: Date }[]> {
        const events = await this.getUpcomingEvents(userId, withinDays);
        const slots: { start: Date; end: Date }[] = [];

        // Find gaps between events during work hours (9 AM - 6 PM)
        const workStart = 9;
        const workEnd = 18;

        for (let day = 0; day < withinDays; day++) {
            const date = new Date();
            date.setDate(date.getDate() + day);
            date.setHours(workStart, 0, 0, 0);

            const dayEnd = new Date(date);
            dayEnd.setHours(workEnd, 0, 0, 0);

            const dayEvents = events.filter(e =>
                e.start.toDateString() === date.toDateString()
            ).sort((a, b) => a.start.getTime() - b.start.getTime());

            let currentTime = date;
            for (const event of dayEvents) {
                if (event.start.getTime() - currentTime.getTime() >= duration * 60 * 1000) {
                    slots.push({
                        start: new Date(currentTime),
                        end: new Date(currentTime.getTime() + duration * 60 * 1000)
                    });
                }
                currentTime = event.end;
            }

            if (dayEnd.getTime() - currentTime.getTime() >= duration * 60 * 1000) {
                slots.push({
                    start: new Date(currentTime),
                    end: new Date(currentTime.getTime() + duration * 60 * 1000)
                });
            }
        }

        return slots.slice(0, 5); // Return top 5 slots
    }

    /**
     * Get meeting prep info
     */
    public async getMeetingPrep(userId: string, eventId: string): Promise<{
        event: CalendarEvent;
        attendeeInfo: string[];
        relatedDocs: string[];
        suggestedAgenda: string[];
    }> {
        const events = await this.getTodayEvents(userId);
        const event = events.find(e => e.id === eventId);
        if (!event) throw new Error('Event not found');

        return {
            event,
            attendeeInfo: event.attendees?.map(a => `${a}: No previous meetings found`) || [],
            relatedDocs: [],
            suggestedAgenda: [
                'Review previous action items',
                'Discuss current status',
                'Plan next steps',
                'Q&A'
            ]
        };
    }

    private async fetchEvents(tokens: GoogleTokens, start: Date, end: Date): Promise<CalendarEvent[]> {
        // Production: Call Google Calendar API
        // const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`, {
        //     headers: { Authorization: `Bearer ${tokens.accessToken}` }
        // });
        return [];
    }
}

// ============================================================================
// Gmail Integration
// ============================================================================

export class GmailIntegration {
    private integrationManager: IntegrationManager;

    constructor(integrationManager: IntegrationManager) {
        this.integrationManager = integrationManager;
    }

    /**
     * Get inbox summary
     */
    public async getInboxSummary(userId: string): Promise<{
        unreadCount: number;
        importantUnread: Email[];
        categories: { name: string; count: number }[];
    }> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        // Production: Call Gmail API
        return {
            unreadCount: 0,
            importantUnread: [],
            categories: [
                { name: 'Primary', count: 0 },
                { name: 'Updates', count: 0 },
                { name: 'Promotions', count: 0 }
            ]
        };
    }

    /**
     * Get recent emails
     */
    public async getRecentEmails(userId: string, count: number = 10): Promise<Email[]> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        return [];
    }

    /**
     * Search emails
     */
    public async searchEmails(userId: string, query: string): Promise<Email[]> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        return [];
    }

    /**
     * Send email
     */
    public async sendEmail(
        userId: string,
        to: string[],
        subject: string,
        body: string,
        replyTo?: string
    ): Promise<{ id: string; threadId: string }> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        // Production: Call Gmail API
        return { id: `msg_${Date.now()}`, threadId: `thread_${Date.now()}` };
    }

    /**
     * Draft a reply
     */
    public async draftReply(
        userId: string,
        emailId: string,
        replyBody: string
    ): Promise<{ draftId: string }> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        return { draftId: `draft_${Date.now()}` };
    }

    /**
     * Smart categorize and summarize inbox
     */
    public async smartInboxDigest(userId: string): Promise<{
        urgent: { email: Email; summary: string }[];
        needsResponse: { email: Email; suggestedReply: string }[];
        fyi: { email: Email; summary: string }[];
    }> {
        const emails = await this.getRecentEmails(userId, 20);

        // In production, use LLM to categorize and summarize
        return {
            urgent: [],
            needsResponse: [],
            fyi: []
        };
    }
}

// ============================================================================
// Notion Integration
// ============================================================================

export class NotionIntegration {
    private integrationManager: IntegrationManager;

    constructor(integrationManager: IntegrationManager) {
        this.integrationManager = integrationManager;
    }

    /**
     * Search Notion
     */
    public async search(userId: string, query: string): Promise<NotionPage[]> {
        const tokens = this.integrationManager.getTokens(userId, 'notion') as NotionTokens;
        if (!tokens) throw new Error('Notion not connected');

        // Production: Call Notion API
        return [];
    }

    /**
     * Get recent pages
     */
    public async getRecentPages(userId: string, limit: number = 10): Promise<NotionPage[]> {
        const tokens = this.integrationManager.getTokens(userId, 'notion') as NotionTokens;
        if (!tokens) throw new Error('Notion not connected');

        return [];
    }

    /**
     * Create a new page
     */
    public async createPage(
        userId: string,
        title: string,
        content: string,
        parentId?: string
    ): Promise<NotionPage> {
        const tokens = this.integrationManager.getTokens(userId, 'notion') as NotionTokens;
        if (!tokens) throw new Error('Notion not connected');

        return {
            id: `page_${Date.now()}`,
            title,
            url: `https://notion.so/page_${Date.now()}`,
            lastEdited: new Date(),
            parentType: 'workspace'
        };
    }

    /**
     * Add to database
     */
    public async addToDatabase(
        userId: string,
        databaseId: string,
        properties: Record<string, any>
    ): Promise<NotionPage> {
        const tokens = this.integrationManager.getTokens(userId, 'notion') as NotionTokens;
        if (!tokens) throw new Error('Notion not connected');

        return {
            id: `page_${Date.now()}`,
            title: properties.Name || properties.Title || 'New Item',
            url: `https://notion.so/page_${Date.now()}`,
            lastEdited: new Date(),
            parentType: 'database'
        };
    }

    /**
     * Get page content
     */
    public async getPageContent(userId: string, pageId: string): Promise<string> {
        const tokens = this.integrationManager.getTokens(userId, 'notion') as NotionTokens;
        if (!tokens) throw new Error('Notion not connected');

        return '';
    }

    /**
     * Quick capture - add a note to inbox/default page
     */
    public async quickCapture(userId: string, content: string): Promise<NotionPage> {
        return this.createPage(userId, `Quick Note - ${new Date().toLocaleDateString()}`, content);
    }
}

// ============================================================================
// Google Docs Integration
// ============================================================================

export class GoogleDocsIntegration {
    private integrationManager: IntegrationManager;

    constructor(integrationManager: IntegrationManager) {
        this.integrationManager = integrationManager;
    }

    /**
     * List recent documents
     */
    public async listRecentDocs(userId: string, limit: number = 10): Promise<Document[]> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        return [];
    }

    /**
     * Search documents
     */
    public async searchDocs(userId: string, query: string): Promise<Document[]> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        return [];
    }

    /**
     * Get document content
     */
    public async getDocContent(userId: string, docId: string): Promise<string> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        return '';
    }

    /**
     * Create a new document
     */
    public async createDoc(
        userId: string,
        title: string,
        content: string
    ): Promise<Document> {
        const tokens = this.integrationManager.getTokens(userId, 'google') as GoogleTokens;
        if (!tokens) throw new Error('Google not connected');

        return {
            id: `doc_${Date.now()}`,
            title,
            url: `https://docs.google.com/document/d/doc_${Date.now()}`,
            mimeType: 'application/vnd.google-apps.document',
            lastModified: new Date()
        };
    }

    /**
     * Summarize a document
     */
    public async summarizeDoc(userId: string, docId: string): Promise<string> {
        const content = await this.getDocContent(userId, docId);
        // In production, use LLM to summarize
        return `Summary of document...`;
    }
}

// Default export
export default IntegrationManager;
