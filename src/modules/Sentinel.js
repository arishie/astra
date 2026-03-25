import si from 'systeminformation';
import { GlobalState, SystemStatus } from '../core/GlobalState.js';
import { WhatsAppBridge } from '../bridge/WhatsAppBridge.js';
export class Sentinel {
    globalState;
    bridge;
    checkInterval = null;
    adminJid = null;
    constructor(bridge) {
        this.globalState = GlobalState.getInstance();
        this.bridge = bridge;
    }
    setAdmin(jid) {
        this.adminJid = jid;
    }
    start() {
        console.log("[Sentinel] Monitoring system health and security...");
        // 1. Health Monitoring Loop
        this.checkInterval = setInterval(async () => {
            await this.checkHealth();
        }, 60000); // Check every minute
        // 2. Listen for Global Events
        this.globalState.on('securityEvent', async (event) => {
            await this.handleSecurityEvent(event);
        });
    }
    stop() {
        if (this.checkInterval)
            clearInterval(this.checkInterval);
    }
    async checkHealth() {
        try {
            const cpu = await si.currentLoad();
            const mem = await si.mem();
            const disk = await si.fsSize();
            let status = SystemStatus.HEALTHY;
            const alerts = [];
            if (cpu.currentLoad > 90) {
                status = SystemStatus.CRITICAL;
                alerts.push(`🔥 High CPU Load: ${cpu.currentLoad.toFixed(1)}%`);
            }
            else if (cpu.currentLoad > 75) {
                status = SystemStatus.WARNING;
                alerts.push(`⚠️ High CPU Load: ${cpu.currentLoad.toFixed(1)}%`);
            }
            const usedMemPercent = (mem.active / mem.total) * 100;
            if (usedMemPercent > 90) {
                status = SystemStatus.CRITICAL;
                alerts.push(`🔥 Low Memory: ${usedMemPercent.toFixed(1)}% used`);
            }
            if (alerts.length > 0) {
                this.globalState.setStatus(status);
                if (this.adminJid) {
                    await this.bridge.sendMessage(this.adminJid, `[Sentinel] System Alert:\n${alerts.join('\n')}`);
                }
            }
        }
        catch (e) {
            console.error("[Sentinel] Health check failed:", e);
        }
    }
    async handleSecurityEvent(event) {
        console.warn(`[Sentinel] 🚨 SECURITY EVENT: ${event.type}`);
        if (this.adminJid) {
            await this.bridge.sendMessage(this.adminJid, `🚨 **SECURITY ALERT** 🚨\nType: ${event.type}\nDetails: ${event.details}`);
        }
        // In a full implementation, Sentinel could lock down the Gateway here.
    }
}
//# sourceMappingURL=Sentinel.js.map