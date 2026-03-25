export declare class Heartbeat {
    private intervalId;
    private checkIntervalMs;
    private notificationCallback;
    constructor(notificationCallback?: (message: string) => Promise<void>);
    setNotificationCallback(cb: (message: string) => Promise<void>): void;
    start(): void;
    stop(): void;
    private pulse;
    private checkCalendar;
    private sendWhatsAppNotification;
}
//# sourceMappingURL=Heartbeat.d.ts.map