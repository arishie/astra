/**
 * SmartCommands - The brain that powers WhatsApp/Telegram interactions
 *
 * Natural language commands that feel magical:
 *
 * PRODUCTIVITY:
 * - "What's on my calendar today?"
 * - "Schedule meeting with John tomorrow 3pm"
 * - "Find a free slot for a 1 hour meeting next week"
 * - "Remind me to call mom in 2 hours"
 * - "Check my emails"
 * - "Reply to that email saying I'll be there"
 *
 * KNOWLEDGE:
 * - "What did we discuss about the project?" (searches memory)
 * - "Find that document about marketing"
 * - "Save this to Notion"
 *
 * MEDIA:
 * - [Send voice message] → Transcribed and executed
 * - [Send screenshot] → Analyzed and explained
 * - [Send PDF] → Summarized
 *
 * META:
 * - "Connect my Google account"
 * - "What can you do?"
 * - "Settings"
 */
import { EventEmitter } from 'events';
export interface IncomingMessage {
    id: string;
    userId: string;
    platform: 'whatsapp' | 'telegram' | 'discord' | 'slack';
    type: 'text' | 'voice' | 'image' | 'document' | 'video';
    text?: string;
    mediaPath?: string;
    mediaMimeType?: string;
    caption?: string;
    replyTo?: string;
    timestamp: Date;
}
export interface CommandResponse {
    text: string;
    buttons?: {
        label: string;
        action: string;
    }[];
    quickReplies?: string[];
    mediaUrl?: string;
    mediaType?: 'image' | 'document' | 'audio';
}
export interface UserContext {
    userId: string;
    platform: string;
    lastCommand?: string;
    lastCommandTime?: Date;
    pendingAction?: {
        type: string;
        data: any;
        expiresAt: Date;
    };
    conversationHistory: {
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }[];
}
export declare class SmartCommands extends EventEmitter {
    private integrationManager;
    private calendar;
    private gmail;
    private notion;
    private docs;
    private voiceProcessor;
    private screenshotAI;
    private userContexts;
    constructor(encryptionKey: string);
    /**
     * Process any incoming message
     */
    processMessage(message: IncomingMessage): Promise<CommandResponse>;
    /**
     * Handle text messages
     */
    private handleTextMessage;
    /**
     * Handle voice messages
     */
    private handleVoiceMessage;
    /**
     * Handle image/screenshot messages
     */
    private handleImageMessage;
    /**
     * Handle document messages (PDFs, etc.)
     */
    private handleDocumentMessage;
    /**
     * Handle connection commands
     */
    private handleConnectCommand;
    /**
     * Handle disconnect commands
     */
    private handleDisconnectCommand;
    /**
     * Handle calendar-related commands
     */
    private handleCalendarCommand;
    /**
     * Handle email-related commands
     */
    private handleEmailCommand;
    /**
     * Handle reminder commands
     */
    private handleReminderCommand;
    /**
     * Handle note commands
     */
    private handleNoteCommand;
    /**
     * Handle search commands
     */
    private handleSearchCommand;
    /**
     * Handle general conversation
     */
    private handleConversation;
    /**
     * Handle pending action confirmation
     */
    private handlePendingAction;
    /**
     * Get help message
     */
    private getHelpMessage;
    /**
     * Get status message
     */
    private getStatusMessage;
    /**
     * Get provider features description
     */
    private getProviderFeatures;
    /**
     * Get or create user context
     */
    private getOrCreateContext;
}
export default SmartCommands;
//# sourceMappingURL=SmartCommands.d.ts.map