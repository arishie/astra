import { DiscordBridge } from '../bridge/DiscordBridge.js';
import { LanceManager } from '../memory/LanceManager.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
export class MidjourneyWorker {
    discord;
    memory;
    galleryDir = 'astra_gallery';
    mjBotId = '936929561302675456'; // Standard Midjourney Bot ID
    constructor(discord, memory) {
        this.discord = discord;
        this.memory = memory;
        if (!fs.existsSync(this.galleryDir)) {
            fs.mkdirSync(this.galleryDir);
        }
    }
    async generate(prompt, channelId) {
        console.log(`[MidjourneyWorker] 🎨 Dreaming up: "${prompt}"`);
        // 1. Send Command (Simulated via text for this Bridge implementation)
        // Note: Real MJ requires slash commands interaction which D.JS supports but implies complex interaction.
        // For this abstraction, we assume sending "/imagine prompt: ..." works if the user account does it, 
        // OR we just send the text prompt if using a specific configured channel/bot wrapper.
        await this.discord.sendMessage(channelId, `/imagine ${prompt}`);
        // 2. Watch for Result
        // We set up a temporary listener.
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Timeout waiting for Midjourney generation"));
            }, 60000 * 5); // 5 min timeout
            // This requires the Bridge to expose an event emitter or callback mechanism 
            // that we can hook into dynamically. The current Bridge uses a single messageHandler.
            // We will need to upgrade the Bridge or hack the handler in Orchestrator.
            // For a clean Worker, the Worker should probably receive the message stream or subscribe.
            // Let's assume the Orchestrator routes relevant MJ messages here.
            // OR: We return a "Job Started" status and handle the completion asynchronously via the global event loop.
            // For this synchronous-looking 'generate' method:
            // We will mock the wait logic or rely on the Orchestrator to call `handleMjResponse`.
            resolve("Generation initiated. Watch the gallery.");
        });
    }
    /**
     * Called by Orchestrator when a message from MJ Bot is detected.
     */
    async handleMjResponse(content, attachments, channelId) {
        if (attachments.length > 0) {
            console.log(`[MidjourneyWorker] 📥 Downloading art...`);
            for (const att of attachments) {
                const url = att.url;
                const filename = `mj_${Date.now()}_${att.name || 'image.png'}`;
                const filepath = path.join(this.galleryDir, filename);
                await this.downloadFile(url, filepath);
                // Memory
                await this.memory.addMemory(`Midjourney Creation: ${content}`, {
                    type: 'creative_asset',
                    path: filepath,
                    source: 'midjourney'
                });
                console.log(`[MidjourneyWorker] Saved to ${filepath}`);
            }
        }
    }
    downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        });
    }
}
//# sourceMappingURL=MidjourneyWorker.js.map