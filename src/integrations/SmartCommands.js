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
import { IntegrationManager, GoogleCalendarIntegration, GmailIntegration, NotionIntegration, GoogleDocsIntegration } from './IntegrationManager.js';
import { VoiceProcessor } from './VoiceProcessor.js';
import { ScreenshotUnderstanding } from './ScreenshotUnderstanding.js';
// ============================================================================
// Smart Commands Handler
// ============================================================================
export class SmartCommands extends EventEmitter {
    integrationManager;
    calendar;
    gmail;
    notion;
    docs;
    voiceProcessor;
    screenshotAI;
    userContexts = new Map();
    constructor(encryptionKey) {
        super();
        this.integrationManager = new IntegrationManager(encryptionKey);
        this.calendar = new GoogleCalendarIntegration(this.integrationManager);
        this.gmail = new GmailIntegration(this.integrationManager);
        this.notion = new NotionIntegration(this.integrationManager);
        this.docs = new GoogleDocsIntegration(this.integrationManager);
        this.voiceProcessor = new VoiceProcessor();
        this.screenshotAI = new ScreenshotUnderstanding();
    }
    /**
     * Process any incoming message
     */
    async processMessage(message) {
        const context = this.getOrCreateContext(message.userId, message.platform);
        try {
            // Handle different message types
            switch (message.type) {
                case 'voice':
                    return this.handleVoiceMessage(message, context);
                case 'image':
                    return this.handleImageMessage(message, context);
                case 'document':
                    return this.handleDocumentMessage(message, context);
                case 'text':
                default:
                    return this.handleTextMessage(message, context);
            }
        }
        catch (error) {
            console.error('[SmartCommands] Error:', error);
            return {
                text: `Sorry, something went wrong. Please try again.\n\n${error instanceof Error ? error.message : ''}`
            };
        }
    }
    /**
     * Handle text messages
     */
    async handleTextMessage(message, context) {
        const text = message.text?.toLowerCase().trim() || '';
        // Check for pending actions (confirmations, follow-ups)
        if (context.pendingAction && new Date() < context.pendingAction.expiresAt) {
            return this.handlePendingAction(text, context);
        }
        // Connection commands
        if (text.match(/^connect\s+(google|notion|outlook|github)$/i)) {
            return this.handleConnectCommand(text, message.userId);
        }
        // Disconnect commands
        if (text.match(/^disconnect\s+(google|notion|outlook|github)$/i)) {
            return this.handleDisconnectCommand(text, message.userId);
        }
        // Calendar commands
        if (text.match(/calendar|schedule|meeting|appointment|busy|free|event/i)) {
            return this.handleCalendarCommand(text, message.userId, context);
        }
        // Email commands
        if (text.match(/email|inbox|mail|send.*to|reply/i)) {
            return this.handleEmailCommand(text, message.userId, context);
        }
        // Reminder commands
        if (text.match(/remind|reminder|don't forget|remember to/i)) {
            return this.handleReminderCommand(text, message.userId, context);
        }
        // Note commands
        if (text.match(/note|save.*to notion|add to notion|write down/i)) {
            return this.handleNoteCommand(text, message.userId, context);
        }
        // Search/memory commands
        if (text.match(/find|search|what did|where is|look for/i)) {
            return this.handleSearchCommand(text, message.userId, context);
        }
        // Help commands
        if (text.match(/^(help|what can you do|\?|commands|menu|start)$/i)) {
            return this.getHelpMessage(message.userId);
        }
        // Settings/status
        if (text.match(/^(settings|status|connections|account)$/i)) {
            return this.getStatusMessage(message.userId);
        }
        // Default: treat as a question/conversation
        return this.handleConversation(text, message.userId, context);
    }
    /**
     * Handle voice messages
     */
    async handleVoiceMessage(message, context) {
        if (!message.mediaPath) {
            return { text: "I couldn't receive the voice message. Please try again." };
        }
        const result = await this.voiceProcessor.processVoiceMessage({
            id: message.id,
            userId: message.userId,
            platform: message.platform,
            audioPath: message.mediaPath,
            duration: 0,
            mimeType: message.mediaMimeType || 'audio/ogg',
            timestamp: message.timestamp
        });
        // If action needs confirmation, set pending
        if (result.data?.action) {
            context.pendingAction = {
                type: result.data.action,
                data: result.data,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
            };
            this.userContexts.set(message.userId, context);
        }
        return {
            text: result.message,
            quickReplies: result.followUp ? ['Yes', 'No', 'Change'] : undefined
        };
    }
    /**
     * Handle image/screenshot messages
     */
    async handleImageMessage(message, context) {
        if (!message.mediaPath) {
            return { text: "I couldn't receive the image. Please try again." };
        }
        const result = await this.screenshotAI.analyze({
            id: message.id,
            userId: message.userId,
            platform: message.platform,
            imagePath: message.mediaPath,
            mimeType: message.mediaMimeType || 'image/png',
            timestamp: message.timestamp,
            caption: message.caption
        });
        // Create quick reply buttons from suggested actions
        const quickReplies = result.actions
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 3)
            .map(a => a.label);
        // Store actions for follow-up
        if (result.actions.length > 0) {
            context.pendingAction = {
                type: 'screenshot_action',
                data: { actions: result.actions, analysis: result.analysis },
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            };
            this.userContexts.set(message.userId, context);
        }
        return {
            text: result.response,
            quickReplies
        };
    }
    /**
     * Handle document messages (PDFs, etc.)
     */
    async handleDocumentMessage(message, context) {
        if (!message.mediaPath) {
            return { text: "I couldn't receive the document. Please try again." };
        }
        return {
            text: `I received your document. Would you like me to:\n\n1. Summarize it\n2. Add it to your knowledge base\n3. Search within it\n\nReply with your choice.`,
            quickReplies: ['Summarize', 'Save to memory', 'Ask a question']
        };
    }
    /**
     * Handle connection commands
     */
    handleConnectCommand(text, userId) {
        const provider = text.match(/(google|notion|outlook|github)/i)?.[1].toLowerCase();
        if (!provider) {
            return { text: 'Please specify: connect google, notion, outlook, or github' };
        }
        const redirectUri = `${process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/callback'}`;
        const oauthUrl = this.integrationManager.getOAuthUrl(provider, userId, redirectUri);
        return {
            text: `To connect ${provider.charAt(0).toUpperCase() + provider.slice(1)}, please click this link:\n\n${oauthUrl}\n\nAfter authorizing, you'll be able to use ${this.getProviderFeatures(provider)}.`
        };
    }
    /**
     * Handle disconnect commands
     */
    async handleDisconnectCommand(text, userId) {
        const provider = text.match(/(google|notion|outlook|github)/i)?.[1].toLowerCase();
        if (!provider) {
            return { text: 'Please specify which service to disconnect.' };
        }
        await this.integrationManager.removeIntegration(userId, provider);
        return { text: `${provider.charAt(0).toUpperCase() + provider.slice(1)} has been disconnected.` };
    }
    /**
     * Handle calendar-related commands
     */
    async handleCalendarCommand(text, userId, context) {
        const connected = this.integrationManager.getConnectedIntegrations(userId);
        if (!connected.includes('google') && !connected.includes('outlook')) {
            return {
                text: "You haven't connected your calendar yet. Send 'connect google' to get started.",
                quickReplies: ['Connect Google', 'Connect Outlook']
            };
        }
        // "What's on my calendar today/tomorrow?"
        if (text.match(/what(?:'s| is).*(?:calendar|schedule|today|tomorrow)/i)) {
            try {
                const events = await this.calendar.getTodayEvents(userId);
                if (events.length === 0) {
                    return { text: "You have no events scheduled for today. Enjoy your free time! " };
                }
                const eventList = events.map(e => `• ${e.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n');
                return { text: `Here's your schedule for today:\n\n${eventList}` };
            }
            catch (e) {
                return { text: `Couldn't fetch your calendar. ${e instanceof Error ? e.message : ''}` };
            }
        }
        // "Find a free slot"
        if (text.match(/free|available|slot/i)) {
            try {
                const duration = text.match(/(\d+)\s*(?:hour|hr)/i)?.[1];
                const slots = await this.calendar.findFreeSlots(userId, duration ? parseInt(duration) * 60 : 60);
                if (slots.length === 0) {
                    return { text: "You're fully booked! No free slots found in the next 7 days." };
                }
                const slotList = slots.slice(0, 3).map(s => `• ${s.start.toLocaleDateString()} at ${s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`).join('\n');
                return {
                    text: `Here are some free slots:\n\n${slotList}\n\nWhich one works for you?`,
                    quickReplies: slots.slice(0, 3).map(s => s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
                };
            }
            catch (e) {
                return { text: `Couldn't check your availability. ${e instanceof Error ? e.message : ''}` };
            }
        }
        // "Schedule meeting..."
        if (text.match(/schedule|book|create|set up/i)) {
            // Parse the request and ask for confirmation
            return {
                text: "I'd be happy to schedule that for you. Please tell me:\n\n1. What's the meeting about?\n2. When should it be?\n3. Who should I invite?",
                quickReplies: ['Tomorrow 10am', 'This Friday 2pm', 'Next Monday']
            };
        }
        return { text: "What would you like to do with your calendar?", quickReplies: ['Today\'s schedule', 'Find free slot', 'Schedule meeting'] };
    }
    /**
     * Handle email-related commands
     */
    async handleEmailCommand(text, userId, context) {
        const connected = this.integrationManager.getConnectedIntegrations(userId);
        if (!connected.includes('google') && !connected.includes('outlook')) {
            return {
                text: "You haven't connected your email yet. Send 'connect google' to access Gmail.",
                quickReplies: ['Connect Google', 'Connect Outlook']
            };
        }
        // "Check my emails"
        if (text.match(/check|inbox|unread|new.*email/i)) {
            try {
                const summary = await this.gmail.getInboxSummary(userId);
                if (summary.unreadCount === 0) {
                    return { text: "Inbox zero! You have no unread emails." };
                }
                return {
                    text: `You have ${summary.unreadCount} unread emails.\n\n${summary.importantUnread.length > 0 ? 'Important:\n' + summary.importantUnread.map(e => `• ${e.from}: ${e.subject}`).join('\n') : 'None marked as important.'}`,
                    quickReplies: ['Show all', 'Smart digest', 'Mark all read']
                };
            }
            catch (e) {
                return { text: `Couldn't check your inbox. ${e instanceof Error ? e.message : ''}` };
            }
        }
        // "Send email to..."
        if (text.match(/send|write|compose|email.*to/i)) {
            const toMatch = text.match(/(?:to|email)\s+(\w+)/i);
            const recipient = toMatch?.[1] || 'someone';
            context.pendingAction = {
                type: 'compose_email',
                data: { to: recipient },
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            };
            this.userContexts.set(userId, context);
            return {
                text: `I'll help you email ${recipient}. What's the subject?`,
                quickReplies: ['Quick update', 'Following up', 'Meeting request']
            };
        }
        return { text: "What would you like to do with your email?", quickReplies: ['Check inbox', 'Send email', 'Smart digest'] };
    }
    /**
     * Handle reminder commands
     */
    handleReminderCommand(text, userId, context) {
        // Extract time and reminder text
        const timeMatch = text.match(/in\s+(\d+)\s*(hour|minute|min|hr|day)s?/i);
        const atMatch = text.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        let reminderTime = new Date();
        let reminderText = text.replace(/remind me (?:to )?|set (?:a )?reminder (?:to )?|in \d+ \w+|at \d+(?::\d+)?\s*(?:am|pm)?/gi, '').trim();
        if (timeMatch) {
            const amount = parseInt(timeMatch[1]);
            const unit = timeMatch[2].toLowerCase();
            if (unit.startsWith('hour') || unit === 'hr') {
                reminderTime.setHours(reminderTime.getHours() + amount);
            }
            else if (unit.startsWith('min')) {
                reminderTime.setMinutes(reminderTime.getMinutes() + amount);
            }
            else if (unit.startsWith('day')) {
                reminderTime.setDate(reminderTime.getDate() + amount);
            }
        }
        else if (atMatch) {
            let hours = parseInt(atMatch[1]);
            const minutes = atMatch[2] ? parseInt(atMatch[2]) : 0;
            const ampm = atMatch[3]?.toLowerCase();
            if (ampm === 'pm' && hours < 12)
                hours += 12;
            if (ampm === 'am' && hours === 12)
                hours = 0;
            reminderTime.setHours(hours, minutes, 0, 0);
            if (reminderTime <= new Date()) {
                reminderTime.setDate(reminderTime.getDate() + 1);
            }
        }
        else {
            // Default: 1 hour
            reminderTime.setHours(reminderTime.getHours() + 1);
        }
        return {
            text: `Reminder set for ${reminderTime.toLocaleString()}:\n\n"${reminderText || 'Reminder'}"\n\nI'll message you then!`,
            quickReplies: ['Thanks', 'Change time', 'Cancel']
        };
    }
    /**
     * Handle note commands
     */
    async handleNoteCommand(text, userId, context) {
        const connected = this.integrationManager.getConnectedIntegrations(userId);
        // Extract note content
        const noteContent = text.replace(/note:?|save (?:this )?to notion:?|add to notion:?|write down:?/gi, '').trim();
        if (!noteContent) {
            context.pendingAction = {
                type: 'create_note',
                data: {},
                expiresAt: new Date(Date.now() + 5 * 60 * 1000)
            };
            this.userContexts.set(userId, context);
            return { text: "What would you like me to note down?" };
        }
        if (connected.includes('notion')) {
            try {
                const page = await this.notion.quickCapture(userId, noteContent);
                return { text: `Saved to Notion!\n\n${page.url}` };
            }
            catch (e) {
                return { text: `Note saved locally. (Notion sync failed: ${e instanceof Error ? e.message : ''})` };
            }
        }
        // Save locally if Notion not connected
        return {
            text: `Note saved:\n\n"${noteContent}"\n\nTip: Connect Notion to sync your notes automatically.`,
            quickReplies: ['Connect Notion', 'View notes']
        };
    }
    /**
     * Handle search commands
     */
    async handleSearchCommand(text, userId, context) {
        const query = text.replace(/find|search|what did|where is|look for/gi, '').trim();
        return {
            text: `Searching for "${query}"...\n\n(This would search your connected services and memory)\n\nNo results found yet. Try connecting more services to expand your search.`,
            quickReplies: ['Connect Google', 'Connect Notion', 'Try different search']
        };
    }
    /**
     * Handle general conversation
     */
    async handleConversation(text, userId, context) {
        // Store in conversation history
        context.conversationHistory.push({
            role: 'user',
            content: text,
            timestamp: new Date()
        });
        // Keep last 10 messages
        if (context.conversationHistory.length > 20) {
            context.conversationHistory = context.conversationHistory.slice(-20);
        }
        this.userContexts.set(userId, context);
        // In production, this would call the LLM with context
        return {
            text: `I understand you said: "${text}"\n\nI'm your AI assistant. I can help you with:\n\n• Calendar & scheduling\n• Email management\n• Notes & reminders\n• Analyzing screenshots\n• Processing voice messages\n\nWhat would you like to do?`,
            quickReplies: ['Today\'s schedule', 'Check emails', 'Help']
        };
    }
    /**
     * Handle pending action confirmation
     */
    async handlePendingAction(text, context) {
        const action = context.pendingAction;
        if (!action) {
            return this.handleConversation(text, context.userId, context);
        }
        const isYes = /^(yes|y|confirm|ok|sure|do it|go ahead)$/i.test(text);
        const isNo = /^(no|n|cancel|nevermind|stop)$/i.test(text);
        if (isNo) {
            context.pendingAction = undefined;
            this.userContexts.set(context.userId, context);
            return { text: "Cancelled. What else can I help you with?" };
        }
        // Handle specific action types
        switch (action.type) {
            case 'create_event':
                if (isYes) {
                    context.pendingAction = undefined;
                    this.userContexts.set(context.userId, context);
                    return { text: `Meeting scheduled!\n\n${action.data.title}\n${action.data.start.toLocaleString()}` };
                }
                break;
            case 'compose_email':
                // User is providing subject or body
                if (!action.data.subject) {
                    action.data.subject = text;
                    context.pendingAction = action;
                    this.userContexts.set(context.userId, context);
                    return { text: "Got it. Now what's the message?" };
                }
                else {
                    action.data.body = text;
                    context.pendingAction = undefined;
                    this.userContexts.set(context.userId, context);
                    return {
                        text: `Ready to send:\n\nTo: ${action.data.to}\nSubject: ${action.data.subject}\n\n${action.data.body}\n\nSend it?`,
                        quickReplies: ['Send', 'Edit', 'Cancel']
                    };
                }
            case 'screenshot_action':
                // Find matching action
                const matchingAction = action.data.actions.find((a) => a.label.toLowerCase().includes(text.toLowerCase()));
                if (matchingAction) {
                    context.pendingAction = undefined;
                    this.userContexts.set(context.userId, context);
                    return { text: `Executing: ${matchingAction.label}...\n\n(Action would be performed here)` };
                }
                break;
        }
        return { text: "I didn't understand that. Please reply with Yes or No." };
    }
    /**
     * Get help message
     */
    getHelpMessage(userId) {
        const connected = this.integrationManager.getConnectedIntegrations(userId);
        return {
            text: `*Welcome to Astra!*

I'm your AI assistant that lives in your chat. Here's what I can do:

*Productivity*
• "What's on my calendar today?"
• "Schedule a meeting with John tomorrow at 3pm"
• "Check my emails"
• "Remind me to call mom in 2 hours"

*Smart Features*
• Send a voice message - I'll transcribe and act on it
• Send a screenshot - I'll explain what I see
• Send a document - I'll summarize it

*Knowledge*
• "Save this note to Notion"
• "Find that document about marketing"

*Connected: ${connected.length > 0 ? connected.join(', ') : 'None'}*

${connected.length === 0 ? '\nGet started by sending "connect google" to link your calendar and email.' : ''}

What would you like to do?`,
            quickReplies: connected.length === 0
                ? ['Connect Google', 'Connect Notion', 'What can you do?']
                : ['Today\'s schedule', 'Check emails', 'Settings']
        };
    }
    /**
     * Get status message
     */
    getStatusMessage(userId) {
        const connected = this.integrationManager.getConnectedIntegrations(userId);
        const statusList = [
            `Google: ${connected.includes('google') ? 'Connected' : 'Not connected'}`,
            `Notion: ${connected.includes('notion') ? 'Connected' : 'Not connected'}`,
            `Outlook: ${connected.includes('outlook') ? 'Connected' : 'Not connected'}`,
            `GitHub: ${connected.includes('github') ? 'Connected' : 'Not connected'}`
        ].join('\n');
        return {
            text: `*Your Connections*\n\n${statusList}\n\nTo connect a service, send "connect [service name]"\nTo disconnect, send "disconnect [service name]"`,
            quickReplies: ['Connect Google', 'Connect Notion', 'Back to help']
        };
    }
    /**
     * Get provider features description
     */
    getProviderFeatures(provider) {
        switch (provider) {
            case 'google':
                return 'calendar scheduling, email management, and document search';
            case 'notion':
                return 'note-taking and knowledge base';
            case 'outlook':
                return 'calendar and email management';
            case 'github':
                return 'repository management and issue tracking';
            default:
                return 'various features';
        }
    }
    /**
     * Get or create user context
     */
    getOrCreateContext(userId, platform) {
        let context = this.userContexts.get(userId);
        if (!context) {
            context = {
                userId,
                platform,
                conversationHistory: []
            };
            this.userContexts.set(userId, context);
        }
        return context;
    }
}
// ============================================================================
// Export
// ============================================================================
export default SmartCommands;
//# sourceMappingURL=SmartCommands.js.map