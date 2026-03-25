export declare class AstraOrchestrator {
    private gateway;
    private capabilities;
    private bridges;
    private heartbeat;
    private memory;
    private ingestion;
    private modelRouter;
    private toolSynthesizer;
    private visualAgent;
    private thinkingHive;
    private mjWorker;
    private sentinel;
    private webOperative;
    private shadowLab;
    private authenticatedUsers;
    private pendingVisualActions;
    private systemToken;
    constructor();
    /**
     * Initialize system token for internal operations.
     * Must be called after construction with proper environment configuration.
     */
    initializeSystemAuth(): Promise<boolean>;
    /**
     * Link a platform sender to an authenticated user.
     * This should be called after user authenticates via web/API and links their platform.
     */
    linkPlatformUser(platform: string, platformSenderId: string, userId: string): void;
    /**
     * Check if a platform sender is linked to an authenticated user.
     */
    getLinkedUserId(platform: string, platformSenderId: string): string | null;
    private getBridgeByPlatform;
    start(): Promise<void>;
    private handleIncomingMessage;
    private executeCommandRequest;
    private processQuery;
    private callEngine;
}
//# sourceMappingURL=AstraOrchestrator.d.ts.map