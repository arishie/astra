import { Router, type Response } from 'express';
import { authenticate, type AuthenticatedRequest, requireAdmin } from '../middleware/auth.js';
import { getAuditService } from '../../services/AuditService.js';

const router = Router();

// Store for stats providers (injected from server)
let getOrchestratorStats: (() => any) | null = null;
let getMemoryStats: (() => Promise<any>) | null = null;

export function setStatsProviders(orchestratorStats: () => any, memoryStats: () => Promise<any>): void {
    getOrchestratorStats = orchestratorStats;
    getMemoryStats = memoryStats;
}

router.use(authenticate);
router.use(requireAdmin);

/**
 * Get system-wide statistics (admin only)
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const stats: any = {
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
    } catch (error) {
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
router.get('/audit', async (req: AuthenticatedRequest, res: Response) => {
    const { userId, action, startDate, endDate, limit = 100, offset = 0 } = req.query;

    try {
        const audit = getAuditService();
        const logs = await audit.query({
            userId: userId as string,
            action: action as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            limit: parseInt(limit as string) || 100,
            offset: parseInt(offset as string) || 0,
        });

        res.json({
            logs,
            count: logs.length,
            limit: parseInt(limit as string) || 100,
            offset: parseInt(offset as string) || 0,
        });
    } catch (error) {
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
router.get('/audit/stats', async (req: AuthenticatedRequest, res: Response) => {
    const { days = 30 } = req.query;

    try {
        const audit = getAuditService();
        const stats = await audit.getStats(parseInt(days as string) || 30);

        res.json(stats);
    } catch (error) {
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
router.get('/contexts', async (req: AuthenticatedRequest, res: Response) => {
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
    } catch (error) {
        console.error('[AdminRoutes] Contexts error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve context information',
        });
    }
});

export default router;
