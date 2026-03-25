export type Platform = 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'signal' | 'teams' | 'matrix' | 'sms' | 'email';

export interface BridgeMessage {
    sender: string;
    senderName?: string;
    content: string;
    platform: Platform;
    userId?: string;
    hasAttachment?: boolean;
    attachmentPath?: string;
    attachmentType?: 'image' | 'video' | 'audio' | 'document';
    replyTo?: string;
    timestamp?: Date;
    metadata?: Record<string, any>;
}

export type MessageHandler = (message: BridgeMessage) => Promise<void>;

export interface BridgeConfig {
    userId: string;
    platform: Platform;
    credentials: Record<string, any>;
    mode?: string;
    options?: Record<string, any>;
}

export interface BridgeStatus {
    connected: boolean;
    platform: Platform;
    userId: string;
    mode?: string;
    lastActivity?: Date;
    error?: string;
    qrCode?: string;
}

export interface BaseBridge {
    readonly platform: Platform;
    readonly userId: string;

    start(): Promise<void>;
    stop(): Promise<void>;
    sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void>;
    setMessageHandler(handler: MessageHandler): void;
    getStatus(): BridgeStatus;
    isConnected(): boolean;
}

export interface SendMessageOptions {
    replyTo?: string;
    attachments?: Array<{
        type: 'image' | 'video' | 'audio' | 'document';
        path: string;
        caption?: string;
    }>;
    buttons?: Array<{
        id: string;
        text: string;
    }>;
}

export abstract class AbstractBridge implements BaseBridge {
    abstract readonly platform: Platform;
    readonly userId: string;

    protected messageHandler: MessageHandler | null = null;
    protected connected: boolean = false;
    protected lastActivity?: Date;
    protected errorMessage?: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
    abstract sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void>;

    setMessageHandler(handler: MessageHandler): void {
        this.messageHandler = handler;
    }

    getStatus(): BridgeStatus {
        return {
            connected: this.connected,
            platform: this.platform,
            userId: this.userId,
            lastActivity: this.lastActivity,
            error: this.errorMessage,
        };
    }

    isConnected(): boolean {
        return this.connected;
    }

    protected updateActivity(): void {
        this.lastActivity = new Date();
    }

    protected setError(error: string): void {
        this.errorMessage = error;
        this.connected = false;
    }

    protected clearError(): void {
        this.errorMessage = undefined;
    }
}
