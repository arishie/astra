import { Router } from 'express';
import { UserService } from '../../services/UserService.js';
import { BridgeManager } from '../../bridge/BridgeManager.js';
import { RateLimiter } from '../../middleware/RateLimiter.js';
import { WhatsAppMode } from '../../bridge/WhatsAppBridge.js';
import { authenticate, rateLimit, validateBody } from '../middleware/auth.js';
const router = Router();
const userService = new UserService();
const rateLimiter = new RateLimiter();
let bridgeManager = null;
export function setBridgeManager(manager) {
    bridgeManager = manager;
}
router.use(authenticate);
// Valid platforms whitelist to prevent injection
const VALID_PLATFORMS = ['whatsapp', 'telegram', 'discord', 'slack', 'signal', 'teams', 'matrix'];
function isValidPlatform(platform) {
    return VALID_PLATFORMS.includes(platform);
}
router.get('/', async (req, res) => {
    try {
        const platforms = await userService.listUserPlatforms(req.userId);
        const platformsWithStatus = platforms.map((platform) => {
            const bridgeStatus = bridgeManager?.getBridgeStatus(req.userId, platform.platform);
            return {
                id: platform.id,
                platform: platform.platform,
                platformUserId: platform.platformUserId,
                platformUsername: platform.platformUsername,
                mode: platform.mode,
                isActive: platform.isActive,
                connectedAt: platform.connectedAt,
                lastMessageAt: platform.lastMessageAt,
                bridgeStatus: bridgeStatus
                    ? {
                        connected: bridgeStatus.connected,
                        error: bridgeStatus.error,
                        qrCode: bridgeStatus.qrCode,
                    }
                    : null,
            };
        });
        res.json({ platforms: platformsWithStatus });
    }
    catch (error) {
        console.error('[PlatformsRoutes] List platforms error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve connected platforms',
        });
    }
});
router.post('/whatsapp/connect', rateLimit('browse', 1), validateBody({ mode: { type: 'string', required: true } }), async (req, res) => {
    const { mode, businessToken, phoneNumberId, verifyToken } = req.body;
    if (!bridgeManager) {
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Bridge manager not initialized',
        });
        return;
    }
    try {
        const whatsappMode = mode === 'business' ? WhatsAppMode.BUSINESS_API : WhatsAppMode.BAILEYS;
        if (whatsappMode === WhatsAppMode.BUSINESS_API) {
            if (!businessToken || !phoneNumberId) {
                res.status(400).json({
                    error: 'Missing Credentials',
                    message: 'Business API requires businessToken and phoneNumberId',
                });
                return;
            }
        }
        const status = await bridgeManager.connectUser(req.userId, 'whatsapp', {
            businessToken,
            phoneNumberId,
            verifyToken,
        }, { mode: whatsappMode });
        res.json({
            status: status.connected ? 'connected' : 'pending',
            qrCode: status.qrCode,
            error: status.error,
            message: whatsappMode === WhatsAppMode.BAILEYS && status.qrCode
                ? 'Scan the QR code with WhatsApp to connect'
                : status.connected
                    ? 'Connected successfully'
                    : 'Connection pending',
        });
    }
    catch (error) {
        console.error('[PlatformsRoutes] WhatsApp connect error:', error);
        // Sanitize error message - don't expose internal details
        res.status(500).json({
            error: 'Connection Error',
            message: 'Failed to connect to WhatsApp. Please verify your credentials and try again.',
        });
    }
});
router.get('/whatsapp/qr', async (req, res) => {
    if (!bridgeManager) {
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Bridge manager not initialized',
        });
        return;
    }
    try {
        const status = bridgeManager.getBridgeStatus(req.userId, 'whatsapp');
        if (!status) {
            res.status(404).json({
                error: 'Not Found',
                message: 'No WhatsApp connection in progress',
            });
            return;
        }
        res.json({
            connected: status.connected,
            qrCode: status.qrCode,
            error: status.error,
        });
    }
    catch (error) {
        console.error('[PlatformsRoutes] WhatsApp QR error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to get QR code',
        });
    }
});
router.post('/telegram/connect', rateLimit('browse', 1), validateBody({ token: { type: 'string', required: true } }), async (req, res) => {
    const { token } = req.body;
    if (!bridgeManager) {
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Bridge manager not initialized',
        });
        return;
    }
    try {
        const status = await bridgeManager.connectUser(req.userId, 'telegram', { token });
        res.json({
            connected: status.connected,
            error: status.error,
        });
    }
    catch (error) {
        console.error('[PlatformsRoutes] Telegram connect error:', error);
        res.status(500).json({
            error: 'Connection Error',
            message: 'Failed to connect to Telegram. Please verify your bot token and try again.',
        });
    }
});
router.post('/discord/connect', rateLimit('browse', 1), validateBody({ token: { type: 'string', required: true } }), async (req, res) => {
    const { token } = req.body;
    if (!bridgeManager) {
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Bridge manager not initialized',
        });
        return;
    }
    try {
        const status = await bridgeManager.connectUser(req.userId, 'discord', { token });
        res.json({
            connected: status.connected,
            error: status.error,
        });
    }
    catch (error) {
        console.error('[PlatformsRoutes] Discord connect error:', error);
        res.status(500).json({
            error: 'Connection Error',
            message: 'Failed to connect to Discord. Please verify your bot token and try again.',
        });
    }
});
router.post('/slack/connect', rateLimit('browse', 1), validateBody({
    token: { type: 'string', required: true },
    signingSecret: { type: 'string', required: true },
    appToken: { type: 'string', required: true },
}), async (req, res) => {
    const { token, signingSecret, appToken } = req.body;
    if (!bridgeManager) {
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Bridge manager not initialized',
        });
        return;
    }
    try {
        const status = await bridgeManager.connectUser(req.userId, 'slack', {
            token,
            signingSecret,
            appToken,
        });
        res.json({
            connected: status.connected,
            error: status.error,
        });
    }
    catch (error) {
        console.error('[PlatformsRoutes] Slack connect error:', error);
        res.status(500).json({
            error: 'Connection Error',
            message: 'Failed to connect to Slack. Please verify your credentials and try again.',
        });
    }
});
router.delete('/:platform/disconnect', async (req, res) => {
    const { platform } = req.params;
    // Validate platform name to prevent injection
    if (!platform || !isValidPlatform(platform)) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid platform specified',
        });
        return;
    }
    if (!bridgeManager) {
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Bridge manager not initialized',
        });
        return;
    }
    try {
        const disconnected = await bridgeManager.disconnectUser(req.userId, platform);
        if (!disconnected) {
            res.status(404).json({
                error: 'Not Found',
                message: `No active ${platform} connection found`,
            });
            return;
        }
        res.json({ message: `Disconnected from ${platform} successfully` });
    }
    catch (error) {
        console.error('[PlatformsRoutes] Disconnect error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to disconnect from platform',
        });
    }
});
router.get('/:platform/status', async (req, res) => {
    const { platform } = req.params;
    // Validate platform name to prevent injection
    if (!platform || !isValidPlatform(platform)) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid platform specified',
        });
        return;
    }
    if (!bridgeManager) {
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Bridge manager not initialized',
        });
        return;
    }
    try {
        const status = bridgeManager.getBridgeStatus(req.userId, platform);
        if (!status) {
            res.status(404).json({
                error: 'Not Found',
                message: `No ${platform} connection found`,
            });
            return;
        }
        res.json(status);
    }
    catch (error) {
        console.error('[PlatformsRoutes] Status error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to get platform status',
        });
    }
});
export default router;
//# sourceMappingURL=platforms.js.map