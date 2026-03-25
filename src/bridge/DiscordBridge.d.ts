import { AbstractBridge, type Platform, type BridgeConfig, type SendMessageOptions } from './BaseBridge.js';
export declare class DiscordBridge extends AbstractBridge {
    readonly platform: Platform;
    private client;
    private token;
    private botUsername?;
    private botId?;
    constructor(config: BridgeConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void>;
    sendEmbed(to: string, embed: {
        title?: string;
        description?: string;
        color?: number;
        fields?: Array<{
            name: string;
            value: string;
            inline?: boolean;
        }>;
        footer?: string;
        thumbnail?: string;
        image?: string;
    }): Promise<void>;
    private setupEventHandlers;
    private handleMessage;
    private getAttachmentType;
    private isTextChannel;
    getBotInfo(): {
        username?: string;
        id?: string;
    };
    getGuilds(): Array<{
        id: string;
        name: string;
        memberCount: number;
    }>;
}
export declare function createDiscordBridgeFactory(): (config: BridgeConfig) => Promise<DiscordBridge>;
//# sourceMappingURL=DiscordBridge.d.ts.map