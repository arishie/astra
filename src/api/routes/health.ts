import { Router, type Request, type Response } from 'express';
import { Database } from '../../database/Database.js';

const router = Router();

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    checks: {
        database: ComponentHealth;
        memory: ComponentHealth;
        redis?: ComponentHealth;
    };
}

interface ComponentHealth {
    status: 'healthy' | 'unhealthy';
    latency?: number;
    message?: string;
}

const startTime = Date.now();

/**
 * Basic liveness probe - returns 200 if server is running.
 * Used by Kubernetes/load balancers to check if container is alive.
 */
router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
    });
});

/**
 * Readiness probe - returns 200 if server is ready to accept traffic.
 * Checks database connectivity and other critical dependencies.
 */
router.get('/ready', async (_req: Request, res: Response) => {
    try {
        const db = Database.getInstance();
        const start = Date.now();
        await db.query('SELECT 1');
        const latency = Date.now() - start;

        if (latency > 5000) {
            // Database responding but too slow
            res.status(503).json({
                status: 'not_ready',
                reason: 'Database latency too high',
                latency,
            });
            return;
        }

        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(503).json({
            status: 'not_ready',
            reason: 'Database unavailable',
        });
    }
});

/**
 * Comprehensive health check - returns detailed status of all components.
 * Used for monitoring dashboards and alerting systems.
 */
router.get('/', async (_req: Request, res: Response) => {
    const checks: HealthStatus['checks'] = {
        database: await checkDatabase(),
        memory: checkMemory(),
    };

    // Check Redis if configured
    if (process.env.REDIS_URL) {
        checks.redis = await checkRedis();
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
    const anyUnhealthy = Object.values(checks).some((c) => c.status === 'unhealthy');

    const status: HealthStatus = {
        status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        checks,
    };

    const httpStatus = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;
    res.status(httpStatus).json(status);
});

/**
 * Detailed metrics endpoint for Prometheus/monitoring.
 */
router.get('/metrics', async (_req: Request, res: Response) => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics = [
        `# HELP astra_uptime_seconds Time since server started`,
        `# TYPE astra_uptime_seconds gauge`,
        `astra_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}`,
        ``,
        `# HELP astra_memory_heap_used_bytes Memory heap used`,
        `# TYPE astra_memory_heap_used_bytes gauge`,
        `astra_memory_heap_used_bytes ${memUsage.heapUsed}`,
        ``,
        `# HELP astra_memory_heap_total_bytes Memory heap total`,
        `# TYPE astra_memory_heap_total_bytes gauge`,
        `astra_memory_heap_total_bytes ${memUsage.heapTotal}`,
        ``,
        `# HELP astra_memory_rss_bytes Resident set size`,
        `# TYPE astra_memory_rss_bytes gauge`,
        `astra_memory_rss_bytes ${memUsage.rss}`,
        ``,
        `# HELP astra_cpu_user_microseconds CPU user time`,
        `# TYPE astra_cpu_user_microseconds counter`,
        `astra_cpu_user_microseconds ${cpuUsage.user}`,
        ``,
        `# HELP astra_cpu_system_microseconds CPU system time`,
        `# TYPE astra_cpu_system_microseconds counter`,
        `astra_cpu_system_microseconds ${cpuUsage.system}`,
        ``,
    ];

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics.join('\n'));
});

async function checkDatabase(): Promise<ComponentHealth> {
    try {
        const db = Database.getInstance();
        const start = Date.now();
        await db.query('SELECT 1');
        const latency = Date.now() - start;

        return {
            status: 'healthy',
            latency,
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Database connection failed',
        };
    }
}

function checkMemory(): ComponentHealth {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Consider unhealthy if heap is > 95% used
    if (heapUsedPercent > 95) {
        return {
            status: 'unhealthy',
            message: `Heap usage critical: ${heapUsedPercent.toFixed(1)}%`,
        };
    }

    return {
        status: 'healthy',
        message: `Heap usage: ${heapUsedPercent.toFixed(1)}%`,
    };
}

async function checkRedis(): Promise<ComponentHealth> {
    try {
        const { createClient } = await import('redis');
        const client = createClient({ url: process.env.REDIS_URL });

        const start = Date.now();
        await client.connect();
        await client.ping();
        const latency = Date.now() - start;
        await client.quit();

        return {
            status: 'healthy',
            latency,
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Redis connection failed',
        };
    }
}

export default router;
