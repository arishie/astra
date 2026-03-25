import { Telegraf, type Context } from 'telegraf';
import {
    AbstractBridge,
    type Platform,
    type BridgeMessage,
    type BridgeConfig,
    type SendMessageOptions,
} from './BaseBridge.js';

export class TelegramBridge extends AbstractBridge {
    readonly platform: Platform = 'telegram';

    private bot: Telegraf | null = null;
    private token: string;
    private botUsername?: string;

    constructor(config: BridgeConfig) {
        super(config.userId);
        this.token = config.credentials?.token || '';
    }

    async start(): Promise<void> {
        if (!this.token) {
            this.setError('No Telegram bot token provided');
            console.warn('[TelegramBridge] No token provided. Bridge disabled.');
            return;
        }

        try {
            this.bot = new Telegraf(this.token);

            this.bot.on('text', async (ctx) => {
                await this.handleTextMessage(ctx);
            });

            this.bot.on('photo', async (ctx) => {
                await this.handleMediaMessage(ctx, 'image');
            });

            this.bot.on('document', async (ctx) => {
                await this.handleMediaMessage(ctx, 'document');
            });

            this.bot.on('voice', async (ctx) => {
                await this.handleMediaMessage(ctx, 'audio');
            });

            this.bot.on('video', async (ctx) => {
                await this.handleMediaMessage(ctx, 'video');
            });

            const botInfo = await this.bot.telegram.getMe();
            this.botUsername = botInfo.username;

            await this.bot.launch();

            this.connected = true;
            this.clearError();
            this.updateActivity();

            console.log(`[TelegramBridge] Bot @${this.botUsername} launched for user ${this.userId}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start bot';
            this.setError(errorMessage);
            console.error('[TelegramBridge] Failed to start:', errorMessage);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (this.bot) {
            this.bot.stop('SIGTERM');
            this.bot = null;
        }

        this.connected = false;
        console.log(`[TelegramBridge] Stopped for user ${this.userId}`);
    }

    async sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void> {
        if (!this.bot) {
            throw new Error('Telegram bot not initialized');
        }

        const chatId = to;

        try {
            const sendOptions: any = {};

            if (options?.replyTo) {
                sendOptions.reply_to_message_id = parseInt(options.replyTo, 10);
            }

            if (options?.buttons && options.buttons.length > 0) {
                sendOptions.reply_markup = {
                    inline_keyboard: options.buttons.map((btn) => [
                        { text: btn.text, callback_data: btn.id },
                    ]),
                };
            }

            await this.bot.telegram.sendMessage(chatId, content, sendOptions);

            if (options?.attachments) {
                for (const attachment of options.attachments) {
                    await this.sendAttachment(chatId, attachment);
                }
            }

            this.updateActivity();
            console.log(`[TelegramBridge] Sent message to ${to}`);
        } catch (error) {
            console.error('[TelegramBridge] Failed to send message:', error);
            throw error;
        }
    }

    private async sendAttachment(
        chatId: string,
        attachment: { type: string; path: string; caption?: string }
    ): Promise<void> {
        if (!this.bot) return;

        const source = { source: attachment.path };
        const options = attachment.caption ? { caption: attachment.caption } : {};

        switch (attachment.type) {
            case 'image':
                await this.bot.telegram.sendPhoto(chatId, source, options);
                break;
            case 'video':
                await this.bot.telegram.sendVideo(chatId, source, options);
                break;
            case 'audio':
                await this.bot.telegram.sendAudio(chatId, source, options);
                break;
            case 'document':
                await this.bot.telegram.sendDocument(chatId, source, options);
                break;
        }
    }

    private async handleTextMessage(ctx: Context): Promise<void> {
        if (!ctx.message || !('text' in ctx.message)) return;

        const message = ctx.message;
        const sender = String(message.chat.id);
        const senderName =
            message.from?.first_name +
            (message.from?.last_name ? ` ${message.from.last_name}` : '');

        const bridgeMessage: BridgeMessage = {
            sender,
            senderName,
            content: message.text,
            platform: 'telegram',
            userId: this.userId,
            timestamp: new Date(message.date * 1000),
            replyTo: message.reply_to_message?.message_id?.toString(),
            metadata: {
                messageId: message.message_id.toString(),
                chatType: message.chat.type,
                username: message.from?.username,
            },
        };

        if (this.messageHandler) {
            await this.messageHandler(bridgeMessage);
        }

        this.updateActivity();
    }

    private async handleMediaMessage(
        ctx: Context,
        type: 'image' | 'video' | 'audio' | 'document'
    ): Promise<void> {
        if (!ctx.message) return;

        const message = ctx.message as any;
        const sender = String(message.chat.id);
        const senderName =
            message.from?.first_name +
            (message.from?.last_name ? ` ${message.from.last_name}` : '');

        let content = `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;
        if (message.caption) {
            content += `: ${message.caption}`;
        }

        const bridgeMessage: BridgeMessage = {
            sender,
            senderName,
            content,
            platform: 'telegram',
            userId: this.userId,
            hasAttachment: true,
            attachmentType: type,
            timestamp: new Date(message.date * 1000),
            metadata: {
                messageId: message.message_id.toString(),
                chatType: message.chat.type,
            },
        };

        if (this.messageHandler) {
            await this.messageHandler(bridgeMessage);
        }

        this.updateActivity();
    }

    getBotUsername(): string | undefined {
        return this.botUsername;
    }
}

export function createTelegramBridgeFactory() {
    return async (config: BridgeConfig): Promise<TelegramBridge> => {
        const bridge = new TelegramBridge(config);
        return bridge;
    };
}
