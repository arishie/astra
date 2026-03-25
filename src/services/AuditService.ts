import { Database } from '../database/Database.js';

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
export class AuditService {
    private db: Database;
    private enabled: boolean;

    constructor() {
        this.db = Database.getInstance();
        this.enabled = process.env.AUDIT_LOGGING !== 'false';
    }

    /**
     * Log an audit event.
     */
    async log(event: AuditEvent): Promise<void> {
        if (!this.enabled) return;

        try {
            await this.db.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    event.userId || null,
                    event.action,
                    event.resourceType || null,
                    event.resourceId || null,
                    event.ipAddress || null,
                    event.userAgent || null,
                    event.details ? JSON.stringify(this.sanitizeDetails(event.details)) : null,
                ]
            );
        } catch (error) {
            // Don't throw on audit failures - log and continue
            console.error('[AuditService] Failed to log event:', error);
        }
    }

    /**
     * Log authentication events.
     */
    async logAuth(
        action: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'password_change',
        userId: string | undefined,
        ipAddress?: string,
        details?: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId,
            action: `auth:${action}`,
            resourceType: 'session',
            ipAddress,
            details: {
                ...details,
                timestamp: new Date().toISOString(),
            },
        });
    }

    /**
     * Log API key events.
     */
    async logApiKey(
        action: 'created' | 'deleted' | 'used' | 'validated',
        userId: string,
        keyId: string,
        provider?: string,
        details?: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId,
            action: `api_key:${action}`,
            resourceType: 'api_key',
            resourceId: keyId,
            details: {
                provider,
                ...details,
            },
        });
    }

    /**
     * Log platform connection events.
     */
    async logPlatform(
        action: 'connected' | 'disconnected' | 'message_sent' | 'message_received',
        userId: string,
        platform: string,
        details?: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId,
            action: `platform:${action}`,
            resourceType: 'platform',
            resourceId: platform,
            details,
        });
    }

    /**
     * Log data access events.
     */
    async logDataAccess(
        action: 'read' | 'write' | 'delete' | 'export',
        userId: string,
        resourceType: string,
        resourceId?: string,
        details?: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId,
            action: `data:${action}`,
            resourceType,
            resourceId,
            details,
        });
    }

    /**
     * Log administrative actions.
     */
    async logAdmin(
        action: string,
        adminUserId: string,
        targetUserId?: string,
        details?: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId: adminUserId,
            action: `admin:${action}`,
            resourceType: 'user',
            resourceId: targetUserId,
            details: {
                ...details,
                isAdminAction: true,
            },
        });
    }

    /**
     * Log security events.
     */
    async logSecurity(
        action: 'rate_limited' | 'blocked' | 'suspicious_activity' | 'elevation_requested' | 'elevation_approved',
        userId?: string,
        ipAddress?: string,
        details?: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId,
            action: `security:${action}`,
            resourceType: 'security',
            ipAddress,
            details: {
                ...details,
                severity: this.getSeverity(action),
            },
        });
    }

    /**
     * Query audit logs (admin only).
     */
    async query(options: {
        userId?: string;
        action?: string;
        resourceType?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<AuditLogEntry[]> {
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (options.userId) {
            conditions.push(`user_id = $${paramIndex++}`);
            params.push(options.userId);
        }

        if (options.action) {
            conditions.push(`action LIKE $${paramIndex++}`);
            params.push(`%${options.action}%`);
        }

        if (options.resourceType) {
            conditions.push(`resource_type = $${paramIndex++}`);
            params.push(options.resourceType);
        }

        if (options.startDate) {
            conditions.push(`created_at >= $${paramIndex++}`);
            params.push(options.startDate);
        }

        if (options.endDate) {
            conditions.push(`created_at <= $${paramIndex++}`);
            params.push(options.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.min(options.limit || 100, 1000);
        const offset = options.offset || 0;

        params.push(limit, offset);

        const result = await this.db.query<any>(
            `SELECT * FROM audit_logs ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            params
        );

        return result.rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            action: row.action,
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            details: row.details,
            createdAt: new Date(row.created_at),
        }));
    }

    /**
     * Get audit statistics.
     */
    async getStats(days: number = 30): Promise<{
        totalEvents: number;
        byAction: Record<string, number>;
        byUser: Record<string, number>;
    }> {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [totalResult, actionResult, userResult] = await Promise.all([
            this.db.query<{ count: string }>(
                'SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= $1',
                [startDate]
            ),
            this.db.query<{ action: string; count: string }>(
                `SELECT action, COUNT(*) as count FROM audit_logs
                 WHERE created_at >= $1
                 GROUP BY action
                 ORDER BY count DESC
                 LIMIT 20`,
                [startDate]
            ),
            this.db.query<{ user_id: string; count: string }>(
                `SELECT user_id, COUNT(*) as count FROM audit_logs
                 WHERE created_at >= $1 AND user_id IS NOT NULL
                 GROUP BY user_id
                 ORDER BY count DESC
                 LIMIT 20`,
                [startDate]
            ),
        ]);

        const byAction: Record<string, number> = {};
        for (const row of actionResult.rows) {
            byAction[row.action] = parseInt(row.count);
        }

        const byUser: Record<string, number> = {};
        for (const row of userResult.rows) {
            byUser[row.user_id] = parseInt(row.count);
        }

        return {
            totalEvents: parseInt(totalResult.rows[0]?.count || '0'),
            byAction,
            byUser,
        };
    }

    /**
     * Sanitize details object to remove sensitive data before logging.
     */
    private sanitizeDetails(details: Record<string, any>): Record<string, any> {
        const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'key', 'credential'];
        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(details)) {
            const isSensitive = sensitiveKeys.some((sk) =>
                key.toLowerCase().includes(sk.toLowerCase())
            );

            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeDetails(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Get severity level for security events.
     */
    private getSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
        const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
            rate_limited: 'low',
            blocked: 'medium',
            suspicious_activity: 'high',
            elevation_requested: 'medium',
            elevation_approved: 'high',
        };
        return severityMap[action] || 'low';
    }
}

// Singleton instance
let auditServiceInstance: AuditService | null = null;

export function getAuditService(): AuditService {
    if (!auditServiceInstance) {
        auditServiceInstance = new AuditService();
    }
    return auditServiceInstance;
}
