import { Router } from 'express';
import { authenticate, rateLimit } from '../middleware/auth.js';
import { BridgeManager } from '../../bridge/BridgeManager.js';
import { UserService } from '../../services/UserService.js';
const router = Router();
const userService = new UserService();
let bridgeManager = null;
let orchestratorHandler = null;
export function setBridgeManager(manager) {
    bridgeManager = manager;
}
export function setOrchestratorHandler(handler) {
    orchestratorHandler = handler;
}
router.use(authenticate);
router.post('/', rateLimit('chat', 1), async (req, res) => {
    const { message, platform, recipient, context } = req.body;
    // Input validation
    if (!message || typeof message !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Message content is required and must be a string',
        });
        return;
    }
    if (message.length > 50000) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Message exceeds maximum length of 50000 characters',
        });
        return;
    }
    if (platform && typeof platform !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Platform must be a string',
        });
        return;
    }
    if (recipient && typeof recipient !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Recipient must be a string',
        });
        return;
    }
    try {
        if (platform && recipient && bridgeManager) {
            const sent = await bridgeManager.sendMessage(req.userId, platform, recipient, message);
            if (!sent) {
                res.status(400).json({
                    error: 'Send Failed',
                    message: `Failed to send message via ${platform}`,
                });
                return;
            }
            res.json({
                sent: true,
                platform,
                recipient,
            });
            return;
        }
        if (!orchestratorHandler) {
            res.status(503).json({
                error: 'Service Unavailable',
                message: 'Chat orchestrator not initialized',
            });
            return;
        }
        const response = await orchestratorHandler(req.userId, message, context || {});
        res.json({
            response,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[ChatRoutes] Chat error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to process message',
        });
    }
});
router.post('/stream', rateLimit('chat', 1), async (req, res) => {
    const { message, context } = req.body;
    if (!message || typeof message !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Message content is required and must be a string',
        });
        return;
    }
    if (message.length > 50000) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Message exceeds maximum length of 50000 characters',
        });
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    try {
        res.write(`data: ${JSON.stringify({ type: 'start', timestamp: Date.now() })}\n\n`);
        if (!orchestratorHandler) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Orchestrator not available' })}\n\n`);
            res.end();
            return;
        }
        const response = await orchestratorHandler(req.userId, message, context || {});
        const words = response.split(' ');
        for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        res.write(`data: ${JSON.stringify({ type: 'end', timestamp: Date.now() })}\n\n`);
        res.end();
    }
    catch (error) {
        console.error('[ChatRoutes] Stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream processing failed' })}\n\n`);
        res.end();
    }
});
router.get('/history', async (req, res) => {
    const { platform, limit = 50, before } = req.query;
    try {
        // Import database for chat history
        const { Database } = await import('../../database/Database.js');
        const db = Database.getInstance();
        const limitNum = Math.min(parseInt(limit) || 50, 100);
        const params = [req.userId, limitNum];
        let query = `
            SELECT id, role, content, platform, metadata, created_at
            FROM chat_messages
            WHERE user_id = $1
        `;
        if (platform) {
            query += ` AND platform = $${params.length + 1}`;
            params.push(platform);
        }
        if (before) {
            query += ` AND created_at < $${params.length + 1}`;
            params.push(new Date(before));
        }
        query += ` ORDER BY created_at DESC LIMIT $2`;
        const result = await db.query(query, params);
        const messages = result.rows.map(row => ({
            id: row.id,
            role: row.role,
            content: row.content,
            platform: row.platform,
            metadata: row.metadata,
            createdAt: row.created_at,
        }));
        res.json({
            messages,
            hasMore: messages.length === limitNum,
            count: messages.length,
        });
    }
    catch (error) {
        console.error('[ChatRoutes] History error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve chat history',
        });
    }
});
router.post('/hive', rateLimit('hive', 1), async (req, res) => {
    const { task, options } = req.body;
    if (!task || typeof task !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Task description is required and must be a string',
        });
        return;
    }
    if (task.length > 10000) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Task description exceeds maximum length of 10000 characters',
        });
        return;
    }
    try {
        res.json({
            result: null,
            message: 'ThinkingHive integration pending',
            task,
        });
    }
    catch (error) {
        console.error('[ChatRoutes] Hive error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to process with ThinkingHive',
        });
    }
});
export default router;
//# sourceMappingURL=chat.js.map