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
import fs from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Voice Processor
// ============================================================================

export class VoiceProcessor extends EventEmitter {
    private tempDir: string;
    private openaiApiKey?: string;
    private googleApiKey?: string;

    constructor(options: {
        tempDir?: string;
        openaiApiKey?: string;
        googleApiKey?: string;
    } = {}) {
        super();
        this.tempDir = options.tempDir || '/tmp/astra_voice';
        this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
        this.googleApiKey = options.googleApiKey || process.env.GOOGLE_AI_API_KEY;

        this.ensureTempDir();
    }

    private ensureTempDir(): void {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Process a voice message end-to-end
     */
    public async processVoiceMessage(voice: VoiceMessage): Promise<ActionResult> {
        try {
            // Step 1: Transcribe
            console.log(`[VoiceProcessor] Transcribing voice message ${voice.id}...`);
            const transcription = await this.transcribe(voice.audioPath);

            this.emit('transcribed', { voice, transcription });
            console.log(`[VoiceProcessor] Transcription: "${transcription.text}"`);

            // Step 2: Understand intent
            const intent = await this.parseIntent(transcription.text);
            this.emit('intentParsed', { voice, intent });
            console.log(`[VoiceProcessor] Intent: ${intent.type} (${intent.confidence})`);

            // Step 3: Execute action
            const result = await this.executeAction(voice.userId, intent);
            this.emit('actionExecuted', { voice, intent, result });

            return result;
        } catch (error) {
            console.error('[VoiceProcessor] Error:', error);
            return {
                success: false,
                message: `Sorry, I couldn't process that voice message. ${error instanceof Error ? error.message : ''}`
            };
        }
    }

    /**
     * Transcribe audio using Whisper API
     */
    public async transcribe(audioPath: string): Promise<TranscriptionResult> {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured for voice transcription');
        }

        // Read audio file
        const audioBuffer = fs.readFileSync(audioPath);

        // Call OpenAI Whisper API
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer]), 'audio.ogg');
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Transcription failed: ${response.statusText}`);
        }

        const data = await response.json() as any;

        return {
            text: data.text,
            confidence: 0.95, // Whisper doesn't return confidence
            language: data.language || 'en',
            duration: data.duration || 0
        };
    }

    /**
     * Parse user intent from transcribed text
     */
    public async parseIntent(text: string): Promise<ActionIntent> {
        const lowerText = text.toLowerCase();

        // Calendar patterns
        const calendarPatterns = [
            /schedule|meeting|appointment|calendar|event|book|set up/i,
            /tomorrow|today|next week|on \w+day|at \d+/i
        ];

        // Email patterns
        const emailPatterns = [
            /send (?:an? )?email|email (?:to|about)|write (?:to|an email)/i,
            /message (?:to )?(\w+)/i
        ];

        // Reminder patterns
        const reminderPatterns = [
            /remind me|set (?:a )?reminder|don't forget|remember to/i
        ];

        // Note patterns
        const notePatterns = [
            /(?:take|make|create) (?:a )?note|note (?:that|to self)|jot down|write down/i
        ];

        // Search/Question patterns
        const questionPatterns = [
            /what(?:'s| is)|who(?:'s| is)|when(?:'s| is)|where(?:'s| is)|how/i,
            /find|search|look (?:up|for)|check/i
        ];

        // Task patterns
        const taskPatterns = [
            /add (?:a )?task|create (?:a )?todo|add to (?:my )?list/i
        ];

        let type: ActionIntent['type'] = 'unknown';
        let confidence = 0.5;

        if (calendarPatterns.some(p => p.test(lowerText))) {
            type = 'calendar';
            confidence = 0.85;
        } else if (emailPatterns.some(p => p.test(lowerText))) {
            type = 'email';
            confidence = 0.85;
        } else if (reminderPatterns.some(p => p.test(lowerText))) {
            type = 'reminder';
            confidence = 0.9;
        } else if (notePatterns.some(p => p.test(lowerText))) {
            type = 'note';
            confidence = 0.85;
        } else if (questionPatterns.some(p => p.test(lowerText))) {
            type = 'question';
            confidence = 0.8;
        } else if (taskPatterns.some(p => p.test(lowerText))) {
            type = 'task';
            confidence = 0.85;
        }

        // Extract entities
        const entities = this.extractEntities(text);

        return {
            type,
            confidence,
            entities,
            rawText: text
        };
    }

    /**
     * Extract named entities from text
     */
    private extractEntities(text: string): ActionIntent['entities'] {
        const entities: ActionIntent['entities'] = {};

        // Extract people names (simple heuristic)
        const peopleMatch = text.match(/(?:with|to|from|and|,)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g);
        if (peopleMatch) {
            entities.people = peopleMatch.map(m => m.replace(/^(?:with|to|from|and|,)\s+/i, ''));
        }

        // Extract datetime
        const datePatterns = [
            { pattern: /tomorrow/i, offset: 1 },
            { pattern: /today/i, offset: 0 },
            { pattern: /next week/i, offset: 7 },
            { pattern: /in (\d+) hours?/i, type: 'hours' },
            { pattern: /in (\d+) minutes?/i, type: 'minutes' },
            { pattern: /at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i, type: 'time' }
        ];

        for (const { pattern, offset, type } of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                const date = new Date();
                if (typeof offset === 'number') {
                    date.setDate(date.getDate() + offset);
                } else if (type === 'hours') {
                    date.setHours(date.getHours() + parseInt(match[1]));
                } else if (type === 'minutes') {
                    date.setMinutes(date.getMinutes() + parseInt(match[1]));
                } else if (type === 'time') {
                    let hours = parseInt(match[1]);
                    const minutes = match[2] ? parseInt(match[2]) : 0;
                    const ampm = match[3]?.toLowerCase();
                    if (ampm === 'pm' && hours < 12) hours += 12;
                    if (ampm === 'am' && hours === 12) hours = 0;
                    date.setHours(hours, minutes, 0, 0);
                }
                entities.datetime = date;
                break;
            }
        }

        // Extract duration
        const durationMatch = text.match(/for (\d+)\s*(hour|minute|min|hr)s?/i);
        if (durationMatch) {
            let minutes = parseInt(durationMatch[1]);
            if (/hour|hr/i.test(durationMatch[2])) {
                minutes *= 60;
            }
            entities.duration = minutes;
        }

        // Extract subject (for emails/meetings)
        const aboutMatch = text.match(/(?:about|regarding|re:?)\s+(.+?)(?:\.|$)/i);
        if (aboutMatch) {
            entities.subject = aboutMatch[1].trim();
        }

        return entities;
    }

    /**
     * Execute the parsed action
     */
    public async executeAction(userId: string, intent: ActionIntent): Promise<ActionResult> {
        switch (intent.type) {
            case 'calendar':
                return this.handleCalendarAction(userId, intent);
            case 'email':
                return this.handleEmailAction(userId, intent);
            case 'reminder':
                return this.handleReminderAction(userId, intent);
            case 'note':
                return this.handleNoteAction(userId, intent);
            case 'question':
                return this.handleQuestion(userId, intent);
            case 'task':
                return this.handleTaskAction(userId, intent);
            default:
                return {
                    success: true,
                    message: `I heard: "${intent.rawText}"\n\nI'm not sure what action to take. Could you be more specific?`,
                    followUp: 'Try saying "schedule a meeting", "send an email", or "remind me to..."'
                };
        }
    }

    private async handleCalendarAction(userId: string, intent: ActionIntent): Promise<ActionResult> {
        const { entities, rawText } = intent;

        if (rawText.match(/what(?:'s| is).*(?:calendar|schedule|today|tomorrow)/i)) {
            // Query calendar
            return {
                success: true,
                message: `Let me check your calendar...`,
                data: { action: 'query_calendar', date: entities.datetime || new Date() }
            };
        }

        // Create event
        const title = entities.subject || 'Meeting';
        const time = entities.datetime || new Date();
        const attendees = entities.people || [];

        return {
            success: true,
            message: `I'll schedule "${title}" for ${time.toLocaleString()}${attendees.length > 0 ? ` with ${attendees.join(', ')}` : ''}.\n\nShould I confirm this?`,
            data: {
                action: 'create_event',
                title,
                start: time,
                attendees
            },
            followUp: 'Reply "yes" to confirm or tell me what to change.'
        };
    }

    private async handleEmailAction(userId: string, intent: ActionIntent): Promise<ActionResult> {
        const { entities, rawText } = intent;

        const recipient = entities.people?.[0] || 'recipient';
        const subject = entities.subject || 'No subject';

        return {
            success: true,
            message: `I'll draft an email to ${recipient} about "${subject}".\n\nWhat would you like to say?`,
            data: {
                action: 'draft_email',
                to: recipient,
                subject
            },
            followUp: 'Send another voice message with the email content.'
        };
    }

    private async handleReminderAction(userId: string, intent: ActionIntent): Promise<ActionResult> {
        const { entities, rawText } = intent;

        const time = entities.datetime || new Date(Date.now() + 60 * 60 * 1000); // Default: 1 hour
        const reminderText = rawText.replace(/remind me (?:to )?|set (?:a )?reminder (?:to )?/i, '').trim();

        return {
            success: true,
            message: `Reminder set for ${time.toLocaleString()}:\n"${reminderText}"`,
            data: {
                action: 'set_reminder',
                time,
                text: reminderText
            }
        };
    }

    private async handleNoteAction(userId: string, intent: ActionIntent): Promise<ActionResult> {
        const { rawText } = intent;
        const noteText = rawText.replace(/(?:take|make|create) (?:a )?note:?|note (?:that|to self):?/i, '').trim();

        return {
            success: true,
            message: `Note saved:\n"${noteText}"`,
            data: {
                action: 'save_note',
                text: noteText
            }
        };
    }

    private async handleQuestion(userId: string, intent: ActionIntent): Promise<ActionResult> {
        return {
            success: true,
            message: `Let me find that for you...`,
            data: {
                action: 'search',
                query: intent.rawText
            }
        };
    }

    private async handleTaskAction(userId: string, intent: ActionIntent): Promise<ActionResult> {
        const { entities, rawText } = intent;
        const taskText = rawText.replace(/add (?:a )?task:?|create (?:a )?todo:?|add to (?:my )?list:?/i, '').trim();

        return {
            success: true,
            message: `Task added:\n"${taskText}"`,
            data: {
                action: 'add_task',
                text: taskText,
                dueDate: entities.datetime
            }
        };
    }

    /**
     * Cleanup temp files
     */
    public async cleanup(audioPath: string): Promise<void> {
        try {
            if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
            }
        } catch (error) {
            console.warn('[VoiceProcessor] Failed to cleanup:', error);
        }
    }
}

// ============================================================================
// Export
// ============================================================================

export default VoiceProcessor;
