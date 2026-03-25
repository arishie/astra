/**
 * IntegrationManager - Unified hub for all external service integrations
 *
 * Supports: Google Calendar, Gmail, Notion, Google Docs, and more
 * All accessible via WhatsApp/Telegram commands
 */
import { EventEmitter } from 'events';
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
    attachments?: {
        name: string;
        mimeType: string;
        size: number;
    }[];
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
export declare class IntegrationManager extends EventEmitter {
    private userIntegrations;
    private encryptionKey;
    constructor(encryptionKey: string);
    /**
     * Check which integrations a user has connected
     */
    getConnectedIntegrations(userId: string): string[];
    /**
     * Store user integration tokens (encrypted)
     */
    storeIntegration(userId: string, provider: 'google' | 'notion' | 'outlook' | 'github', tokens: any): Promise<void>;
    /**
     * Remove user integration
     */
    removeIntegration(userId: string, provider: 'google' | 'notion' | 'outlook' | 'github'): Promise<void>;
    /**
     * Get OAuth URL for connecting integrations
     */
    getOAuthUrl(provider: string, userId: string, redirectUri: string): string;
    /**
     * Get integration tokens for a user
     */
    getTokens(userId: string, provider: string): any;
}
export declare class GoogleCalendarIntegration {
    private integrationManager;
    constructor(integrationManager: IntegrationManager);
    /**
     * Get today's events
     */
    getTodayEvents(userId: string): Promise<CalendarEvent[]>;
    /**
     * Get upcoming events
     */
    getUpcomingEvents(userId: string, days?: number): Promise<CalendarEvent[]>;
    /**
     * Create a new event
     */
    createEvent(userId: string, event: {
        title: string;
        start: Date;
        end: Date;
        description?: string;
        location?: string;
        attendees?: string[];
    }): Promise<CalendarEvent>;
    /**
     * Find free slots for scheduling
     */
    findFreeSlots(userId: string, duration: number, // minutes
    withinDays?: number): Promise<{
        start: Date;
        end: Date;
    }[]>;
    /**
     * Get meeting prep info
     */
    getMeetingPrep(userId: string, eventId: string): Promise<{
        event: CalendarEvent;
        attendeeInfo: string[];
        relatedDocs: string[];
        suggestedAgenda: string[];
    }>;
    private fetchEvents;
}
export declare class GmailIntegration {
    private integrationManager;
    constructor(integrationManager: IntegrationManager);
    /**
     * Get inbox summary
     */
    getInboxSummary(userId: string): Promise<{
        unreadCount: number;
        importantUnread: Email[];
        categories: {
            name: string;
            count: number;
        }[];
    }>;
    /**
     * Get recent emails
     */
    getRecentEmails(userId: string, count?: number): Promise<Email[]>;
    /**
     * Search emails
     */
    searchEmails(userId: string, query: string): Promise<Email[]>;
    /**
     * Send email
     */
    sendEmail(userId: string, to: string[], subject: string, body: string, replyTo?: string): Promise<{
        id: string;
        threadId: string;
    }>;
    /**
     * Draft a reply
     */
    draftReply(userId: string, emailId: string, replyBody: string): Promise<{
        draftId: string;
    }>;
    /**
     * Smart categorize and summarize inbox
     */
    smartInboxDigest(userId: string): Promise<{
        urgent: {
            email: Email;
            summary: string;
        }[];
        needsResponse: {
            email: Email;
            suggestedReply: string;
        }[];
        fyi: {
            email: Email;
            summary: string;
        }[];
    }>;
}
export declare class NotionIntegration {
    private integrationManager;
    constructor(integrationManager: IntegrationManager);
    /**
     * Search Notion
     */
    search(userId: string, query: string): Promise<NotionPage[]>;
    /**
     * Get recent pages
     */
    getRecentPages(userId: string, limit?: number): Promise<NotionPage[]>;
    /**
     * Create a new page
     */
    createPage(userId: string, title: string, content: string, parentId?: string): Promise<NotionPage>;
    /**
     * Add to database
     */
    addToDatabase(userId: string, databaseId: string, properties: Record<string, any>): Promise<NotionPage>;
    /**
     * Get page content
     */
    getPageContent(userId: string, pageId: string): Promise<string>;
    /**
     * Quick capture - add a note to inbox/default page
     */
    quickCapture(userId: string, content: string): Promise<NotionPage>;
}
export declare class GoogleDocsIntegration {
    private integrationManager;
    constructor(integrationManager: IntegrationManager);
    /**
     * List recent documents
     */
    listRecentDocs(userId: string, limit?: number): Promise<Document[]>;
    /**
     * Search documents
     */
    searchDocs(userId: string, query: string): Promise<Document[]>;
    /**
     * Get document content
     */
    getDocContent(userId: string, docId: string): Promise<string>;
    /**
     * Create a new document
     */
    createDoc(userId: string, title: string, content: string): Promise<Document>;
    /**
     * Summarize a document
     */
    summarizeDoc(userId: string, docId: string): Promise<string>;
}
export default IntegrationManager;
//# sourceMappingURL=IntegrationManager.d.ts.map