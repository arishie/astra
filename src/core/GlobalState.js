import { EventEmitter } from 'events';
export var SystemStatus;
(function (SystemStatus) {
    SystemStatus["HEALTHY"] = "healthy";
    SystemStatus["WARNING"] = "warning";
    SystemStatus["CRITICAL"] = "critical";
})(SystemStatus || (SystemStatus = {}));
export class GlobalState extends EventEmitter {
    static instance;
    status = SystemStatus.HEALTHY;
    activeAlerts = [];
    lastSecurityEvent = null;
    constructor() {
        super();
    }
    static getInstance() {
        if (!GlobalState.instance) {
            GlobalState.instance = new GlobalState();
        }
        return GlobalState.instance;
    }
    setStatus(status) {
        if (this.status !== status) {
            this.status = status;
            this.emit('statusChanged', status);
        }
    }
    reportSecurityEvent(type, details) {
        this.lastSecurityEvent = { type, details, timestamp: new Date() };
        this.activeAlerts.push(`[SECURITY] ${type}: ${details}`);
        this.emit('securityEvent', this.lastSecurityEvent);
    }
    clearAlerts() {
        this.activeAlerts = [];
        this.setStatus(SystemStatus.HEALTHY);
    }
}
//# sourceMappingURL=GlobalState.js.map