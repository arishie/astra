import { AbstractBridge, type Platform, type BridgeConfig, type SendMessageOptions } from './BaseBridge.js';
export declare class SlackBridge extends AbstractBridge {
    readonly platform: Platform;
    private app;
    private token;
    private signingSecret;
    private appToken;
    private botUserId?;
    private teamId?;
    private teamName?;
    constructor(config: BridgeConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void>;
    sendRichMessage(to: string, blocks: Array<{
        type: string;
        text?: {
            type: string;
            text: string;
        };
        elements?: any[];
        accessory?: any;
    }>, text?: string): Promise<void>;
    private uploadFile;
    private setupEventHandlers;
    private handleMessage;
    getBotInfo(): {
        userId?: string;
        teamId?: string;
        teamName?: string;
    };
    getChannels(): Promise<Array<{
        id: string;
        name: string;
        isMember: boolean;
    }>>;
}
export declare function createSlackBridgeFactory(): (config: BridgeConfig) => Promise<SlackBridge>;
//# sourceMappingURL=SlackBridge.d.ts.map