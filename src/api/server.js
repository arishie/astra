import express, {} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { openApiSpec } from './openapi.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { Database } from '../database/Database.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { BridgeManager } from '../bridge/BridgeManager.js';
import { UserService } from '../services/UserService.js';
import { MultiTenantOrchestrator } from '../core/MultiTenantOrchestrator.js';
import { LanceManager } from '../memory/LanceManager.js';
import { getAuditService } from '../services/AuditService.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import keysRoutes from './routes/keys.js';
import platformsRoutes, { setBridgeManager as setPlatformsBridgeManager } from './routes/platforms.js';
import chatRoutes, { setBridgeManager as setChatBridgeManager, setOrchestratorHandler } from './routes/chat.js';
import memoryRoutes, { setMemoryManager } from './routes/memory.js';
import healthRoutes from './routes/health.js';
import adminRoutes, { setStatsProviders } from './routes/admin.js';
import { StartupHealthCheck } from '../startup/HealthCheck.js';
export class AstraServer {
    app;
    config;
    db;
    rateLimiter;
    bridgeManager;
    userService;
    orchestrator;
    memoryManager;
    constructor(config = {}) {
        this.config = {
            port: config.port ?? parseInt(process.env.PORT || '3000', 10),
            corsOrigins: config.corsOrigins ?? ['http://localhost:3000', 'http://localhost:5173'],
            enableHelmet: config.enableHelmet ?? true,
            enableCompression: config.enableCompression ?? true,
        };
        this.app = express();
        this.db = Database.getInstance();
        this.rateLimiter = new RateLimiter();
        this.userService = new UserService();
        this.bridgeManager = new BridgeManager(this.userService, this.rateLimiter);
        this.orchestrator = new MultiTenantOrchestrator(this.userService, this.bridgeManager, this.rateLimiter);
        this.memoryManager = new LanceManager();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        if (this.config.enableHelmet) {
            this.app.use(helmet({
                contentSecurityPolicy: false,
            }));
        }
        if (this.config.enableCompression) {
            this.app.use(compression());
        }
        this.app.use(cors({
            origin: this.config.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
        }));
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((req, res, next) => {
            const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            res.setHeader('X-Request-ID', requestId);
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                console.log(`[API] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
            });
            next();
        });
    }
    setupRoutes() {
        // Health check routes (no auth required)
        this.app.use('/health', healthRoutes);
        this.app.get('/api/v1', (req, res) => {
            res.json({
                name: 'Astra AI Agent API',
                version: 'v1',
                documentation: '/api/v1/docs',
                endpoints: {
                    auth: '/api/v1/auth',
                    user: '/api/v1/user',
                    keys: '/api/v1/keys',
                    platforms: '/api/v1/platforms',
                    chat: '/api/v1/chat',
                    memory: '/api/v1/memory',
                    admin: '/api/v1/admin',
                    health: '/health',
                },
            });
        });
        this.app.use('/api/v1/auth', authRoutes);
        this.app.use('/api/v1/user', userRoutes);
        this.app.use('/api/v1/keys', keysRoutes);
        this.app.use('/api/v1/platforms', platformsRoutes);
        this.app.use('/api/v1/chat', chatRoutes);
        this.app.use('/api/v1/memory', memoryRoutes);
        this.app.use('/api/v1/admin', adminRoutes);
        // OpenAPI JSON spec
        this.app.get('/api/v1/docs/openapi.json', (req, res) => {
            res.json(openApiSpec);
        });
        // Swagger UI
        this.app.get('/api/v1/docs', (req, res) => {
            res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Astra API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        body { margin: 0; }
        .swagger-ui .topbar { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/v1/docs/openapi.json',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
            layout: "BaseLayout",
            deepLinking: true,
            defaultModelsExpandDepth: -1
        });
    </script>
</body>
</html>
            `);
        });
        // Serve web dashboard
        const webPath = join(__dirname, '../../web');
        this.app.use(express.static(webPath));
        // SPA fallback - serve index.html for all non-API routes
        this.app.get('/', (req, res) => {
            res.sendFile(join(webPath, 'index.html'));
        });
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.originalUrl} not found`,
            });
        });
    }
    setupErrorHandling() {
        this.app.use((err, req, res, next) => {
            console.error('[API] Error:', err);
            if (err.name === 'SyntaxError' && 'body' in err) {
                res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid JSON in request body',
                });
                return;
            }
            if (err.name === 'UnauthorizedError') {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: err.message || 'Authentication required',
                });
                return;
            }
            res.status(500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'production'
                    ? 'An unexpected error occurred'
                    : err.message,
            });
        });
    }
    async start() {
        try {
            // Run startup health checks
            const healthCheck = new StartupHealthCheck();
            const healthOk = await healthCheck.runAll();
            if (!healthOk) {
                console.error('[Server] Startup health check failed. Fix the issues above and try again.');
                process.exit(1);
            }
            // Connect to database
            await this.db.connect();
            console.log('[Server] Database connected');
            // Connect rate limiter
            await this.rateLimiter.connect();
            console.log('[Server] Rate limiter connected');
            // Initialize memory manager
            await this.memoryManager.initialize();
            console.log('[Server] Memory manager initialized');
            // Initialize orchestrator
            await this.orchestrator.initialize();
            console.log('[Server] Orchestrator initialized');
            // Wire up route dependencies
            setPlatformsBridgeManager(this.bridgeManager);
            setChatBridgeManager(this.bridgeManager);
            setMemoryManager(this.memoryManager);
            setStatsProviders(() => this.orchestrator.getStats(), async () => ({ initialized: true }));
            // Set orchestrator handler for chat routes
            setOrchestratorHandler(async (userId, message, context) => {
                const userContext = await this.orchestrator.getUserContext(userId);
                if (!userContext) {
                    throw new Error('User context not available');
                }
                // Search user's memory for relevant context
                const memoryResults = await userContext.memory.search(message, 5, userId);
                const memoryContext = memoryResults.length > 0
                    ? memoryResults.map(r => r.text).join('\n\n')
                    : '';
                // Generate response using user's configured models
                const response = await userContext.modelRouter.generateResponse(message, memoryContext);
                // Log the interaction for audit
                const audit = getAuditService();
                await audit.log({
                    userId,
                    action: 'chat:message',
                    resourceType: 'chat',
                    details: {
                        messageLength: message.length,
                        responseLength: response.length,
                        memoryHits: memoryResults.length,
                    },
                });
                return response;
            });
            // Start bridge health checks
            this.bridgeManager.startHealthCheck();
            // Start HTTP server
            this.app.listen(this.config.port, () => {
                console.log(`[Server] Astra API running on port ${this.config.port}`);
                console.log(`[Server] Health check: http://localhost:${this.config.port}/health`);
                console.log(`[Server] API docs: http://localhost:${this.config.port}/api/v1/docs`);
            });
        }
        catch (error) {
            console.error('[Server] Failed to start:', error);
            process.exit(1);
        }
    }
    async stop() {
        console.log('[Server] Shutting down...');
        // Shutdown in reverse order of initialization
        await this.orchestrator.shutdown();
        await this.bridgeManager.shutdown();
        await this.memoryManager.close();
        await this.rateLimiter.disconnect();
        await this.db.disconnect();
        console.log('[Server] Shutdown complete');
    }
    getExpressApp() {
        return this.app;
    }
    getBridgeManager() {
        return this.bridgeManager;
    }
    getOrchestrator() {
        return this.orchestrator;
    }
    getMemoryManager() {
        return this.memoryManager;
    }
    setOrchestratorHandler(handler) {
        setOrchestratorHandler(handler);
    }
    setMemoryManager(manager) {
        setMemoryManager(manager);
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new AstraServer();
    process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });
    server.start();
}
export default AstraServer;
//# sourceMappingURL=server.js.map