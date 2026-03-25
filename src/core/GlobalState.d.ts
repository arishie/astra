import { EventEmitter } from 'events';
export declare enum SystemStatus {
    HEALTHY = "healthy",
    WARNING = "warning",
    CRITICAL = "critical"
}
export declare class GlobalState extends EventEmitter {
    private static instance;
    status: SystemStatus;
    activeAlerts: string[];
    lastSecurityEvent: {
        type: string;
        details: string;
        timestamp: Date;
    } | null;
    private constructor();
    static getInstance(): GlobalState;
    setStatus(status: SystemStatus): void;
    reportSecurityEvent(type: string, details: string): void;
    clearAlerts(): void;
}
//# sourceMappingURL=GlobalState.d.ts.map