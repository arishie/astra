import { WhatsAppBridge } from '../bridge/WhatsAppBridge.js';
export declare class Sentinel {
    private globalState;
    private bridge;
    private checkInterval;
    private adminJid;
    constructor(bridge: WhatsAppBridge);
    setAdmin(jid: string): void;
    start(): void;
    stop(): void;
    private checkHealth;
    private handleSecurityEvent;
}
//# sourceMappingURL=Sentinel.d.ts.map