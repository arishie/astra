import { App } from '@slack/bolt';
import { type ChatPostMessageResponse } from '@slack/web-api';
import {
    AbstractBridge,
    type Platform,
    type BridgeMessage,
    type BridgeConfig,
    type SendMessageOptions,
} from './BaseBridge.js';

export class SlackBridge extends AbstractBridge {
    readonly platform: Platform = 'slack';

    private app: App | null = null;
    private token: string;
    private signingSecret: string;
    private appToken: string;
    private botUserId?: string;
    private teamId?: string;
    private teamName?: string;

    constructor(config: BridgeConfig) {
        super(config.userId);
        this.token = config.credentials?.token || '';
        this.signingSecret = config.credentials?.signingSecret || '';
        this.appToken = config.credentials?.appToken || '';
    }

    async start(): Promise<void> {
        if (!this.token || !this.signingSecret || !this.appToken) {
            this.setError('Missing Slack credentials (token, signingSecret, or appToken)');
            console.warn('[SlackBridge] Missing tokens. Bridge disabled.');
            return;
        }

        try {
            this.app = new App({
                token: this.token,
                signingSecret: this.signingSecret,
                socketMode: true,
                appToken: this.appToken,
            });

            this.setupEventHandlers();

            await this.app.start();

            const authResult = await this.app.client.auth.test();
            this.botUserId = authResult.user_id;
            this.teamId = authResult.team_id;
            this.teamName = authResult.team;

            this.connected = true;
            this.clearError();
            this.updateActivity();

            console.log(`[SlackBridge] Connected to ${this.teamName} for user ${this.userId}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start app';
            this.setError(errorMessage);
            console.error('[SlackBridge] Failed to start:', errorMessage);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (this.app) {
            await this.app.stop();
            this.app = null;
        }

        this.connected = false;
        console.log(`[SlackBridge] Stopped for user ${this.userId}`);
    }

    async sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void> {
        if (!this.app) {
            throw new Error('Slack app not initialized');
        }

        try {
            const messageOptions: any = {
                channel: to,
                text: content,
            };

            if (options?.replyTo) {
                messageOptions.thread_ts = options.replyTo;
            }

            if (options?.buttons && options.buttons.length > 0) {
                messageOptions.blocks = [
                    {
                        type: 'section',
                        text: { type: 'mrkdwn', text: content },
                    },
                    {
                        type: 'actions',
                        elements: options.buttons.map((btn) => ({
                            type: 'button',
                            text: { type: 'plain_text', text: btn.text },
                            action_id: btn.id,
                        })),
                    },
                ];
            }

            const response: ChatPostMessageResponse = await this.app.client.chat.postMessage(messageOptions);

            if (options?.attachments && response.ts) {
                for (const attachment of options.attachments) {
                    await this.uploadFile(to, attachment.path, attachment.caption, response.ts);
                }
            }

            this.updateActivity();
            console.log(`[SlackBridge] Sent message to ${to}`);
        } catch (error) {
            console.error('[SlackBridge] Failed to send message:', error);
            throw error;
        }
    }

    async sendRichMessage(
        to: string,
        blocks: Array<{
            type: string;
            text?: { type: string; text: string };
            elements?: any[];
            accessory?: any;
        }>,
        text: string = ''
    ): Promise<void> {
        if (!this.app) {
            throw new Error('Slack app not initialized');
        }

        try {
            await this.app.client.chat.postMessage({
                channel: to,
                text,
                blocks,
            });
            this.updateActivity();
        } catch (error) {
            console.error('[SlackBridge] Failed to send rich message:', error);
            throw error;
        }
    }

    private async uploadFile(
        channel: string,
        filePath: string,
        title?: string,
        threadTs?: string
    ): Promise<void> {
        if (!this.app) return;

        try {
            const uploadOptions: any = {
                channel_id: channel,
                file: filePath,
                title: title || 'Attachment',
            };
            if (threadTs) {
                uploadOptions.thread_ts = threadTs;
            }
            await this.app.client.files.uploadV2(uploadOptions);
        } catch (error) {
            console.error('[SlackBridge] Failed to upload file:', error);
        }
    }

    private setupEventHandlers(): void {
        if (!this.app) return;

        this.app.message(async ({ message, say }) => {
            await this.handleMessage(message as any);
        });

        this.app.event('app_mention', async ({ event, say }) => {
            const mentionMessage = event as any;

            let content = mentionMessage.text || '';
            if (this.botUserId) {
                content = content.replace(new RegExp(`<@${this.botUserId}>`, 'g'), '').trim();
            }

            const bridgeMessage: BridgeMessage = {
                sender: mentionMessage.channel,
                senderName: mentionMessage.user,
                content,
                platform: 'slack',
                userId: this.userId,
                timestamp: new Date(parseFloat(mentionMessage.ts) * 1000),
                replyTo: mentionMessage.thread_ts,
                metadata: {
                    messageId: mentionMessage.ts,
                    eventType: 'app_mention',
                    teamId: this.teamId,
                },
            };

            if (this.messageHandler) {
                await this.messageHandler(bridgeMessage);
            }

            this.updateActivity();
        });

        this.app.action(/.*/, async ({ action, ack, body }) => {
            await ack();

            const actionEvent = action as any;
            const bridgeMessage: BridgeMessage = {
                sender: (body as any).channel?.id || '',
                content: `[Button clicked: ${actionEvent.action_id}]`,
                platform: 'slack',
                userId: this.userId,
                timestamp: new Date(),
                metadata: {
                    eventType: 'button_click',
                    actionId: actionEvent.action_id,
                    value: actionEvent.value,
                },
            };

            if (this.messageHandler) {
                await this.messageHandler(bridgeMessage);
            }
        });
    }

    private async handleMessage(message: any): Promise<void> {
        if (message.bot_id) return;
        if (message.user === this.botUserId) return;

        const isDM = message.channel_type === 'im';
        const isMentioned = message.text?.includes(`<@${this.botUserId}>`);

        if (!isDM && !isMentioned) {
            return;
        }

        let content = message.text || '';
        if (isMentioned && this.botUserId) {
            content = content.replace(new RegExp(`<@${this.botUserId}>`, 'g'), '').trim();
        }

        const hasAttachment = (message.files?.length || 0) > 0;
        let attachmentType: 'image' | 'video' | 'audio' | 'document' | undefined;

        if (hasAttachment && message.files?.[0]) {
            const mimetype = message.files[0].mimetype || '';
            if (mimetype.startsWith('image/')) attachmentType = 'image';
            else if (mimetype.startsWith('video/')) attachmentType = 'video';
            else if (mimetype.startsWith('audio/')) attachmentType = 'audio';
            else attachmentType = 'document';
        }

        const bridgeMessage: BridgeMessage = {
            sender: message.channel,
            senderName: message.user,
            content,
            platform: 'slack',
            userId: this.userId,
            hasAttachment,
            attachmentType,
            timestamp: new Date(parseFloat(message.ts) * 1000),
            replyTo: message.thread_ts,
            metadata: {
                messageId: message.ts,
                channelType: message.channel_type,
                teamId: this.teamId,
                isDM,
            },
        };

        if (this.messageHandler) {
            await this.messageHandler(bridgeMessage);
        }

        this.updateActivity();
    }

    getBotInfo(): { userId?: string; teamId?: string; teamName?: string } {
        return {
            userId: this.botUserId,
            teamId: this.teamId,
            teamName: this.teamName,
        };
    }

    async getChannels(): Promise<Array<{ id: string; name: string; isMember: boolean }>> {
        if (!this.app) return [];

        try {
            const result = await this.app.client.conversations.list({
                types: 'public_channel,private_channel',
            });

            return (result.channels || []).map((ch) => ({
                id: ch.id || '',
                name: ch.name || '',
                isMember: ch.is_member || false,
            }));
        } catch (error) {
            console.error('[SlackBridge] Failed to get channels:', error);
            return [];
        }
    }
}

export function createSlackBridgeFactory() {
    return async (config: BridgeConfig): Promise<SlackBridge> => {
        const bridge = new SlackBridge(config);
        return bridge;
    };
}
