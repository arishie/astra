import { Database } from '../database/Database.js';
/**
 * Audit logging service for security compliance (SOC2, GDPR).
 * Logs all security-relevant events to the database.
 */
export class AuditService {
    db;
    enabled;
    constructor() {
        this.db = Database.getInstance();
        this.enabled = process.env.AUDIT_LOGGING !== 'false';
    }
    /**
     * Log an audit event.
     */
    async log(event) {
        if (!this.enabled)
            return;
        try {
            await this.db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                event.userId || null,
                event.action,
                event.resourceType || null,
                event.resourceId || null,
                event.ipAddress || null,
                event.userAgent || null,
                event.details ? JSON.stringify(this.sanitizeDetails(event.details)) : null,
            ]);
        }
        catch (error) {
            // Don't throw on audit failures - log and continue
            console.error('[AuditService] Failed to log event:', error);
        }
    }
    /**
     * Log authentication events.
     */
    async logAuth(action, userId, ipAddress, details) {
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
    async logApiKey(action, userId, keyId, provider, details) {
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
    async logPlatform(action, userId, platform, details) {
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
    async logDataAccess(action, userId, resourceType, resourceId, details) {
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
    async logAdmin(action, adminUserId, targetUserId, details) {
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
    async logSecurity(action, userId, ipAddress, details) {
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
    async query(options) {
        const conditions = [];
        const params = [];
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
        const result = await this.db.query(`SELECT * FROM audit_logs ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`, params);
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
    async getStats(days = 30) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const [totalResult, actionResult, userResult] = await Promise.all([
            this.db.query('SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= $1', [startDate]),
            this.db.query(`SELECT action, COUNT(*) as count FROM audit_logs
                 WHERE created_at >= $1
                 GROUP BY action
                 ORDER BY count DESC
                 LIMIT 20`, [startDate]),
            this.db.query(`SELECT user_id, COUNT(*) as count FROM audit_logs
                 WHERE created_at >= $1 AND user_id IS NOT NULL
                 GROUP BY user_id
                 ORDER BY count DESC
                 LIMIT 20`, [startDate]),
        ]);
        const byAction = {};
        for (const row of actionResult.rows) {
            byAction[row.action] = parseInt(row.count);
        }
        const byUser = {};
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
    sanitizeDetails(details) {
        const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'key', 'credential'];
        const sanitized = {};
        for (const [key, value] of Object.entries(details)) {
            const isSensitive = sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()));
            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeDetails(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    /**
     * Get severity level for security events.
     */
    getSeverity(action) {
        const severityMap = {
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
let auditServiceInstance = null;
export function getAuditService() {
    if (!auditServiceInstance) {
        auditServiceInstance = new AuditService();
    }
    return auditServiceInstance;
}
//# sourceMappingURL=AuditService.js.map