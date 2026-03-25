import { Router } from 'express';
import { OAuthProvider } from '../../auth/OAuthProvider.js';
import { JWTService } from '../../auth/JWTService.js';
import { UserService } from '../../services/UserService.js';
import { authenticate, validateBody } from '../middleware/auth.js';
const router = Router();
const oauthProvider = new OAuthProvider();
const jwtService = new JWTService();
const userService = new UserService();
router.get('/oauth/:provider', (req, res) => {
    const { provider } = req.params;
    if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
    }
    const result = oauthProvider.generateAuthUrl(provider);
    if (!result) {
        res.status(400).json({
            error: 'Invalid Provider',
            message: `OAuth provider '${provider}' is not supported`,
        });
        return;
    }
    res.json({
        authUrl: result.url,
        state: result.state,
    });
});
router.get('/oauth/:provider/callback', async (req, res) => {
    const { provider } = req.params;
    const { code, state } = req.query;
    if (!code || !state) {
        res.status(400).json({
            error: 'Missing Parameters',
            message: 'Authorization code and state are required',
        });
        return;
    }
    try {
        const validProvider = oauthProvider.validateState(state);
        if (!validProvider || validProvider !== provider) {
            res.status(400).json({
                error: 'Invalid State',
                message: 'OAuth state validation failed',
            });
            return;
        }
        const userData = await oauthProvider.exchangeCode(provider, code);
        if (!userData) {
            res.status(401).json({
                error: 'Authentication Failed',
                message: 'Failed to authenticate with OAuth provider',
            });
            return;
        }
        const user = await userService.createOrUpdateUser(userData);
        const tokens = await jwtService.generateTokenPair(user.id, user.email);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
            },
            tokens,
        });
    }
    catch (error) {
        console.error('[AuthRoutes] OAuth callback error:', error);
        res.status(500).json({
            error: 'Authentication Error',
            message: 'An error occurred during authentication',
        });
    }
});
router.post('/refresh', validateBody({ refreshToken: { type: 'string', required: true } }), async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const payload = await jwtService.verifyRefreshToken(refreshToken);
        if (!payload) {
            res.status(401).json({
                error: 'Invalid Token',
                message: 'Refresh token is invalid or expired',
            });
            return;
        }
        const user = await userService.getUserById(payload.userId);
        if (!user || !user.isActive) {
            res.status(401).json({
                error: 'User Not Found',
                message: 'User account is inactive or not found',
            });
            return;
        }
        const tokens = await jwtService.generateTokenPair(user.id, user.email);
        res.json({ tokens });
    }
    catch (error) {
        console.error('[AuthRoutes] Refresh token error:', error);
        res.status(401).json({
            error: 'Token Error',
            message: 'Failed to refresh token',
        });
    }
});
router.post('/logout', authenticate, async (req, res) => {
    res.json({ message: 'Logged out successfully' });
});
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await userService.getUserById(req.userId);
        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            isAdmin: user.isAdmin,
            settings: user.settings,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
        });
    }
    catch (error) {
        console.error('[AuthRoutes] Get me error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve user information',
        });
    }
});
export default router;
//# sourceMappingURL=auth.js.map