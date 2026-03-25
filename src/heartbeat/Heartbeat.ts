export class Heartbeat {
    private intervalId: NodeJS.Timeout | null = null;
    private checkIntervalMs: number = 60000; // Check every minute
    private notificationCallback: ((message: string) => Promise<void>) | null = null;

    constructor(notificationCallback?: (message: string) => Promise<void>) {
        if (notificationCallback) {
            this.notificationCallback = notificationCallback;
        }
    }

    public setNotificationCallback(cb: (message: string) => Promise<void>) {
        this.notificationCallback = cb;
    }

    public start() {
        if (this.intervalId) return;
        console.log("[Heartbeat] System starting...");
        this.intervalId = setInterval(() => this.pulse(), this.checkIntervalMs);
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("[Heartbeat] System stopped.");
        }
    }

    private async pulse() {
        const now = new Date();
        // console.log(`[Heartbeat] Pulse at ${now.toISOString()}`);
        
        // 1. Check Calendar
        const upcomingMeeting = await this.checkCalendar();
        
        if (upcomingMeeting) {
            console.log(`[Heartbeat] Upcoming meeting detected: ${upcomingMeeting.title}`);
            // 2. Proactive Messaging
            await this.sendWhatsAppNotification(
                `Hey! You have "${upcomingMeeting.title}" starting in 10 minutes. Do you need a briefing prepared?`
            );
        }
    }

    private async checkCalendar(): Promise<{ title: string, time: Date } | null> {
        // Mock Calendar Check
        // In reality, this would query a local .ics file or Google Calendar API
        const mockEvents = [
            { title: "Project Sync", time: new Date(Date.now() + 10 * 60000) } // 10 mins from now
        ];
        
        // Return first event randomly for demo
        const event = mockEvents[0];
        return (Math.random() > 0.8 && event) ? event : null; 
    }

    private async sendWhatsAppNotification(message: string): Promise<void> {
        if (this.notificationCallback) {
             console.log(`[Heartbeat] 📤 Sending Notification: "${message}"`);
             await this.notificationCallback(message);
        } else {
             console.log(`[Heartbeat] (No Bridge) 📤 Mock Notification: "${message}"`);
        }
    }
}
