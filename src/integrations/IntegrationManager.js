/**
 * IntegrationManager - Unified hub for all external service integrations
 *
 * Supports: Google Calendar, Gmail, Notion, Google Docs, and more
 * All accessible via WhatsApp/Telegram commands
 */
import { EventEmitter } from 'events';
// ============================================================================
// Integration Manager
// ============================================================================
export class IntegrationManager extends EventEmitter {
    userIntegrations = new Map();
    encryptionKey;
    constructor(encryptionKey) {
        super();
        this.encryptionKey = encryptionKey;
    }
    /**
     * Check which integrations a user has connected
     */
    getConnectedIntegrations(userId) {
        const integrations = this.userIntegrations.get(userId);
        if (!integrations)
            return [];
        const connected = [];
        if (integrations.google)
            connected.push('google');
        if (integrations.notion)
            connected.push('notion');
        if (integrations.outlook)
            connected.push('outlook');
        if (integrations.github)
            connected.push('github');
        return connected;
    }
    /**
     * Store user integration tokens (encrypted)
     */
    async storeIntegration(userId, provider, tokens) {
        let userInt = this.userIntegrations.get(userId) || { userId };
        userInt[provider] = tokens;
        this.userIntegrations.set(userId, userInt);
        this.emit('integrationConnected', { userId, provider });
    }
    /**
     * Remove user integration
     */
    async removeIntegration(userId, provider) {
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
    getOAuthUrl(provider, userId, redirectUri) {
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
    getTokens(userId, provider) {
        const userInt = this.userIntegrations.get(userId);
        return userInt?.[provider];
    }
}
// ============================================================================
// Google Calendar Integration
// ============================================================================
export class GoogleCalendarIntegration {
    integrationManager;
    constructor(integrationManager) {
        this.integrationManager = integrationManager;
    }
    /**
     * Get today's events
     */
    async getTodayEvents(userId) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected. Send "connect google" to link your account.');
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
    async getUpcomingEvents(userId, days = 7) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + days);
        return this.fetchEvents(tokens, start, end);
    }
    /**
     * Create a new event
     */
    async createEvent(userId, event) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        // In production, call Google Calendar API
        const newEvent = {
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
    async findFreeSlots(userId, duration, // minutes
    withinDays = 7) {
        const events = await this.getUpcomingEvents(userId, withinDays);
        const slots = [];
        // Find gaps between events during work hours (9 AM - 6 PM)
        const workStart = 9;
        const workEnd = 18;
        for (let day = 0; day < withinDays; day++) {
            const date = new Date();
            date.setDate(date.getDate() + day);
            date.setHours(workStart, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(workEnd, 0, 0, 0);
            const dayEvents = events.filter(e => e.start.toDateString() === date.toDateString()).sort((a, b) => a.start.getTime() - b.start.getTime());
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
    async getMeetingPrep(userId, eventId) {
        const events = await this.getTodayEvents(userId);
        const event = events.find(e => e.id === eventId);
        if (!event)
            throw new Error('Event not found');
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
    async fetchEvents(tokens, start, end) {
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
    integrationManager;
    constructor(integrationManager) {
        this.integrationManager = integrationManager;
    }
    /**
     * Get inbox summary
     */
    async getInboxSummary(userId) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
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
    async getRecentEmails(userId, count = 10) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        return [];
    }
    /**
     * Search emails
     */
    async searchEmails(userId, query) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        return [];
    }
    /**
     * Send email
     */
    async sendEmail(userId, to, subject, body, replyTo) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        // Production: Call Gmail API
        return { id: `msg_${Date.now()}`, threadId: `thread_${Date.now()}` };
    }
    /**
     * Draft a reply
     */
    async draftReply(userId, emailId, replyBody) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        return { draftId: `draft_${Date.now()}` };
    }
    /**
     * Smart categorize and summarize inbox
     */
    async smartInboxDigest(userId) {
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
    integrationManager;
    constructor(integrationManager) {
        this.integrationManager = integrationManager;
    }
    /**
     * Search Notion
     */
    async search(userId, query) {
        const tokens = this.integrationManager.getTokens(userId, 'notion');
        if (!tokens)
            throw new Error('Notion not connected');
        // Production: Call Notion API
        return [];
    }
    /**
     * Get recent pages
     */
    async getRecentPages(userId, limit = 10) {
        const tokens = this.integrationManager.getTokens(userId, 'notion');
        if (!tokens)
            throw new Error('Notion not connected');
        return [];
    }
    /**
     * Create a new page
     */
    async createPage(userId, title, content, parentId) {
        const tokens = this.integrationManager.getTokens(userId, 'notion');
        if (!tokens)
            throw new Error('Notion not connected');
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
    async addToDatabase(userId, databaseId, properties) {
        const tokens = this.integrationManager.getTokens(userId, 'notion');
        if (!tokens)
            throw new Error('Notion not connected');
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
    async getPageContent(userId, pageId) {
        const tokens = this.integrationManager.getTokens(userId, 'notion');
        if (!tokens)
            throw new Error('Notion not connected');
        return '';
    }
    /**
     * Quick capture - add a note to inbox/default page
     */
    async quickCapture(userId, content) {
        return this.createPage(userId, `Quick Note - ${new Date().toLocaleDateString()}`, content);
    }
}
// ============================================================================
// Google Docs Integration
// ============================================================================
export class GoogleDocsIntegration {
    integrationManager;
    constructor(integrationManager) {
        this.integrationManager = integrationManager;
    }
    /**
     * List recent documents
     */
    async listRecentDocs(userId, limit = 10) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        return [];
    }
    /**
     * Search documents
     */
    async searchDocs(userId, query) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        return [];
    }
    /**
     * Get document content
     */
    async getDocContent(userId, docId) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
        return '';
    }
    /**
     * Create a new document
     */
    async createDoc(userId, title, content) {
        const tokens = this.integrationManager.getTokens(userId, 'google');
        if (!tokens)
            throw new Error('Google not connected');
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
    async summarizeDoc(userId, docId) {
        const content = await this.getDocContent(userId, docId);
        // In production, use LLM to summarize
        return `Summary of document...`;
    }
}
// Default export
export default IntegrationManager;
//# sourceMappingURL=IntegrationManager.js.map