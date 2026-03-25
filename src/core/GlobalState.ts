import { EventEmitter } from 'events';

export enum SystemStatus {
    HEALTHY = 'healthy',
    WARNING = 'warning',
    CRITICAL = 'critical'
}

export class GlobalState extends EventEmitter {
    private static instance: GlobalState;
    public status: SystemStatus = SystemStatus.HEALTHY;
    public activeAlerts: string[] = [];
    public lastSecurityEvent: { type: string, details: string, timestamp: Date } | null = null;

    private constructor() {
        super();
    }

    public static getInstance(): GlobalState {
        if (!GlobalState.instance) {
            GlobalState.instance = new GlobalState();
        }
        return GlobalState.instance;
    }

    public setStatus(status: SystemStatus) {
        if (this.status !== status) {
            this.status = status;
            this.emit('statusChanged', status);
        }
    }

    public reportSecurityEvent(type: string, details: string) {
        this.lastSecurityEvent = { type, details, timestamp: new Date() };
        this.activeAlerts.push(`[SECURITY] ${type}: ${details}`);
        this.emit('securityEvent', this.lastSecurityEvent);
    }

    public clearAlerts() {
        this.activeAlerts = [];
        this.setStatus(SystemStatus.HEALTHY);
    }
}
