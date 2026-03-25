import { DiscordBridge } from '../bridge/DiscordBridge.js';
import { LanceManager } from '../memory/LanceManager.js';
export declare class MidjourneyWorker {
    private discord;
    private memory;
    private galleryDir;
    private mjBotId;
    constructor(discord: DiscordBridge, memory: LanceManager);
    generate(prompt: string, channelId: string): Promise<string>;
    /**
     * Called by Orchestrator when a message from MJ Bot is detected.
     */
    handleMjResponse(content: string, attachments: any[], channelId: string): Promise<void>;
    private downloadFile;
}
//# sourceMappingURL=MidjourneyWorker.d.ts.map