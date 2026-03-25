import { AbstractBridge, type Platform, type BridgeConfig, type SendMessageOptions } from './BaseBridge.js';
export declare class TelegramBridge extends AbstractBridge {
    readonly platform: Platform;
    private bot;
    private token;
    private botUsername?;
    constructor(config: BridgeConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void>;
    private sendAttachment;
    private handleTextMessage;
    private handleMediaMessage;
    getBotUsername(): string | undefined;
}
export declare function createTelegramBridgeFactory(): (config: BridgeConfig) => Promise<TelegramBridge>;
//# sourceMappingURL=TelegramBridge.d.ts.map