import { App } from '@slack/bolt';
import {} from '@slack/web-api';
import { AbstractBridge, } from './BaseBridge.js';
export class SlackBridge extends AbstractBridge {
    platform = 'slack';
    app = null;
    token;
    signingSecret;
    appToken;
    botUserId;
    teamId;
    teamName;
    constructor(config) {
        super(config.userId);
        this.token = config.credentials?.token || '';
        this.signingSecret = config.credentials?.signingSecret || '';
        this.appToken = config.credentials?.appToken || '';
    }
    async start() {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start app';
            this.setError(errorMessage);
            console.error('[SlackBridge] Failed to start:', errorMessage);
            throw error;
        }
    }
    async stop() {
        if (this.app) {
            await this.app.stop();
            this.app = null;
        }
        this.connected = false;
        console.log(`[SlackBridge] Stopped for user ${this.userId}`);
    }
    async sendMessage(to, content, options) {
        if (!this.app) {
            throw new Error('Slack app not initialized');
        }
        try {
            const messageOptions = {
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
            const response = await this.app.client.chat.postMessage(messageOptions);
            if (options?.attachments && response.ts) {
                for (const attachment of options.attachments) {
                    await this.uploadFile(to, attachment.path, attachment.caption, response.ts);
                }
            }
            this.updateActivity();
            console.log(`[SlackBridge] Sent message to ${to}`);
        }
        catch (error) {
            console.error('[SlackBridge] Failed to send message:', error);
            throw error;
        }
    }
    async sendRichMessage(to, blocks, text = '') {
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
        }
        catch (error) {
            console.error('[SlackBridge] Failed to send rich message:', error);
            throw error;
        }
    }
    async uploadFile(channel, filePath, title, threadTs) {
        if (!this.app)
            return;
        try {
            const uploadOptions = {
                channel_id: channel,
                file: filePath,
                title: title || 'Attachment',
            };
            if (threadTs) {
                uploadOptions.thread_ts = threadTs;
            }
            await this.app.client.files.uploadV2(uploadOptions);
        }
        catch (error) {
            console.error('[SlackBridge] Failed to upload file:', error);
        }
    }
    setupEventHandlers() {
        if (!this.app)
            return;
        this.app.message(async ({ message, say }) => {
            await this.handleMessage(message);
        });
        this.app.event('app_mention', async ({ event, say }) => {
            const mentionMessage = event;
            let content = mentionMessage.text || '';
            if (this.botUserId) {
                content = content.replace(new RegExp(`<@${this.botUserId}>`, 'g'), '').trim();
            }
            const bridgeMessage = {
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
            const actionEvent = action;
            const bridgeMessage = {
                sender: body.channel?.id || '',
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
    async handleMessage(message) {
        if (message.bot_id)
            return;
        if (message.user === this.botUserId)
            return;
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
        let attachmentType;
        if (hasAttachment && message.files?.[0]) {
            const mimetype = message.files[0].mimetype || '';
            if (mimetype.startsWith('image/'))
                attachmentType = 'image';
            else if (mimetype.startsWith('video/'))
                attachmentType = 'video';
            else if (mimetype.startsWith('audio/'))
                attachmentType = 'audio';
            else
                attachmentType = 'document';
        }
        const bridgeMessage = {
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
    getBotInfo() {
        return {
            userId: this.botUserId,
            teamId: this.teamId,
            teamName: this.teamName,
        };
    }
    async getChannels() {
        if (!this.app)
            return [];
        try {
            const result = await this.app.client.conversations.list({
                types: 'public_channel,private_channel',
            });
            return (result.channels || []).map((ch) => ({
                id: ch.id || '',
                name: ch.name || '',
                isMember: ch.is_member || false,
            }));
        }
        catch (error) {
            console.error('[SlackBridge] Failed to get channels:', error);
            return [];
        }
    }
}
export function createSlackBridgeFactory() {
    return async (config) => {
        const bridge = new SlackBridge(config);
        return bridge;
    };
}
//# sourceMappingURL=SlackBridge.js.map