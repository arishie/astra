export interface AuditEvent {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
    success?: boolean;
}
export interface AuditLogEntry extends AuditEvent {
    id: string;
    createdAt: Date;
}
/**
 * Audit logging service for security compliance (SOC2, GDPR).
 * Logs all security-relevant events to the database.
 */
export declare class AuditService {
    private db;
    private enabled;
    constructor();
    /**
     * Log an audit event.
     */
    log(event: AuditEvent): Promise<void>;
    /**
     * Log authentication events.
     */
    logAuth(action: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'password_change', userId: string | undefined, ipAddress?: string, details?: Record<string, any>): Promise<void>;
    /**
     * Log API key events.
     */
    logApiKey(action: 'created' | 'deleted' | 'used' | 'validated', userId: string, keyId: string, provider?: string, details?: Record<string, any>): Promise<void>;
    /**
     * Log platform connection events.
     */
    logPlatform(action: 'connected' | 'disconnected' | 'message_sent' | 'message_received', userId: string, platform: string, details?: Record<string, any>): Promise<void>;
    /**
     * Log data access events.
     */
    logDataAccess(action: 'read' | 'write' | 'delete' | 'export', userId: string, resourceType: string, resourceId?: string, details?: Record<string, any>): Promise<void>;
    /**
     * Log administrative actions.
     */
    logAdmin(action: string, adminUserId: string, targetUserId?: string, details?: Record<string, any>): Promise<void>;
    /**
     * Log security events.
     */
    logSecurity(action: 'rate_limited' | 'blocked' | 'suspicious_activity' | 'elevation_requested' | 'elevation_approved', userId?: string, ipAddress?: string, details?: Record<string, any>): Promise<void>;
    /**
     * Query audit logs (admin only).
     */
    query(options: {
        userId?: string;
        action?: string;
        resourceType?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<AuditLogEntry[]>;
    /**
     * Get audit statistics.
     */
    getStats(days?: number): Promise<{
        totalEvents: number;
        byAction: Record<string, number>;
        byUser: Record<string, number>;
    }>;
    /**
     * Sanitize details object to remove sensitive data before logging.
     */
    private sanitizeDetails;
    /**
     * Get severity level for security events.
     */
    private getSeverity;
}
export declare function getAuditService(): AuditService;
//# sourceMappingURL=AuditService.d.ts.map