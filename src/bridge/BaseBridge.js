export class AbstractBridge {
    userId;
    messageHandler = null;
    connected = false;
    lastActivity;
    errorMessage;
    constructor(userId) {
        this.userId = userId;
    }
    setMessageHandler(handler) {
        this.messageHandler = handler;
    }
    getStatus() {
        return {
            connected: this.connected,
            platform: this.platform,
            userId: this.userId,
            lastActivity: this.lastActivity,
            error: this.errorMessage,
        };
    }
    isConnected() {
        return this.connected;
    }
    updateActivity() {
        this.lastActivity = new Date();
    }
    setError(error) {
        this.errorMessage = error;
        this.connected = false;
    }
    clearError() {
        this.errorMessage = undefined;
    }
}
//# sourceMappingURL=BaseBridge.js.map