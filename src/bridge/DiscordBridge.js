import { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, } from 'discord.js';
import { AbstractBridge, } from './BaseBridge.js';
export class DiscordBridge extends AbstractBridge {
    platform = 'discord';
    client;
    token;
    botUsername;
    botId;
    constructor(config) {
        super(config.userId);
        this.token = config.credentials?.token || '';
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
            ],
            partials: [Partials.Channel, Partials.Message],
        });
    }
    async start() {
        if (!this.token) {
            this.setError('No Discord bot token provided');
            console.warn('[DiscordBridge] No token provided. Bridge disabled.');
            return;
        }
        try {
            this.setupEventHandlers();
            await this.client.login(this.token);
            await new Promise((resolve) => {
                this.client.once('ready', () => {
                    this.botUsername = this.client.user?.tag;
                    this.botId = this.client.user?.id;
                    this.connected = true;
                    this.clearError();
                    this.updateActivity();
                    console.log(`[DiscordBridge] Logged in as ${this.botUsername} for user ${this.userId}`);
                    resolve();
                });
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start bot';
            this.setError(errorMessage);
            console.error('[DiscordBridge] Failed to start:', errorMessage);
            throw error;
        }
    }
    async stop() {
        await this.client.destroy();
        this.connected = false;
        console.log(`[DiscordBridge] Stopped for user ${this.userId}`);
    }
    async sendMessage(to, content, options) {
        try {
            const channel = await this.client.channels.fetch(to);
            if (!channel || !this.isTextChannel(channel)) {
                throw new Error('Invalid channel or not a text channel');
            }
            const messageOptions = { content };
            if (options?.replyTo) {
                messageOptions.reply = { messageReference: options.replyTo };
            }
            if (options?.buttons && options.buttons.length > 0) {
                const row = new ActionRowBuilder().addComponents(options.buttons.map((btn) => new ButtonBuilder()
                    .setCustomId(btn.id)
                    .setLabel(btn.text)
                    .setStyle(ButtonStyle.Primary)));
                messageOptions.components = [row];
            }
            await channel.send(messageOptions);
            if (options?.attachments) {
                for (const attachment of options.attachments) {
                    await channel.send({
                        files: [{ attachment: attachment.path }],
                        content: attachment.caption,
                    });
                }
            }
            this.updateActivity();
            console.log(`[DiscordBridge] Sent message to channel ${to}`);
        }
        catch (error) {
            console.error('[DiscordBridge] Failed to send message:', error);
            throw error;
        }
    }
    async sendEmbed(to, embed) {
        try {
            const channel = await this.client.channels.fetch(to);
            if (!channel || !this.isTextChannel(channel)) {
                throw new Error('Invalid channel');
            }
            const discordEmbed = new EmbedBuilder();
            if (embed.title)
                discordEmbed.setTitle(embed.title);
            if (embed.description)
                discordEmbed.setDescription(embed.description);
            if (embed.color)
                discordEmbed.setColor(embed.color);
            if (embed.fields)
                discordEmbed.addFields(embed.fields);
            if (embed.footer)
                discordEmbed.setFooter({ text: embed.footer });
            if (embed.thumbnail)
                discordEmbed.setThumbnail(embed.thumbnail);
            if (embed.image)
                discordEmbed.setImage(embed.image);
            await channel.send({ embeds: [discordEmbed] });
            this.updateActivity();
        }
        catch (error) {
            console.error('[DiscordBridge] Failed to send embed:', error);
            throw error;
        }
    }
    setupEventHandlers() {
        this.client.on('messageCreate', async (message) => {
            await this.handleMessage(message);
        });
        this.client.on('error', (error) => {
            console.error('[DiscordBridge] Client error:', error);
            this.setError(error.message);
        });
        this.client.on('disconnect', () => {
            console.warn('[DiscordBridge] Disconnected');
            this.connected = false;
        });
        this.client.on('reconnecting', () => {
            console.log('[DiscordBridge] Reconnecting...');
        });
    }
    async handleMessage(message) {
        if (message.author.bot)
            return;
        if (message.author.id === this.botId)
            return;
        const isDM = !message.guild;
        const isMentioned = message.mentions.has(this.client.user);
        if (!isDM && !isMentioned) {
            return;
        }
        let content = message.content;
        if (isMentioned && this.client.user) {
            content = content.replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '').trim();
        }
        const bridgeMessage = {
            sender: message.channelId,
            senderName: message.author.username,
            content,
            platform: 'discord',
            userId: this.userId,
            hasAttachment: message.attachments.size > 0,
            attachmentType: this.getAttachmentType(message),
            timestamp: message.createdAt,
            replyTo: message.reference?.messageId,
            metadata: {
                messageId: message.id,
                authorId: message.author.id,
                guildId: message.guild?.id,
                guildName: message.guild?.name,
                channelName: isDM ? 'DM' : message.channel.name,
                isDM,
            },
        };
        if (this.messageHandler) {
            await this.messageHandler(bridgeMessage);
        }
        this.updateActivity();
    }
    getAttachmentType(message) {
        if (message.attachments.size === 0)
            return undefined;
        const attachment = message.attachments.first();
        const contentType = attachment.contentType || '';
        if (contentType.startsWith('image/'))
            return 'image';
        if (contentType.startsWith('video/'))
            return 'video';
        if (contentType.startsWith('audio/'))
            return 'audio';
        return 'document';
    }
    isTextChannel(channel) {
        return channel && typeof channel.send === 'function';
    }
    getBotInfo() {
        return {
            username: this.botUsername,
            id: this.botId,
        };
    }
    getGuilds() {
        return this.client.guilds.cache.map((guild) => ({
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
        }));
    }
}
export function createDiscordBridgeFactory() {
    return async (config) => {
        const bridge = new DiscordBridge(config);
        return bridge;
    };
}
//# sourceMappingURL=DiscordBridge.js.map