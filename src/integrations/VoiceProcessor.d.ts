/**
 * VoiceProcessor - Transform voice messages into actions
 *
 * The MAGIC feature: Send a voice note on WhatsApp/Telegram,
 * Astra transcribes it and executes the action automatically.
 *
 * Examples:
 * - "Schedule a meeting with John tomorrow at 3pm" → Creates calendar event
 * - "Remind me to call mom in 2 hours" → Sets reminder
 * - "Send email to boss saying I'll be late" → Drafts and sends email
 * - "What's on my calendar today?" → Reads out schedule
 */
import { EventEmitter } from 'events';
export interface VoiceMessage {
    id: string;
    userId: string;
    platform: 'whatsapp' | 'telegram' | 'discord';
    audioPath: string;
    duration: number;
    mimeType: string;
    timestamp: Date;
}
export interface TranscriptionResult {
    text: string;
    confidence: number;
    language: string;
    duration: number;
}
export interface ActionIntent {
    type: 'calendar' | 'email' | 'reminder' | 'note' | 'search' | 'question' | 'task' | 'unknown';
    confidence: number;
    entities: {
        people?: string[];
        datetime?: Date;
        duration?: number;
        location?: string;
        subject?: string;
        body?: string;
        query?: string;
    };
    rawText: string;
}
export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
    followUp?: string;
}
export declare class VoiceProcessor extends EventEmitter {
    private tempDir;
    private openaiApiKey?;
    private googleApiKey?;
    constructor(options?: {
        tempDir?: string;
        openaiApiKey?: string;
        googleApiKey?: string;
    });
    private ensureTempDir;
    /**
     * Process a voice message end-to-end
     */
    processVoiceMessage(voice: VoiceMessage): Promise<ActionResult>;
    /**
     * Transcribe audio using Whisper API
     */
    transcribe(audioPath: string): Promise<TranscriptionResult>;
    /**
     * Parse user intent from transcribed text
     */
    parseIntent(text: string): Promise<ActionIntent>;
    /**
     * Extract named entities from text
     */
    private extractEntities;
    /**
     * Execute the parsed action
     */
    executeAction(userId: string, intent: ActionIntent): Promise<ActionResult>;
    private handleCalendarAction;
    private handleEmailAction;
    private handleReminderAction;
    private handleNoteAction;
    private handleQuestion;
    private handleTaskAction;
    /**
     * Cleanup temp files
     */
    cleanup(audioPath: string): Promise<void>;
}
export default VoiceProcessor;
//# sourceMappingURL=VoiceProcessor.d.ts.map