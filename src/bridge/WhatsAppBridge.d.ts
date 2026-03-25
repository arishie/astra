import { AbstractBridge, type Platform, type BridgeStatus, type SendMessageOptions, type BridgeConfig } from './BaseBridge.js';
export declare enum WhatsAppMode {
    BAILEYS = "baileys",
    BUSINESS_API = "business"
}
export interface WhatsAppCredentials {
    mode: WhatsAppMode;
    businessToken?: string;
    phoneNumberId?: string;
    verifyToken?: string;
    baileysSession?: any;
}
interface BusinessAPIMessage {
    object: string;
    entry: Array<{
        id: string;
        changes: Array<{
            value: {
                messaging_product: string;
                metadata: {
                    display_phone_number: string;
                    phone_number_id: string;
                };
                contacts?: Array<{
                    profile: {
                        name: string;
                    };
                    wa_id: string;
                }>;
                messages?: Array<{
                    from: string;
                    id: string;
                    timestamp: string;
                    type: string;
                    text?: {
                        body: string;
                    };
                    image?: {
                        id: string;
                        caption?: string;
                    };
                    document?: {
                        id: string;
                        filename: string;
                    };
                }>;
            };
            field: string;
        }>;
    }>;
}
export declare class WhatsAppBridge extends AbstractBridge {
    readonly platform: Platform;
    private mode;
    private sock;
    private authDir;
    private qrCode?;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private businessToken?;
    private phoneNumberId?;
    private webhookVerifyToken?;
    constructor(config: BridgeConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void>;
    getStatus(): BridgeStatus;
    getQRCode(): string | undefined;
    handleWebhookVerification(mode: string, token: string, challenge: string): string | null;
    handleWebhookMessage(payload: BusinessAPIMessage): Promise<void>;
    private startBaileys;
    private handleConnectionUpdate;
    private handleBaileysMessages;
    private sendBaileysMessage;
    private startBusinessAPI;
    private testBusinessAPIConnection;
    private sendBusinessMessage;
    persistSession(): Promise<Record<string, any> | null>;
    restoreSession(sessionData: Record<string, any>): Promise<void>;
}
export declare function createWhatsAppBridgeFactory(): (config: BridgeConfig) => Promise<WhatsAppBridge>;
export {};
//# sourceMappingURL=WhatsAppBridge.d.ts.map