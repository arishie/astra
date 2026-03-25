import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getAuditService } from '../../services/AuditService.js';
const router = Router();
// Store for stats providers (injected from server)
let getOrchestratorStats = null;
let getMemoryStats = null;
export function setStatsProviders(orchestratorStats, memoryStats) {
    getOrchestratorStats = orchestratorStats;
    getMemoryStats = memoryStats;
}
router.use(authenticate);
router.use(requireAdmin);
/**
 * Get system-wide statistics (admin only)
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
        };
        if (getOrchestratorStats) {
            stats.orchestrator = getOrchestratorStats();
        }
        if (getMemoryStats) {
            stats.vectorMemory = await getMemoryStats();
        }
        res.json(stats);
    }
    catch (error) {
        console.error('[AdminRoutes] Stats error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve system stats',
        });
    }
});
/**
 * Get audit logs (admin only)
 */
router.get('/audit', async (req, res) => {
    const { userId, action, startDate, endDate, limit = 100, offset = 0 } = req.query;
    try {
        const audit = getAuditService();
        const logs = await audit.query({
            userId: userId,
            action: action,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0,
        });
        res.json({
            logs,
            count: logs.length,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0,
        });
    }
    catch (error) {
        console.error('[AdminRoutes] Audit query error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve audit logs',
        });
    }
});
/**
 * Get audit statistics (admin only)
 */
router.get('/audit/stats', async (req, res) => {
    const { days = 30 } = req.query;
    try {
        const audit = getAuditService();
        const stats = await audit.getStats(parseInt(days) || 30);
        res.json(stats);
    }
    catch (error) {
        console.error('[AdminRoutes] Audit stats error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve audit statistics',
        });
    }
});
/**
 * Get active user contexts (admin only)
 */
router.get('/contexts', async (req, res) => {
    try {
        if (!getOrchestratorStats) {
            res.status(503).json({
                error: 'Service Unavailable',
                message: 'Orchestrator stats not available',
            });
            return;
        }
        const stats = getOrchestratorStats();
        res.json({
            activeContexts: stats.activeContexts,
            maxContexts: stats.maxContexts,
            bridges: stats.bridgeStats,
        });
    }
    catch (error) {
        console.error('[AdminRoutes] Contexts error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve context information',
        });
    }
});
export default router;
//# sourceMappingURL=admin.js.map